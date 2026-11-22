import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";
import { buildAuthUrl, makeState } from "@/lib/youtube/oauth";

/** Mulai OAuth Google untuk kanal tertentu. */
export async function GET(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get("channel");
  if (!channelId) return NextResponse.json({ error: "channel wajib" }, { status: 400 });
  const supabase = await serverClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL("/login", request.url));
  // RLS memastikan kanal milik user yang login.
  const { data: channel } = await supabase.from("channels").select("id").eq("id", channelId).maybeSingle();
  if (!channel) return NextResponse.redirect(new URL("/channel?error=Kanal%20tidak%20ditemukan", request.url));
  try {
    return NextResponse.redirect(buildAuthUrl(makeState({ channelId, userId: auth.user.id })));
  } catch (e) {
    return NextResponse.redirect(new URL(`/channel?error=${encodeURIComponent((e as Error).message)}`, request.url));
  }
}
