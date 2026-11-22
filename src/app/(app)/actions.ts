"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { assertChannel, requireUser } from "@/lib/supabase/server";
import { approveVideo, createVideoFromIdea, enqueue, retryVideo } from "@/lib/pipeline/queue";
import { findStock, downloadFile } from "@/lib/pipeline/stock";
import { objectPath, putObject } from "@/lib/storage";
import { deleteSecret, setSecret } from "@/lib/secrets";
import { GOOGLE_SECRET_NAMES, SECRET_NAMES, type SecretName } from "@/lib/env";
import { revokeCredentials } from "@/lib/youtube/oauth";
import { DEFAULT_SETTINGS, channelSettings, type ChannelSettings, type Video } from "@/lib/types";
import type { M3Output } from "@/lib/ai/schemas";

export interface ActionState {
  ok: boolean;
  message: string;
  at?: number;
}
const ok = (message: string): ActionState => ({ ok: true, message, at: Date.now() });
const fail = (e: unknown): ActionState => ({ ok: false, message: e instanceof Error ? e.message : String(e), at: Date.now() });
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function ownVideo(videoId: string) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("videos").select("*").eq("id", videoId).single();
  if (!data) throw new Error("Video tidak ditemukan.");
  return data as Video;
}

// ------------------------------------------------------------------ kanal
export async function selectChannel(channelId: string) {
  await assertChannel(channelId);
  (await cookies()).set("channel_id", channelId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function saveChannel(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await requireUser();
    const id = str(form, "id");
    const fields = {
      name: str(form, "name") || "Kanal baru",
      niche: str(form, "niche"),
      audience: str(form, "audience"),
      competitors: str(form, "competitors"),
      resources: str(form, "resources"),
      goals: str(form, "goals"),
      language: str(form, "language") || "id",
    };
    if (id) {
      await assertChannel(id);
      const { error } = await supabase.from("channels").update(fields).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data, error } = await supabase
        .from("channels")
        .insert({ ...fields, user_id: user.id, settings: DEFAULT_SETTINGS })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      (await cookies()).set("channel_id", data.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 31536000 });
    }
    revalidatePath("/", "layout");
    return ok("Kanal tersimpan.");
  } catch (e) {
    return fail(e);
  }
}

/** Jalankan modul AI kanal (M1, M2, M4, M5, M6) di worker. */
export async function runChannelModule(channelId: string, module: 1 | 2 | 4 | 5 | 6, count?: number): Promise<ActionState> {
  try {
    const { channel } = await assertChannel(channelId);
    if (module === 2 && !channel.niche) throw new Error("Isi niche kanal dulu.");
    await enqueue("module", { channelId, payload: { module, count: count ?? 100 } });
    revalidatePath("/", "layout");
    return ok(`Modul ${module} masuk antrean. Hasilnya muncul setelah worker selesai.`);
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectYouTube(channelId: string): Promise<ActionState> {
  try {
    await assertChannel(channelId);
    await revokeCredentials(channelId);
    await adminClient().from("channels").update({ yt_channel_id: null, yt_channel_title: null, yt_thumbnail_url: null }).eq("id", channelId);
    revalidatePath("/", "layout");
    return ok("Akun YouTube diputuskan.");
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ ide
export async function addIdea(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const channelId = str(form, "channel_id");
    const { supabase } = await assertChannel(channelId);
    const title = str(form, "title");
    if (!title) throw new Error("Judul ide wajib diisi.");
    const { error } = await supabase.from("ideas").insert({
      channel_id: channelId,
      title,
      angle: str(form, "angle"),
      score: Number(form.get("score") || 50),
      source: "manual",
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ideas");
    return ok("Ide ditambahkan.");
  } catch (e) {
    return fail(e);
  }
}

export async function setIdeaStatus(ideaId: string, status: "backlog" | "rejected"): Promise<ActionState> {
  try {
    const { supabase } = await requireUser();
    const { error } = await supabase.from("ideas").update({ status }).eq("id", ideaId);
    if (error) throw new Error(error.message);
    revalidatePath("/ideas");
    return ok(status === "rejected" ? "Ide dibuang." : "Ide dikembalikan ke backlog.");
  } catch (e) {
    return fail(e);
  }
}

export async function produceIdea(ideaId: string, format: "long" | "short"): Promise<ActionState> {
  try {
    const { supabase } = await requireUser();
    const { data: idea } = await supabase.from("ideas").select("id,channel_id").eq("id", ideaId).single();
    if (!idea) throw new Error("Ide tidak ditemukan.");
    const { channel } = await assertChannel(idea.channel_id);
    const s = channelSettings(channel);
    await createVideoFromIdea({ channelId: idea.channel_id, ideaId, format, targetDurationSec: format === "short" ? 55 : s.target_duration_sec });
    revalidatePath("/ideas");
    revalidatePath("/studio");
    return ok("Produksi dimulai. Pantau di Studio.");
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ studio
/** Simpan editan scene sebagai versi skrip baru lalu ulangi dari voice-over. */
export async function saveScript(videoId: string, script: M3Output): Promise<ActionState> {
  try {
    const video = await ownVideo(videoId);
    const { supabase } = await requireUser();
    const { count } = await supabase.from("scripts").select("id", { count: "exact", head: true }).eq("idea_id", video.idea_id);
    const { data: sc, error } = await supabase
      .from("scripts")
      .insert({ channel_id: video.channel_id, idea_id: video.idea_id, json: script, model: "manual-edit", version: (count ?? 0) + 1 })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await adminClient().from("videos").update({ script_id: sc.id, status: "voicing", qc_json: null }).eq("id", videoId);
    await enqueue("voicing", { channelId: video.channel_id, videoId });
    revalidatePath(`/studio/${videoId}`);
    return ok("Skrip versi baru tersimpan. Voice-over, aset, dan render diulang.");
  } catch (e) {
    return fail(e);
  }
}

/** Ganti visual satu scene dengan kata kunci stok baru, lalu render ulang. */
export async function swapSceneAsset(videoId: string, sceneIndex: number, query: string): Promise<ActionState> {
  try {
    const video = await ownVideo(videoId);
    const { user } = await requireUser();
    const db = adminClient();
    const { data: current } = await db
      .from("assets")
      .select("id,meta")
      .eq("video_id", videoId)
      .eq("scene_index", sceneIndex)
      .in("type", ["image", "video"]);
    const exclude = new Set((current ?? []).map((a) => `${a.meta?.provider}:${a.meta?.external_id}`));
    const item = await findStock(user.id, query, video.format === "short" ? "portrait" : "landscape", exclude);
    if (!item) throw new Error(`Tidak ada stok untuk "${query}". Coba kata kunci bahasa Inggris lain.`);
    const ext = item.kind === "video" ? "mp4" : "jpg";
    const ref = await putObject(
      "assets",
      objectPath(video.channel_id, videoId, `scene_${sceneIndex}_${Date.now()}.${ext}`),
      await downloadFile(item.url),
      item.kind === "video" ? "video/mp4" : "image/jpeg",
    );
    await db.from("assets").delete().eq("video_id", videoId).eq("scene_index", sceneIndex).in("type", ["image", "video"]);
    await db.from("assets").insert({
      channel_id: video.channel_id,
      script_id: video.script_id,
      video_id: videoId,
      scene_index: sceneIndex,
      type: item.kind,
      url: ref,
      license_source: item.license_source,
      meta: { provider: item.provider, external_id: item.externalId, page_url: item.pageUrl, author: item.author, query },
    });
    revalidatePath(`/studio/${videoId}`);
    return ok(`Scene ${sceneIndex + 1} diganti (${item.provider} ${item.kind}). Klik "Render ulang" setelah selesai mengganti.`);
  } catch (e) {
    return fail(e);
  }
}

export async function rerender(videoId: string): Promise<ActionState> {
  try {
    const video = await ownVideo(videoId);
    await adminClient().from("videos").update({ status: "rendering", qc_json: null }).eq("id", videoId);
    await enqueue("rendering", { channelId: video.channel_id, videoId });
    revalidatePath(`/studio/${videoId}`);
    return ok("Render ulang masuk antrean.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveMetadata(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const videoId = str(form, "video_id");
    const video = await ownVideo(videoId);
    if (!video.metadata_json) throw new Error("Metadata belum dibuat (tunggu render selesai).");
    const title = str(form, "title");
    if (!title || title.length > 100) throw new Error("Judul wajib diisi, maksimal 100 karakter.");
    const thumbnail = str(form, "thumbnail") || video.thumbnail_url;
    if (thumbnail && !video.metadata_json.thumbnail_options.includes(thumbnail)) throw new Error("Thumbnail tidak valid.");
    const metadata = {
      ...video.metadata_json,
      title,
      description: str(form, "description").slice(0, 4900),
      tags: str(form, "tags").split(",").map((t) => t.trim()).filter(Boolean),
      contains_synthetic_media: form.get("synthetic") === "on",
    };
    await adminClient()
      .from("videos")
      .update({ metadata_json: metadata, thumbnail_url: thumbnail, contains_synthetic_media: metadata.contains_synthetic_media })
      .eq("id", videoId);
    revalidatePath(`/studio/${videoId}`);
    revalidatePath("/review");
    return ok("Metadata tersimpan.");
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ review
export async function approve(videoId: string, privacy: "private" | "unlisted" | "public", publishAt: string | null): Promise<ActionState> {
  try {
    const video = await ownVideo(videoId);
    if (video.status !== "review") throw new Error(`Hanya video berstatus review yang bisa disetujui (sekarang: ${video.status}).`);
    const { data: cred } = await adminClient().from("yt_credentials").select("channel_id").eq("channel_id", video.channel_id).maybeSingle();
    if (!cred) throw new Error("Hubungkan akun YouTube di Channel Setup sebelum menyetujui upload.");
    if (publishAt && new Date(publishAt).getTime() < Date.now() + 15 * 60_000) {
      throw new Error("Jadwal tayang minimal 15 menit dari sekarang.");
    }
    await approveVideo({ videoId, channelId: video.channel_id, privacy, publishAt });
    revalidatePath("/review");
    revalidatePath("/scheduler");
    return ok(publishAt ? "Disetujui & dijadwalkan." : "Disetujui. Masuk antrean upload.");
  } catch (e) {
    return fail(e);
  }
}

export async function reject(videoId: string, notes: string): Promise<ActionState> {
  try {
    const video = await ownVideo(videoId);
    await adminClient().from("videos").update({ status: "rejected", review_notes: notes || null }).eq("id", videoId);
    if (video.idea_id) await adminClient().from("ideas").update({ status: "backlog" }).eq("id", video.idea_id);
    revalidatePath("/review");
    return ok("Video ditolak. Ide dikembalikan ke backlog.");
  } catch (e) {
    return fail(e);
  }
}

export async function retry(videoId: string): Promise<ActionState> {
  try {
    await ownVideo(videoId);
    await retryVideo(videoId);
    revalidatePath("/", "layout");
    return ok("Tahap yang gagal diulang.");
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ analytics
export async function queueAnalytics(channelId: string, kind: "analytics_sync" | "report_weekly" | "report_monthly"): Promise<ActionState> {
  try {
    await assertChannel(channelId);
    const { data: cred } = await adminClient().from("yt_credentials").select("channel_id").eq("channel_id", channelId).maybeSingle();
    if (!cred) throw new Error("Hubungkan akun YouTube dulu.");
    await enqueue(kind, { channelId });
    revalidatePath("/analytics");
    return ok(kind === "analytics_sync" ? "Sinkronisasi analitik masuk antrean." : "Laporan masuk antrean.");
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ settings
export async function saveSettings(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const channelId = str(form, "channel_id");
    const { supabase, channel } = await assertChannel(channelId);
    const cur = channelSettings(channel);
    const n = (k: string, d: number, min: number, max: number) => Math.max(min, Math.min(max, Number(form.get(k) ?? d) || d));
    const next: ChannelSettings = {
      ...cur,
      auto_publish: form.get("auto_publish") === "on",
      auto_shorts: form.get("auto_shorts") === "on",
      daily_auto_produce: n("daily_auto_produce", 0, 0, 5),
      default_format: str(form, "default_format") === "short" ? "short" : "long",
      target_duration_sec: n("target_duration_sec", 480, 30, 3600),
      default_privacy: (["private", "unlisted", "public"].includes(str(form, "default_privacy")) ? str(form, "default_privacy") : "private") as ChannelSettings["default_privacy"],
      tts_provider: str(form, "tts_provider") === "elevenlabs" ? "elevenlabs" : "openai",
      tts_voice: str(form, "tts_voice") || "alloy",
      visual_style: str(form, "visual_style") || cur.visual_style,
      stock_provider: str(form, "stock_provider") === "pixabay" ? "pixabay" : "pexels",
      upload_daily_limit: n("upload_daily_limit", 3, 1, 20),
      category_id: str(form, "category_id") || "27",
    };
    const { error } = await supabase.from("channels").update({ settings: next }).eq("id", channelId);
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return ok("Pengaturan tersimpan.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveApiKey(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { user } = await requireUser();
    const name = str(form, "name") as SecretName;
    if (!(SECRET_NAMES as readonly string[]).includes(name)) throw new Error("Nama key tidak dikenal.");
    const value = str(form, "value");
    if (value.length < 8) throw new Error("Key terlalu pendek.");
    await setSecret(user.id, name, value);
    revalidatePath("/settings");
    return ok(`${name} tersimpan (terenkripsi di server).`);
  } catch (e) {
    return fail(e);
  }
}

/** Simpan Client ID & Secret OAuth Google (terenkripsi). Secret kosong = tidak diubah. */
export async function saveGoogleOAuth(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { user } = await requireUser();
    const clientId = str(form, "client_id");
    const clientSecret = str(form, "client_secret");
    if (clientId) {
      if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(clientId))
        throw new Error("Client ID harus berakhiran .apps.googleusercontent.com");
      await setSecret(user.id, "GOOGLE_CLIENT_ID", clientId);
    }
    if (clientSecret) {
      if (clientSecret.length < 10) throw new Error("Client Secret terlalu pendek.");
      await setSecret(user.id, "GOOGLE_CLIENT_SECRET", clientSecret);
    }
    if (!clientId && !clientSecret) throw new Error("Isi Client ID dan/atau Client Secret.");
    revalidatePath("/channel");
    revalidatePath("/settings");
    return ok("Kredensial Google tersimpan (terenkripsi). Sekarang klik Hubungkan YouTube.");
  } catch (e) {
    return fail(e);
  }
}

export async function removeGoogleOAuth(): Promise<ActionState> {
  try {
    const { user } = await requireUser();
    for (const n of GOOGLE_SECRET_NAMES) await deleteSecret(user.id, n);
    revalidatePath("/channel");
    revalidatePath("/settings");
    return ok("Kredensial Google dihapus.");
  } catch (e) {
    return fail(e);
  }
}

export async function removeApiKey(name: SecretName): Promise<ActionState> {
  try {
    const { user } = await requireUser();
    await deleteSecret(user.id, name);
    revalidatePath("/settings");
    return ok(`${name} dihapus.`);
  } catch (e) {
    return fail(e);
  }
}

export async function saveTemplate(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await requireUser();
    const mod = Number(form.get("module"));
    if (!(mod >= 1 && mod <= 7)) throw new Error("Modul tidak valid.");
    const template = str(form, "template");
    if (template.length < 50) throw new Error("Template terlalu pendek.");
    const { data: last } = await supabase
      .from("prompt_templates")
      .select("version,name")
      .eq("module", mod)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("prompt_templates").insert({
      user_id: user.id,
      module: mod,
      version: (last?.version ?? 0) + 1,
      name: last?.name ?? `Modul ${mod}`,
      template,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/settings");
    return ok(`Template M${mod} versi ${(last?.version ?? 0) + 1} aktif.`);
  } catch (e) {
    return fail(e);
  }
}
