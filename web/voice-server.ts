// Vite dev-server routes for voice, so API keys stay on the machine and never reach the browser.
//   POST /voice/tts  {speaker, text} -> audio/mpeg (ElevenLabs Flash v2.5)
//   POST /voice/stt  <audio blob>    -> {text}     (OpenAI transcription)
// Keys: ELEVENLABS_API_KEY / OPENAI_API_KEY from the environment, else the macOS Keychain
// entries ELEVENLABS_API_KEY_HAUNTED / OPENAI_API_KEY_HAUNTED (the demo Mac).
import { execFileSync } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

/** One voice per speaker, chosen to be easy to tell apart and easy to understand. */
export const VOICES: Record<string, string> = {
  Medium: "pFZP5JQG7iQjIQuC4Bku", // Lily: velvety, British
  Electrician: "N2lVS1w4EtoT3dr4eOWO", // Callum: husky
  Locksmith: "onwK4e9ZLuTAKqWW03F9", // Daniel: steady, precise
  Manor: "nPczCjzI2devNBz1zQrb", // Brian: deep, resonant
};

function key(env: string, keychain: string): string | undefined {
  if (process.env[env]) return process.env[env];
  if (process.platform !== "darwin") return undefined;
  try {
    return execFileSync("security", ["find-generic-password", "-a", process.env.USER ?? "", "-s", keychain, "-w"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return undefined;
  }
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}

async function tts(req: IncomingMessage, res: ServerResponse) {
  const apiKey = key("ELEVENLABS_API_KEY", "ELEVENLABS_API_KEY_HAUNTED");
  if (!apiKey) return json(res, 500, { error: "no ElevenLabs key" });
  const { speaker, text } = JSON.parse((await body(req)).toString()) as { speaker: string; text: string };
  const voice = VOICES[speaker];
  if (!voice || !text?.trim()) return json(res, 400, { error: "unknown speaker or empty text" });

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: text.slice(0, 300),
      model_id: "eleven_flash_v2_5",
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: speaker === "Manor" ? 0.92 : 1.05 },
    }),
  });
  if (!upstream.ok || !upstream.body) return json(res, 502, { error: `elevenlabs ${upstream.status}`, detail: await upstream.text() });
  res.setHeader("content-type", "audio/mpeg");
  const reader = upstream.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

async function stt(req: IncomingMessage, res: ServerResponse) {
  const apiKey = key("OPENAI_API_KEY", "OPENAI_API_KEY_HAUNTED");
  if (!apiKey) return json(res, 500, { error: "no OpenAI key" });
  const audio = await body(req);
  const type = req.headers["content-type"] ?? "audio/webm";
  const form = new FormData();
  const ext = type.includes("mp4") ? "mp4" : type.includes("mpeg") ? "mp3" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  form.append("file", new Blob([new Uint8Array(audio)], { type }), `speech.${ext}`);
  form.append("model", "gpt-4o-transcribe");
  form.append("prompt", "Hollow Manor escape room. Names: Medium, Electrician, Locksmith, Manor. Rooms: foyer, library, basement, conservatory, crypt, east corridor, secret passage. Circuits A, B, C.");
  const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data = (await upstream.json()) as { text?: string; error?: unknown };
  if (!upstream.ok) return json(res, 502, { error: data.error ?? upstream.status });
  json(res, 200, { text: (data.text ?? "").trim() });
}

export function voiceServer(): Plugin {
  return {
    name: "hollow-manor-voice",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST" || !req.url?.startsWith("/voice/")) return next();
        try {
          if (req.url.startsWith("/voice/tts")) return await tts(req, res);
          if (req.url.startsWith("/voice/stt")) return await stt(req, res);
          json(res, 404, { error: "not found" });
        } catch (err) {
          json(res, 500, { error: String(err) });
        }
      });
    },
  };
}
