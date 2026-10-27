import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Microphone } from "@phosphor-icons/react/dist/csr/Microphone";
import { MicrophoneSlash } from "@phosphor-icons/react/dist/csr/MicrophoneSlash";
import { Headphones } from "@phosphor-icons/react/dist/csr/Headphones";
import { Dossier } from "./MysteryPanels";
import { audioDirector } from "../game/AudioDirector";
import type { Session } from "../types/protocol";

interface Member { id: string; name: string; index: number }
interface VoiceRuntime { socket: WebSocket; context: AudioContext; gain: GainNode; stream?: MediaStream; processor?: AudioWorkletNode; source?: MediaStreamAudioSourceNode; silent?: GainNode }

export function RoomVoice({ session }: { session: Session }) {
  const [open, setOpen] = useState(false), [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false), [micBusy, setMicBusy] = useState(false);
  const [mic, setMic] = useState(false), [muted, setMuted] = useState(false), [deafened, setDeafened] = useState(false);
  const [talking, setTalking] = useState(false), [message, setMessage] = useState("");
  const [members, setMembers] = useState<Member[]>([]), [speaking, setSpeaking] = useState<number[]>([]);
  const [silenced, setSilenced] = useState<number[]>([]);
  const runtime = useRef<VoiceRuntime | null>(null);
  const flags = useRef({ talking: false, muted: false, deafened: false, silenced: [] as number[] });
  const playback = useRef(new Map<number, number>()), activity = useRef(new Map<number, number>());
  flags.current = { talking, muted, deafened, silenced };
  const voiceFocus = joined && ((talking && mic && !muted && !deafened) || (!deafened && speaking.some(index => !silenced.includes(index))));
  useEffect(() => {
    audioDirector.setVoiceFocus(voiceFocus);
    return () => audioDirector.setVoiceFocus(false);
  }, [voiceFocus]);

  function leave() {
    const current = runtime.current; runtime.current = null;
    if (current) {
      current.socket.onclose = null; current.socket.close();
      current.processor?.disconnect(); current.source?.disconnect(); current.silent?.disconnect();
      current.stream?.getTracks().forEach(track => track.stop());
      void current.context.close().catch(() => {});
    }
    playback.current.clear(); activity.current.clear();
    setJoined(false); setBusy(false); setMic(false); setMicBusy(false); setTalking(false); setMembers([]); setSpeaking([]);
  }
  useEffect(() => () => leave(), [session.room_code, session.player_id]);
  useEffect(() => {
    if (!joined) return;
    const timer = window.setInterval(() => setSpeaking([...activity.current].filter(([,until]) => until > Date.now()).map(([index]) => index)), 200);
    return () => window.clearInterval(timer);
  }, [joined]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.code !== "KeyV" || !joined || !mic || muted || deafened || event.ctrlKey || event.metaKey || ["INPUT","TEXTAREA","SELECT"].includes(target.tagName)) return;
      event.preventDefault(); setTalking(true);
    };
    const up = (event: KeyboardEvent) => { if (event.code === "KeyV") setTalking(false); };
    const stop = () => setTalking(false);
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", stop);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", stop); };
  }, [joined, mic, muted, deafened]);

  async function join() {
    setBusy(true); setMessage("");
    try {
      if (!window.AudioContext) throw new Error("Voice audio isn't supported in this browser. Try Chrome, Edge, or Safari.");
      const context = new AudioContext(), gain = context.createGain(); gain.connect(context.destination);
      await context.resume();
      const query = new URLSearchParams({ player_id: session.player_id, token: session.reconnect_token });
      const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/voice/${session.room_code}?${query}`);
      socket.binaryType = "arraybuffer";
      runtime.current = { socket, context, gain }; gain.gain.value = deafened ? 0 : 1;
      socket.onopen = () => { setJoined(true); setBusy(false); };
      socket.onerror = () => setMessage("The voice channel couldn't connect. Text radio is still available.");
      socket.onclose = () => { leave(); setMessage("Voice disconnected. Join again when you're ready."); };
      socket.onmessage = event => {
        if (runtime.current?.socket !== socket) return;
        if (typeof event.data === "string") {
          const value = JSON.parse(event.data); if (value.type === "voice_members") setMembers(value.players); return;
        }
        const bytes = new Uint8Array(event.data as ArrayBuffer);
        if (bytes.length !== 1281) return;
        const index = bytes[0]; activity.current.set(index, Date.now()+350);
        if (flags.current.deafened || flags.current.silenced.includes(index)) return;
        const pcm = new Int16Array(bytes.slice(1).buffer), buffer = context.createBuffer(1, pcm.length, 16000);
        const samples = buffer.getChannelData(0); for (let i=0;i<pcm.length;i++) samples[i] = pcm[i]/32768;
        const source = context.createBufferSource(); source.buffer = buffer; source.connect(gain);
        const previous = playback.current.get(index) ?? 0;
        const time = previous > context.currentTime && previous < context.currentTime+.4 ? previous : context.currentTime+.07;
        source.start(time); playback.current.set(index, time+buffer.duration); source.onended = () => source.disconnect();
      };
    } catch (caught) { leave(); setMessage((caught as Error).message); }
  }

  async function enableMic() {
    setMicBusy(true); setMessage("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("A microphone needs HTTPS and a supported browser.");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const current = runtime.current;
      if (!current) { stream.getTracks().forEach(track => track.stop()); return; }
      current.stream = stream; stream.getAudioTracks().forEach(track => track.enabled = !flags.current.muted);
      await current.context.audioWorklet.addModule("/audio/voice-processor.js");
      if (runtime.current !== current) { stream.getTracks().forEach(track => track.stop()); return; }
      current.source = current.context.createMediaStreamSource(stream);
      current.processor = new AudioWorkletNode(current.context, "witness-voice");
      current.silent = current.context.createGain(); current.silent.gain.value = 0;
      current.source.connect(current.processor); current.processor.connect(current.silent); current.silent.connect(current.context.destination);
      current.processor.port.onmessage = event => {
        const flag = flags.current;
        if (!flag.talking || flag.muted || flag.deafened || current.socket.readyState !== WebSocket.OPEN || current.socket.bufferedAmount > 12800) return;
        current.socket.send(event.data as ArrayBuffer);
      };
      setMic(true);
    } catch (caught) {
      runtime.current?.stream?.getTracks().forEach(track => track.stop());
      const name = (caught as DOMException).name;
      setMessage(name === "NotAllowedError" ? "Microphone permission was denied. You can still listen or use text radio." : name === "NotFoundError" ? "No microphone was found. You can still listen or use text radio." : "The microphone couldn't start. Check your device and browser permissions.");
    } finally { setMicBusy(false); }
  }
  function toggleMute() { const next = !muted; setMuted(next); setTalking(false); runtime.current?.stream?.getAudioTracks().forEach(track => track.enabled = !next); }
  function toggleDeafen() { const next = !deafened; setDeafened(next); setTalking(false); if (runtime.current) runtime.current.gain.gain.value = next ? 0 : 1; }
  function speakerTest() {
    const current = runtime.current; if (!current) return;
    const oscillator = current.context.createOscillator(), volume = current.context.createGain();
    oscillator.frequency.value = 440; volume.gain.value = .04; oscillator.connect(volume); volume.connect(current.gain);
    oscillator.start(); oscillator.stop(current.context.currentTime+.25); oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
  }
  const canTalk = joined && mic && !muted && !deafened;
  return <><div className={`voice-dock ${joined ? "voice-joined" : ""} ${talking && canTalk ? "transmitting" : ""}`}>
    <button className="voice-open" onClick={() => setOpen(true)}><Headphones size={18} /><span>{joined ? `Voice · ${members.length}` : "Voice chat"}</span>{joined && <i className={speaking.length ? "active" : ""} />}</button>
    {canTalk && <button className="voice-ptt" onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setTalking(true); }} onPointerUp={() => setTalking(false)} onPointerCancel={() => setTalking(false)} onKeyDown={event => { if (event.code === "Space") { event.preventDefault(); setTalking(true); } }} onKeyUp={event => { if (event.code === "Space") setTalking(false); }} onBlur={() => setTalking(false)}><Microphone size={16} /><span>{talking ? "Transmitting" : "Hold to talk"}</span><kbd>V</kbd></button>}
    </div>{open && createPortal(<Dossier title="Say it like you remember it." subtitle="OPTIONAL ROOM VOICE" onClose={() => setOpen(false)}><div className="voice-sheet"><p>Talk to witnesses who join this room's voice channel. Start as a listener; enable your microphone when you're ready.</p>{!joined ? <button className="primary-action" disabled={busy} onClick={() => void join()}><Headphones size={19} />{busy ? "Opening the channel…" : "Join voice as listener"}</button> : <><div className="voice-members" aria-label="Witnesses in voice">{members.map(member => <div className={speaking.includes(member.index) ? "speaking" : ""} key={member.id}><i /><span>{member.name}{member.id === session.player_id ? " (you)" : ""}</span>{member.id !== session.player_id && <button aria-pressed={silenced.includes(member.index)} onClick={() => setSilenced(current => current.includes(member.index) ? current.filter(index => index !== member.index) : [...current,member.index])}>{silenced.includes(member.index) ? "Unmute" : "Mute"}</button>}</div>)}</div>{!mic ? <button className="primary-action" disabled={micBusy} onClick={() => void enableMic()}><Microphone size={19} />{micBusy ? "Waiting for microphone permission…" : "Enable my microphone"}</button> : <div className="voice-mic-state"><b>{muted ? "Microphone muted" : talking && !deafened ? "You are transmitting" : "Microphone ready"}</b><p>Hold <kbd>V</kbd> or the talk button to transmit. Release to stop.</p></div>}<div className="voice-controls"><button onClick={toggleMute} disabled={!mic}>{muted ? <MicrophoneSlash size={17} /> : <Microphone size={17} />}{muted ? "Unmute mic" : "Mute mic"}</button><button onClick={toggleDeafen} aria-pressed={deafened}><Headphones size={17} />{deafened ? "Undeafen" : "Deafen"}</button><button onClick={speakerTest}>Test speaker</button></div><button className="text-button" onClick={leave}>Leave voice</button></>}{message && <p className="menu-error" role="status">{message}</p>}<small>Audio is relayed live through the game server and is never recorded or saved. Joining uses no microphone permission. Headphones help prevent echo.</small></div></Dossier>, document.body)}
  </>;
}
