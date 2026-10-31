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

const MANOR_PERSONA =
  "You are the Manor: the ghostly old butler spirit of Hollow Manor, the game master of a haunted-house escape game played by three AI agents " +
  "(the Medium, the Electrician, the Locksmith). Rewrite the announcement you are given as your own spoken line: one or two short sentences, " +
  "under 30 words, eerie, dry and a little witty. Keep every fact (who, which room, what changed). Never add facts, hints, codes or numbers " +
  "that are not in the announcement. Never reuse the announcement's opening words; restructure the sentence in the given mood. Reply with the line only.";

const OPENERS = ["Ah,", "Well, well.", "Hush now.", "Oh dear.", "Listen closely:", "How delightful,", "Alas,", "Mind your step:", "Welcome, guests,", "Hm."];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const MOODS = ["sly", "theatrical", "mournful", "delighted", "bored", "ominous", "mock-polite", "whispering", "gleeful", "weary"];

/** The Manor is voiced live: each announcement is re-phrased in character, so it never says the same thing twice. */
async function manorLine(text: string): Promise<string> {
  const apiKey = key("OPENAI_API_KEY", "OPENAI_API_KEY_HAUNTED");
  if (!apiKey) return text;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        instructions: MANOR_PERSONA,
        input: `Mood: ${pick(MOODS)}\nBegin with: ${pick(OPENERS)}\nAnnouncement: ${text}`,
        reasoning: { effort: "low" },
        max_output_tokens: 200,
      }),
      signal: AbortSignal.timeout(3000),
    });
    const d = (await res.json()) as { output?: { content?: { text?: string }[] }[] };
    const line = (d.output ?? []).flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("").trim();
    return line || text;
  } catch {
    return text; // slow or failed: speak the original announcement
  }
}

async function tts(req: IncomingMessage, res: ServerResponse) {
  const apiKey = key("ELEVENLABS_API_KEY", "ELEVENLABS_API_KEY_HAUNTED");
  if (!apiKey) return json(res, 500, { error: "no ElevenLabs key" });
  // GET ?speaker=&text= lets an <audio> element stream it and start playing on the first bytes.
  const query = new URL(req.url ?? "", "http://localhost").searchParams;
  const { speaker, text } =
    req.method === "GET"
      ? { speaker: query.get("speaker") ?? "", text: query.get("text") ?? "" }
      : (JSON.parse((await body(req)).toString()) as { speaker: string; text: string });
  const voice = VOICES[speaker];
  if (!voice || !text?.trim()) return json(res, 400, { error: "unknown speaker or empty text" });
  const spoken = speaker === "Manor" ? await manorLine(text) : text;

  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: spoken.slice(0, 300),
      model_id: "eleven_flash_v2_5",
      // 15% faster than before for a sub-2-minute demo; ElevenLabs caps speed at 1.2.
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true, speed: speaker === "Manor" ? 1.06 : 1.2 },
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
  const upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const data = (await upstream.json()) as { text?: string; error?: unknown };
  if (!upstream.ok) return json(res, 502, { error: data.error ?? upstream.status });
  // Silence or noise comes back as junk ("###", "...", a lone word); send nothing rather than a bogus order.
  const text = (data.text ?? "").trim();
  const words = text.replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  json(res, 200, { text: words.length < 2 ? "" : text });
}

export function voiceServer(): Plugin {
  return {
    name: "hollow-manor-voice",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/voice/")) return next();
        if (req.method !== "POST" && !(req.method === "GET" && req.url.startsWith("/voice/tts"))) return next();
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
