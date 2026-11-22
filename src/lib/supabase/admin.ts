import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

// Client service role: melewati RLS. Hanya untuk kode server (route handler,
// server action, worker). Kunci service role tidak pernah dikirim ke browser.
let cached: SupabaseClient | null = null;

export function adminClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("adminClient hanya boleh dipakai di server.");
  if (!cached) {
    cached = createClient(env.supabaseUrl(), env.supabaseServiceKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
