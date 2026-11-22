import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { exchangeCode, readState, saveCredentials, YT_SCOPES } from "@/lib/youtube/oauth";
import { getMyChannel } from "@/lib/youtube/api";

/**
 * Callback OAuth Google. Token disimpan terenkripsi di yt_credentials
 * (hanya service role) dan tidak pernah dikirim ke browser.
 */
export async function GET(request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(new URL(`/channel?${q}`, request.url));
  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return back(`error=${encodeURIComponent(`Google: ${sp.get("error")}`)}`);
  try {
    const { data: auth } = await (await serverClient()).auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.redirect(new URL("/login", request.url));
    const state = readState(sp.get("state") ?? "");
    if (state.userId !== user.id) throw new Error("Sesi login tidak cocok dengan permintaan OAuth.");
    const { data: channel } = await adminClient()
      .from("channels")
      .select("id,user_id")
      .eq("id", state.channelId)
      .single();
    if (!channel || channel.user_id !== user.id) throw new Error("Kanal tidak ditemukan.");

    const tok = await exchangeCode(sp.get("code") ?? "");
    const granted = tok.scope.split(" ");
    const missing = YT_SCOPES.filter((s) => !granted.includes(s));
    if (missing.length) throw new Error(`Izin belum lengkap: ${missing.map((m) => m.split("/").pop()).join(", ")}. Centang semua izin saat menghubungkan.`);
    await saveCredentials(channel.id, tok);

    const me = await getMyChannel(channel.id);
    await adminClient()
      .from("channels")
      .update({ yt_channel_id: me.id, yt_channel_title: me.title, yt_thumbnail_url: me.thumbnail })
      .eq("id", channel.id);
    return back(`connected=${encodeURIComponent(me.title)}`);
  } catch (e) {
    return back(`error=${encodeURIComponent((e as Error).message)}`);
  }
}
