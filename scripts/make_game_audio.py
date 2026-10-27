"""Original I SWEAR score and tactile effects, synthesized offline with NumPy.

No samples, third-party compositions, recordings or model services. Requires
NumPy and ffmpeg. Lossless working masters stay in artifacts/.trailer-work.
"""
from pathlib import Path
import json
from hashlib import sha256
import shutil
import subprocess
import wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
RATE = 44100
WORK = ROOT / "artifacts/.trailer-work"
PUBLIC = ROOT / "frontend/public/audio"


def release(t, seconds, length=.12):
    return np.sin(np.clip((seconds-t)/length, 0, 1)*np.pi/2)**2


def instrument(midi, seconds, rng, kind="felt"):
    t = np.arange(round(seconds*RATE))/RATE
    hz = 440*2**((midi-69)/12)
    signal = np.zeros_like(t)
    if kind == "strings":
        for detune, weight in ((-.0027,.32),(0,.36),(.0023,.32)):
            phase = 2*np.pi*hz*(1+detune)*t + .025*np.sin(2*np.pi*.31*t)
            signal += weight*(np.sin(phase)+.08*np.sin(2*phase))
        return signal*(1-np.exp(-t/.42))*release(t, seconds, .95)
    if kind == "bass":
        signal = np.sin(2*np.pi*hz*t)+.22*np.sin(4*np.pi*hz*t)+.045*np.sin(6*np.pi*hz*t)
        return signal*(1-np.exp(-t/.012))*np.exp(-t/1.15)*release(t, seconds)
    if kind == "glass":
        for ratio, weight, decay in ((1,1,1.8),(2.01,.16,.7),(3.98,.055,.25)):
            signal += weight*np.sin(2*np.pi*hz*ratio*t)*np.exp(-t/decay)
        return signal*(1-np.exp(-t/.008))*release(t, seconds)
    # Inharmonic, separately decaying string modes, with a quiet hammer/pluck.
    for partial, weight in enumerate((1,.26,.10,.045,.018,.008), start=1):
        ratio = partial*np.sqrt(1+.00012*partial*partial)
        decay = (1.5 if kind == "felt" else .95)/(1+.38*(partial-1))
        signal += weight*np.sin(2*np.pi*hz*ratio*t)*np.exp(-t/decay)
    noise = rng.normal(0,1,len(t))
    noise = (noise+np.roll(noise,1)+np.roll(noise,2))/3
    signal += noise*np.exp(-t/.013)*(.022 if kind == "felt" else .045)
    return signal*(1-np.exp(-t/(.006 if kind == "felt" else .003)))*release(t, seconds)


def percussion(kind, rng):
    seconds = .3 if kind == "kick" else .14
    t = np.arange(round(seconds*RATE))/RATE
    if kind == "kick":
        phase = 2*np.pi*(47*t+55*.025*(1-np.exp(-t/.025)))
        return np.sin(phase)*(1-np.exp(-t/.003))*np.exp(-t/.065)*release(t, seconds,.05)
    noise = rng.normal(0,1,len(t))
    if kind == "brush":
        noise = np.convolve(noise,[.15,.35,.35,.15],mode="same")
        return (noise*.7+.12*np.sin(2*np.pi*177*t))*(1-np.exp(-t/.002))*np.exp(-t/.026)*release(t,seconds,.03)
    noise = noise-np.convolve(noise,np.ones(9)/9,mode="same")
    return noise*(1-np.exp(-t/.001))*np.exp(-t/.012)*release(t,seconds,.03)


class Score:
    def __init__(self, bpm, seed):
        self.bpm, self.beat, self.rng = bpm, 60/bpm, np.random.default_rng(seed)
        self.mix = np.zeros((round(64*self.beat*RATE),2),dtype=np.float64)

    def add(self, sound, beat, gain=1, pan=0):
        first = round(beat*self.beat*RATE) % len(self.mix)
        stereo = sound[:,None]*np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])*gain
        # Wrapped tails are continuous into the next play of the loop.
        for offset in range(0,len(sound),len(self.mix)):
            part = stereo[offset:offset+len(self.mix)]
            count = min(len(part),len(self.mix)-first)
            self.mix[first:first+count] += part[:count]
            self.mix[:len(part)-count] += part[count:]

    def note(self, midi, beat, gain, pan=0, seconds=2.7, kind="felt"):
        self.add(instrument(midi,seconds,self.rng,kind),beat,gain,pan)

    def master(self):
        dry = self.mix.copy()
        for seconds, gain in ((.113,.055),(.179,.045),(.307,.045),(.43,.03),(.71,.025),(1.13,.018)):
            self.mix += np.roll(dry[:,::-1],round(seconds*RATE),axis=0)*gain
        self.mix -= self.mix.mean(axis=0)
        self.mix = np.tanh(self.mix*1.3)
        self.mix *= .72/np.max(np.abs(self.mix))
        assert np.isfinite(self.mix).all()
        assert np.max(np.abs(self.mix[0]-self.mix[-1])) < .025
        return self.mix


def lobby():
    score = Score(84,271026)
    # Dm9 / Bbmaj9 / F6 / C6/9 / Gm9 / Bbmaj7 / Em7b5 / A7sus–A7.
    harmony = [([53,57,60,64],38),([53,57,60,62],34),([53,57,60,62],41),([52,55,62,64],36),
               ([53,57,58,62],43),([53,57,58,62],34),([52,55,58,62],40),([55,57,61,64],33)]
    melody = [((.1,74),(1.5,77),(2.5,76)),((.6,72),(2.1,69),(3.25,74)),
              ((.2,77),(1.75,81),(3,79)),((.8,76),(2.5,72)),
              ((.1,74),(1.5,70),(2.75,69)),((.4,72),(2.1,74),(3.4,77)),
              ((.2,76),(1.75,74),(3.1,70)),((.5,73),(2.25,69))]
    for bar in range(16):
        tones,bass = harmony[bar//2]
        start = bar*4
        score.note(bass,start,.15,-.08,seconds=2.4,kind="bass")
        score.note(bass+7,start+2.5,.05,.08,seconds=1.7,kind="bass")
        for index,midi in enumerate(tones):
            score.note(midi+12,start+.035*index,.042 if bar%2==0 else .027,(index-1.5)*.19,seconds=3.5)
            if bar%2==0:
                score.note(midi,start+.12,.017,(index-1.5)*.22,seconds=5.4,kind="strings")
        for index,offset in enumerate((.75,1.5,2.75,3.5)):
            score.note(tones[(index+bar)%4]+12,start+offset+.025*(index%2),.034,-.4+index*.24,seconds=1.8,kind="pluck")
        phrase = melody[bar%8]
        for index,(offset,midi) in enumerate(phrase):
            # A quieter answer in bars 9–16, with octave doubling only at its peak.
            score.note(midi,start+offset,.095 if bar<8 else .078,.15,seconds=2.6,kind="felt")
            if bar in (2,10,13) and index==1:
                score.note(midi+12,start+offset+.02,.018,-.22,seconds=2.4,kind="glass")
        for beat in (0,2): score.add(percussion("kick",score.rng),start+beat,.034)
        for beat in (1,3): score.add(percussion("brush",score.rng),start+beat+.025,.023,-.2 if beat==1 else .2)
        if bar%4!=3:
            for beat in (.5,1.5,2.5,3.5): score.add(percussion("hat",score.rng),start+beat,.006,.3)
    return score,score.master()


def investigation():
    score = Score(64,271027)
    harmony = [([50,57,60,64],38),([46,53,57,60],34),([48,55,57,62],36),([45,52,58,62],33),
               ([43,50,57,58],31),([46,53,57,62],34),([52,58,62,65],40),([45,55,61,64],33)]
    motif = [(74,69),(72,65),(76,72),(73,69),(70,69),(74,72),(76,70),(73,69)]
    for bar in range(16):
        tones,bass = harmony[bar//2]
        start = bar*4
        score.note(bass,start,.105,-.06,seconds=3.5,kind="bass")
        for index,midi in enumerate(tones):
            if bar%2==0: score.note(midi,start+.05*index,.027,(index-1.5)*.24,seconds=7.1,kind="strings")
        # Sparse pulse and space for conversation; the second phrase changes register.
        for index,beat in enumerate((0,1.5,3)):
            score.note(tones[(bar+index)%4]+12,start+beat,.035 if index==0 else .024,-.35+index*.35,seconds=2.6,kind="pluck")
        if bar%2==0:
            high,low = motif[bar//2]
            score.note(high-12 if bar>=8 else high,start+.3,.058,.22,seconds=4,kind="glass")
            score.note(low,start+2.65,.045,-.18,seconds=3.4,kind="felt")
        if bar%4!=3:
            score.add(percussion("kick",score.rng),start,.024)
            score.add(percussion("kick",score.rng),start+2.75,.011)
        if bar in (5,6,9,10,13,14): score.add(percussion("brush",score.rng),start+3,.009,.35)
    return score,score.master()


def pickup():
    rng = np.random.default_rng(271028)
    out = np.zeros(round(.95*RATE))
    def add(sound, seconds, gain):
        offset = round(seconds*RATE); count = min(len(sound),len(out)-offset)
        out[offset:offset+count] += sound[:count]*gain
    t = np.arange(round(.09*RATE))/RATE
    paper = np.convolve(rng.normal(0,1,len(t)),[.2,.6,.2],mode="same")
    add(paper*(1-np.exp(-t/.002))*np.exp(-t/.017),0,.075)
    add(np.sin(2*np.pi*(190*t+26*.015*(1-np.exp(-t/.015))))*np.exp(-t/.019)*(1-np.exp(-t/.001)),.022,.19)
    for midi,seconds,gain in ((74,.035,.32),(81,.105,.24),(84,.19,.16)):
        add(instrument(midi,.68,rng,"glass"),seconds,gain)
    dry = out.copy(); delay = round(.11*RATE); out[delay:] += dry[:-delay]*.065
    out *= release(np.arange(len(out))/RATE,len(out)/RATE,.12)
    return out*.68/np.max(np.abs(out))


def inspection():
    rng = np.random.default_rng(271029)
    t = np.arange(round(.18*RATE))/RATE
    noise = np.convolve(rng.normal(0,1,len(t)),np.ones(6)/6,mode="same")
    out = noise*(1-np.exp(-t/.004))*np.exp(-t/.025)*.28
    out += np.sin(2*np.pi*310*t)*(1-np.exp(-t/.001))*np.exp(-t/.012)*.19
    return out*release(t,.18,.04)*(.34/np.max(np.abs(out)))


def wav(path, signal):
    assert np.isfinite(signal).all() and np.max(np.abs(signal)) < 1
    with wave.open(str(path),"wb") as output:
        output.setnchannels(1 if signal.ndim==1 else 2); output.setsampwidth(2); output.setframerate(RATE)
        output.writeframes((signal*32767).astype("<i2").tobytes())


def mp3(source,destination,title):
    subprocess.run([shutil.which("ffmpeg") or "ffmpeg","-hide_banner","-loglevel","error","-y","-i",str(source),
                    "-c:a","libmp3lame","-b:a","128k","-metadata",f"title={title}","-metadata","artist=I SWEAR",str(destination)],check=True)


def build():
    WORK.mkdir(parents=True,exist_ok=True); PUBLIC.mkdir(parents=True,exist_ok=True)
    metadata = {}; masters = {}
    for key,title,compose in (("lobby","Everybody Has a Version",lobby),("investigation","Footnotes After Midnight",investigation)):
        score,mix = compose(); masters[key] = mix
        source = WORK/f"{key}-theme.wav"; wav(source,mix); destination=PUBLIC/f"{key}-theme.mp3"; mp3(source,destination,title)
        version = sha256(destination.read_bytes()).hexdigest()[:10]
        metadata[key] = {"title":title,"file":f"/audio/{key}-theme.mp3?v={version}","bpm":score.bpm,"duration":len(mix)/RATE}
        print(json.dumps({"track":key,"seconds":len(mix)/RATE,"bytes":destination.stat().st_size,"rms":float(np.sqrt(np.mean(mix**2))),"seam_delta":float(np.max(np.abs(mix[0]-mix[-1])))}))
    effect = pickup(); wav(PUBLIC/"record-pickup.wav",effect); wav(PUBLIC/"paper-inspect.wav",inspection())
    (ROOT/"frontend/src/game/score.json").write_text(json.dumps(metadata,indent=2)+"\n",encoding="utf-8")
    preview = np.zeros((round(23*RATE),2))
    preview[:8*RATE] = masters["lobby"][:8*RATE]
    preview[:8*RATE] *= release(np.arange(8*RATE)/RATE,8,.5)[:,None]
    preview[9*RATE:9*RATE+len(effect)] += effect[:,None]*.65
    preview[11*RATE:23*RATE] = masters["investigation"][:12*RATE]
    preview[11*RATE:23*RATE] *= release(np.arange(12*RATE)/RATE,12,.8)[:,None]
    source = WORK/"audio-preview.wav"; wav(source,preview)
    mp3(source,ROOT/"artifacts/i-swear-audio-preview.mp3","Lobby / record pickup / investigation")


if __name__ == "__main__":
    build()
