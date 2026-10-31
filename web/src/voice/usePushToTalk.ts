// Hold-to-talk: record the selected mic, transcribe on release via /voice/stt.
import { useCallback, useEffect, useRef, useState } from "react";

export type TalkState = "idle" | "listening" | "transcribing" | "error";

export function useMicDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const refresh = useCallback(async () => {
    const all = await navigator.mediaDevices?.enumerateDevices().catch(() => []);
    setDevices((all ?? []).filter((d) => d.kind === "audioinput"));
  }, []);
  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
  }, [refresh]);
  return { devices, refresh };
}

export function usePushToTalk(deviceId: string, onText: (text: string) => void, onPermission?: () => void) {
  const [state, setState] = useState<TalkState>("idle");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    if (recorder.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true },
      });
      onPermission?.();
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        recorder.current = null;
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 2000) return setState("idle"); // a tap, not speech
        setState("transcribing");
        try {
          const res = await fetch("/voice/stt", { method: "POST", headers: { "content-type": blob.type }, body: blob });
          const { text } = (await res.json()) as { text?: string };
          if (text) onText(text);
          setState("idle");
        } catch {
          setState("error");
        }
      };
      recorder.current = rec;
      rec.start();
      setState("listening");
    } catch {
      setState("error");
    }
  }, [deviceId, onText, onPermission]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  return { state, start, stop };
}
