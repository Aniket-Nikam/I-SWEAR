"""Compose 'Everybody Has a Version', an original 16-bar lobby loop.

Requires NumPy and ffmpeg. No samples, external recordings, model calls or
third-party composition. The score, instruments and circular reverb are here.
Intermediate lossless audio stays in the ignored trailer-work directory.
"""
from pathlib import Path
import json
import shutil
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE, BPM = 44100, 78
BEAT = 60 / BPM
LENGTH = round(16 * 4 * BEAT * RATE)
mix = np.zeros((LENGTH, 2), dtype=np.float64)
rng = np.random.default_rng(2641)


def add(sound, beat, gain=1, pan=0):
    first = round(beat * BEAT * RATE) % LENGTH
    stereo = sound[:, None] * np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)]) * gain
    end = first + len(sound)
    if end <= LENGTH:
        mix[first:end] += stereo
    else:
        mix[first:] += stereo[:LENGTH-first]
        mix[:end-LENGTH] += stereo[LENGTH-first:]


def note(midi, seconds, kind="felt"):
    t = np.arange(round(seconds * RATE)) / RATE
    hz = 440 * 2 ** ((midi - 69) / 12)
    attack = 1 - np.exp(-t / (.045 if kind == "pad" else .006))
    if kind == "bass":
        signal = np.sin(2*np.pi*hz*t) + .14*np.sin(4*np.pi*hz*t)
        envelope = attack * np.exp(-t/1.1)
    elif kind == "pad":
        signal = np.sin(2*np.pi*hz*t) + .17*np.sin(2*np.pi*hz*2.002*t)
        envelope = attack * np.minimum(1, np.maximum(0, (seconds-t)/.9)) * .4
    else:
        signal = (np.sin(2*np.pi*hz*t) * np.exp(-t/1.7)
                  + .28*np.sin(2*np.pi*hz*2.001*t) * np.exp(-t/.7)
                  + .09*np.sin(2*np.pi*hz*3.003*t) * np.exp(-t/.3))
        envelope = attack * np.minimum(1, np.maximum(0, (seconds-t)/.06))
    return signal * envelope


# Dm9 / Bbmaj7 / Fmaj7 / Cadd9 / Gm9 / Bbmaj7 / Em7b5 / A7.
chords = [([50,57,60,64],38), ([46,53,57,62],34), ([48,53,57,64],41), ([48,55,62,64],36),
          ([43,50,57,58],31), ([46,53,57,62],34), ([52,58,62,67],40), ([45,55,61,64],33)]
melody = [[74,69,76,77], [None,72,69,74], [77,76,72,69], [None,67,72,74],
          [74,70,69,67], [None,69,74,72], [76,74,70,67], [73,76,None,69]]
for bar in range(16):
    tones, bass = chords[(bar//2) % 8]
    start = bar * 4
    add(note(bass, 2.8, "bass"), start, .13, -.08)
    add(note(bass+12, 1.8, "bass"), start+2.4, .045, .05)
    for i, midi in enumerate(tones):
        add(note(midi+12, 4.8, "pad"), start+.04*i, .025, (i-1.5)/4)
    for i in range(6):
        midi = tones[(i + bar % 2) % 4] + 12
        add(note(midi, 2.8), start + i*.5 + (.055 if i % 2 else 0), .044 if i % 2 else .06, -.35 + i*.12)
    for i, midi in enumerate(melody[bar % 8]):
        if midi is not None:
            add(note(midi + (12 if bar == 12 and i == 0 else 0), 3.7), start+i+.08, .09 if bar < 8 else .075, .17)
    for beat in (1, 3):
        t = np.arange(round(.12 * RATE)) / RATE
        brush = np.diff(rng.normal(0, 1, len(t)+1)) * np.exp(-t/.022) * (1-np.exp(-t/.002))
        add(brush, start+beat+.04, .008, -.25 if beat == 1 else .25)

# Circular echoes carry the last phrase into the first; no seam fade-to-silence.
dry = mix.copy()
for delay, gain in ((.19,.10),(.37,.08),(.61,.055),(.89,.035)):
    mix += np.roll(dry[:, ::-1], round(delay*RATE), axis=0) * gain
mix -= np.mean(mix, axis=0)
mix = np.tanh(mix * 1.2)
mix *= .64 / np.max(np.abs(mix))
assert np.isfinite(mix).all() and np.max(np.abs(mix)) < 1
assert np.max(np.abs(mix[0] - mix[-1])) < .03, "Loop discontinuity"
work = ROOT / "artifacts/.trailer-work"
work.mkdir(parents=True, exist_ok=True)
wav = work / "lobby-theme.wav"
with wave.open(str(wav), "wb") as output:
    output.setnchannels(2)
    output.setsampwidth(2)
    output.setframerate(RATE)
    output.writeframes((mix * 32767).astype("<i2").tobytes())
destination = ROOT / "frontend/public/audio/lobby-theme.mp3"
subprocess.run([shutil.which("ffmpeg") or "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(wav),
                "-c:a", "libmp3lame", "-b:a", "128k", "-metadata", "title=Everybody Has a Version",
                "-metadata", "artist=I SWEAR", str(destination)], check=True)
print(json.dumps({"file": str(destination), "seconds": LENGTH/RATE, "peak": float(np.max(np.abs(mix))),
                  "rms": float(np.sqrt(np.mean(mix**2))), "seam_delta": float(np.max(np.abs(mix[0]-mix[-1])))}))
