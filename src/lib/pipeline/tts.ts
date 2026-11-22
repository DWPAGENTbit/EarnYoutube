import { requireSecret } from "../secrets";

export type TtsProvider = "openai" | "elevenlabs";

export interface TtsOptions {
  userId: string;
  provider: TtsProvider;
  voice: string; // OpenAI: alloy/nova/...; ElevenLabs: voice_id
  language?: string;
}

/** Hasilkan MP3 untuk satu potong narasi. */
export async function synthesize(text: string, o: TtsOptions): Promise<Buffer> {
  if (o.provider === "elevenlabs") {
    const key = await requireSecret(o.userId, "ELEVENLABS_API_KEY");
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(o.voice)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2" }),
    });
    if (!res.ok) throw new Error(`ElevenLabs TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const key = await requireSecret(o.userId, "OPENAI_API_KEY");
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice: o.voice || "alloy",
      input: text.slice(0, 4000),
      response_format: "mp3",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}
