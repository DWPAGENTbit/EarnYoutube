// Akses variabel lingkungan sisi server. Jangan impor file ini dari
// Client Component: semua nilai di sini rahasia kecuali NEXT_PUBLIC_*.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variabel lingkungan ${name} belum diisi (lihat .env.example).`);
  return v;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  appUrl: () => process.env.APP_URL ?? "http://localhost:3000",
  tokenEncryptionKey: () => required("TOKEN_ENCRYPTION_KEY"),
  anthropicModel: () => process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5",
};

/** Nama secret yang boleh disimpan user lewat halaman Settings. */
export const SECRET_NAMES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "ELEVENLABS_API_KEY",
  "PEXELS_API_KEY",
  "PIXABAY_API_KEY",
] as const;
/** Kredensial OAuth Google (diisi per user di web: halaman Channel / Settings). */
export const GOOGLE_SECRET_NAMES = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;
export type SecretName = (typeof SECRET_NAMES)[number] | (typeof GOOGLE_SECRET_NAMES)[number];
