import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "../env";

/** Client Supabase dengan sesi user (RLS aktif). */
export async function serverClient() {
  const cookieStore = await cookies();
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component: cookie disegarkan oleh proxy.ts.
        }
      },
    },
  });
}

/** User yang sedang login, atau redirect ke /login. */
export async function requireUser() {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}

/** Kanal aktif user (dipilih lewat cookie `channel_id`, default kanal pertama). */
export async function getActiveChannel() {
  const { supabase, user } = await requireUser();
  const cookieStore = await cookies();
  const wanted = cookieStore.get("channel_id")?.value;
  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: true });
  const list = channels ?? [];
  const channel = list.find((c) => c.id === wanted) ?? list[0] ?? null;
  return { supabase, user, channel, channels: list };
}

/** Pastikan channelId milik user yang login (cek lewat RLS). */
export async function assertChannel(channelId: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("channels").select("*").eq("id", channelId).single();
  if (!data) throw new Error("Kanal tidak ditemukan.");
  return { supabase, user, channel: data };
}
