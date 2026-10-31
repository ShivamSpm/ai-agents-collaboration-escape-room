// Hold-to-talk: record the selected mic, transcribe on release via /voice/stt.
import { useCallback, useEffect, useRef, useState } from "react";

export type TalkState = "idle" | "listening" | "transcribing" | "error";

const BUILT_IN = /built-?in|macbook|internal|default/i;
const VIRTUAL = /blackhole|soundflower|zoom|teams|loopback|virtual|aggregate|obs|iphone|continuity/i;
const EXTERNAL = /usb|external|wireless|lav|rode|dji|shure|yeti|blue|hollyland|boya|samson|audio-technica|focusrite|scarlett|headset|rx|receiver/i;

/** Prefer a USB or external mic over the laptop's built-in one; virtual devices last. */
export function preferredMic(devices: MediaDeviceInfo[]): string {
  const real = devices.filter((d) => d.deviceId && d.deviceId !== "default" && !VIRTUAL.test(d.label));
  const pick = real.find((d) => EXTERNAL.test(d.label)) ?? real.find((d) => !BUILT_IN.test(d.label));
  return pick?.deviceId ?? "";
}

export function useMicDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const refresh = useCallback(async () => {
    const all = await navigator.mediaDevices?.enumerateDevices().catch(() => []);
    setDevices((all ?? []).filter((d) => d.kind === "audioinput"));
  }, []);
  useEffect(() => {
    // Device labels stay hidden until mic permission is granted, so ask once up front to pick the external mic.
    void (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch {
        // Permission denied: the picker still lists unnamed devices.
      }
      await refresh();
    })();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", refresh);
  }, [refresh]);
  return { devices, refresh };
}

export function usePushToTalk(deviceId: string, onText: (text: string) => void, onPermission?: () => void) {
  const [state, setState] = useState<TalkState>("idle");
  /** The live mic stream while listening, for the on-screen sound wave. */
  const [stream, setStream] = useState<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    if (recorder.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true },
      });
      onPermission?.();
      setStream(stream);
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
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

  return { state, stream, start, stop };
}
