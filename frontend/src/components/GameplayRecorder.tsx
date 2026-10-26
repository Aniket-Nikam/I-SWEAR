import { useEffect, useRef, useState } from "react";
import { Record } from "@phosphor-icons/react/dist/csr/Record";
import { Stop } from "@phosphor-icons/react/dist/csr/Stop";
import { audioDirector } from "../game/AudioDirector";

/** Captures this game's canvas and synthesized audio, with no desktop or microphone access. */
export function useGameplayRecording() {
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const started = useRef(0);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started.current) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(() => () => { if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach((track) => track.stop()); }, []);

  async function start() {
    setError("");
    const canvas = document.querySelector<HTMLCanvasElement>(".game-canvas canvas");
    if (!canvas?.captureStream || typeof MediaRecorder === "undefined") {
      setError("Screen recording is not available in this browser. Try Chrome or Edge."); return;
    }
    try {
      await audioDirector.unlock();
      const captured = canvas.captureStream(30);
      audioDirector.recordingStream()?.getAudioTracks().forEach((track) => captured.addTrack(track.clone()));
      stream.current = captured;
      const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const media = new MediaRecorder(captured, { mimeType, videoBitsPerSecond: 5_000_000 });
      const chunks: BlobPart[] = [];
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      media.onstop = () => {
        captured.getTracks().forEach((track) => track.stop()); setRecording(false);
        const blob = new Blob(chunks, { type: media.mimeType || "video/webm" });
        if (!blob.size) return;
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = "i-swear-gameplay.webm"; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 3000);
      };
      captured.getVideoTracks()[0].onended = () => { if (media.state !== "inactive") media.stop(); };
      recorder.current = media; started.current = Date.now(); setSeconds(0); setRecording(true); media.start(500);
    } catch { setError("Recording couldn't start. Try Chrome or Edge, then open the case again."); }
  }
  const stop = () => { if (recorder.current?.state === "recording") recorder.current.stop(); };
  const control = <div className="gameplay-recorder"><button onClick={() => recording ? stop() : void start()}>{recording ? <Stop size={17} weight="fill" /> : <Record size={17} />} {recording ? `Stop recording · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Record world clip"}</button><small>Captures the game world and game audio. No microphone or desktop. Your clip downloads when you stop.</small>{error && <p role="status">{error}</p>}</div>;
  return { control, recording, stop };
}
