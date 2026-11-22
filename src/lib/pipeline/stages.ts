import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { adminClient } from "../supabase/admin";
import { runModule } from "../ai/run";
import type { M3Output, Scene } from "../ai/schemas";
import { channelSettings, type Channel, type Job, type ScriptRow, type Video } from "../types";
import { downloadTo, getObject, objectPath, putObject } from "../storage";
import { synthesize } from "./tts";
import { downloadFile, findStock } from "./stock";
import { buildCues, toSrt } from "./subtitles";
import { gradientPng, thumbnailPng } from "./graphics";
import { extractFrame, renderVideo, sceneTimeline } from "./render";
import { detectBlack, detectVolume, probeDuration } from "./ffmpeg";
import { buildMetadata } from "./metadata";
import { runQc } from "./qc";
import { jaccard } from "./similarity";
import { approveVideo, createVideoFromIdea, enqueue } from "./queue";
import { getMyChannel, setThumbnail, uploadVideo, YouTubeApiError } from "../youtube/api";
import { buildAnalyticsSummary, syncAnalytics } from "../youtube/sync";

/** Job ditunda tanpa dihitung sebagai kegagalan (mis. batas upload harian). */
export class DeferError extends Error {
  constructor(message: string, public readonly runAfter: Date) {
    super(message);
  }
}

export interface StageContext {
  job: Job;
  log: (m: string) => void;
}

const db = () => adminClient();

async function loadVideo(videoId: string) {
  const { data: video, error } = await db().from("videos").select("*").eq("id", videoId).single();
  if (error || !video) throw new Error(`Video ${videoId} tidak ditemukan`);
  const { data: channel } = await db().from("channels").select("*").eq("id", video.channel_id).single();
  if (!channel) throw new Error("Kanal tidak ditemukan");
  let script: ScriptRow | null = null;
  if (video.script_id) {
    const { data } = await db().from("scripts").select("*").eq("id", video.script_id).single();
    script = data as ScriptRow;
  }
  return { video: video as Video, channel: channel as Channel, script };
}

async function setVideo(videoId: string, patch: Partial<Video>) {
  const { error } = await db().from("videos").update(patch).eq("id", videoId);
  if (error) throw new Error(error.message);
}

async function tempDir(videoId: string) {
  const dir = path.join(os.tmpdir(), "earnyt", `${videoId}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

function startOfNextUtcDay() {
  const d = new Date();
  d.setUTCHours(24, 10, 0, 0); // 00:10 UTC hari berikutnya
  return d;
}

// ---------------------------------------------------------------- scripting
async function scripting({ job, log }: StageContext) {
  const { video, channel } = await loadVideo(job.video_id!);
  const s = channelSettings(channel);
  const { data: idea } = await db().from("ideas").select("*").eq("id", video.idea_id).single();
  if (!idea) throw new Error("Ide untuk video ini sudah dihapus.");
  await setVideo(video.id, { status: "scripting" });

  const { data: out, model } = await runModule({
    userId: channel.user_id,
    module: 3,
    vars: {
      idea_title: idea.title,
      idea_angle: idea.angle,
      duration: video.target_duration_sec,
      format: video.format,
      positioning: channel.positioning,
      visual_style: s.visual_style,
      language: channel.language,
    },
    onLog: log,
  });

  // Pastikan hook dibacakan di scene pertama (syarat QC: hook ≤ 5 detik).
  const first = out.scenes[0];
  if (!out.hooks.some((h) => jaccard(h, first.narration, 1) > 0.5)) {
    out.scenes.unshift({
      narration: out.hooks[0],
      visual_prompt: first.visual_prompt,
      stock_query: first.stock_query,
      duration_sec: 4,
      on_screen_text: out.thumbnail_concepts[0]?.text ?? "",
      chapter_title: "",
    });
    log("hook ditambahkan sebagai scene pembuka");
  }

  const { count } = await db().from("scripts").select("id", { count: "exact", head: true }).eq("idea_id", idea.id);
  const { data: script, error } = await db()
    .from("scripts")
    .insert({ channel_id: channel.id, idea_id: idea.id, json: out, model, version: (count ?? 0) + 1 })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await setVideo(video.id, { script_id: script.id, status: "voicing" });
  await enqueue("voicing", { channelId: channel.id, videoId: video.id });
  log(`skrip v${(count ?? 0) + 1}: ${out.scenes.length} scene`);
}

// ---------------------------------------------------------------- voicing
async function voicing({ job, log }: StageContext) {
  const { video, channel, script } = await loadVideo(job.video_id!);
  if (!script) throw new Error("Skrip belum ada");
  const s = channelSettings(channel);
  await setVideo(video.id, { status: "voicing" });
  await db().from("assets").delete().eq("video_id", video.id).eq("type", "voice");
  const dir = await tempDir(video.id);
  try {
    const scenes = script.json.scenes;
    for (let i = 0; i < scenes.length; i++) {
      const mp3 = await synthesize(scenes[i].narration, {
        userId: channel.user_id,
        provider: s.tts_provider,
        voice: s.tts_voice,
        language: channel.language,
      });
      const f = path.join(dir, `voice_${i}.mp3`);
      await writeFile(f, mp3);
      const duration = await probeDuration(f);
      const ref = await putObject("voices", objectPath(channel.id, video.id, `voice_${i}.mp3`), mp3, "audio/mpeg");
      await db().from("assets").insert({
        channel_id: channel.id,
        script_id: script.id,
        video_id: video.id,
        scene_index: i,
        type: "voice",
        url: ref,
        license_source: `Dibuat sendiri — TTS ${s.tts_provider} (${s.tts_voice})`,
        meta: { duration, provider: s.tts_provider, voice: s.tts_voice },
      });
      log(`voice scene ${i + 1}/${scenes.length}: ${duration.toFixed(1)} dtk`);
    }
    await setVideo(video.id, { status: "assets", contains_synthetic_media: true });
    await enqueue("assets", { channelId: channel.id, videoId: video.id });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function voiceDurations(videoId: string) {
  const { data } = await db()
    .from("assets")
    .select("scene_index,meta,url")
    .eq("video_id", videoId)
    .eq("type", "voice")
    .order("scene_index");
  return (data ?? []).map((a) => ({ index: a.scene_index as number, duration: Number(a.meta.duration), url: a.url as string }));
}

function cuesFor(scenes: Scene[], durs: number[]) {
  const { starts } = sceneTimeline(durs);
  return buildCues(scenes.map((s, i) => ({ narration: s.narration, start: starts[i], voiceDuration: durs[i] })));
}

// ---------------------------------------------------------------- assets
async function assets({ job, log }: StageContext) {
  const { video, channel, script } = await loadVideo(job.video_id!);
  if (!script) throw new Error("Skrip belum ada");
  const s = channelSettings(channel);
  await setVideo(video.id, { status: "assets" });
  await db().from("assets").delete().eq("video_id", video.id).in("type", ["image", "video", "subtitle"]);
  const orientation = video.format === "short" ? "portrait" : "landscape";
  const used = new Set<string>();
  const scenes = script.json.scenes;

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const q = sc.stock_query || sc.visual_prompt.split(/\s+/).slice(0, 4).join(" ");
    const item = await findStock(channel.user_id, q, orientation, used, s.stock_provider);
    if (item) {
      used.add(`${item.provider}:${item.externalId}`);
      const buf = await downloadFile(item.url);
      const ext = item.kind === "video" ? "mp4" : "jpg";
      const ref = await putObject(
        "assets",
        objectPath(channel.id, video.id, `scene_${i}.${ext}`),
        buf,
        item.kind === "video" ? "video/mp4" : "image/jpeg",
      );
      await db().from("assets").insert({
        channel_id: channel.id,
        script_id: script.id,
        video_id: video.id,
        scene_index: i,
        type: item.kind,
        url: ref,
        license_source: item.license_source,
        meta: { provider: item.provider, external_id: item.externalId, page_url: item.pageUrl, author: item.author, query: q },
      });
      log(`scene ${i + 1}: ${item.provider} ${item.kind} "${q}"`);
    } else {
      const { w, h } = video.format === "short" ? { w: 1080, h: 1920 } : { w: 1920, h: 1080 };
      const png = await gradientPng(w, h, i);
      const ref = await putObject("assets", objectPath(channel.id, video.id, `scene_${i}.png`), png, "image/png");
      await db().from("assets").insert({
        channel_id: channel.id,
        script_id: script.id,
        video_id: video.id,
        scene_index: i,
        type: "image",
        url: ref,
        license_source: "Dibuat sendiri — latar gradien EarnYoutube",
        meta: { generated: true, query: q },
      });
      log(`scene ${i + 1}: stok "${q}" tidak ditemukan → latar gradien`);
    }
  }

  const durs = (await voiceDurations(video.id)).map((v) => v.duration);
  const srt = toSrt(cuesFor(scenes, durs));
  const srtRef = await putObject("assets", objectPath(channel.id, video.id, "subtitles.srt"), Buffer.from(srt), "application/x-subrip");
  await db().from("assets").insert({
    channel_id: channel.id,
    script_id: script.id,
    video_id: video.id,
    type: "subtitle",
    url: srtRef,
    license_source: "Dibuat sendiri — dari skrip",
  });
  await setVideo(video.id, { srt_url: srtRef, status: "rendering" });
  await enqueue("rendering", { channelId: channel.id, videoId: video.id });
}

// ---------------------------------------------------------------- rendering
async function rendering({ job, log }: StageContext) {
  const { video, channel, script } = await loadVideo(job.video_id!);
  if (!script) throw new Error("Skrip belum ada");
  const s = channelSettings(channel);
  await setVideo(video.id, { status: "rendering" });
  const dir = await tempDir(video.id);
  try {
    const scenes = script.json.scenes;
    const voices = await voiceDurations(video.id);
    const { data: visuals } = await db()
      .from("assets")
      .select("*")
      .eq("video_id", video.id)
      .in("type", ["image", "video"])
      .order("scene_index");
    if (voices.length !== scenes.length || (visuals ?? []).length !== scenes.length) {
      throw new Error(`Aset tidak lengkap: ${voices.length} voice, ${(visuals ?? []).length} visual untuk ${scenes.length} scene`);
    }
    const renderScenes = [];
    for (let i = 0; i < scenes.length; i++) {
      const v = visuals!.find((a) => a.scene_index === i)!;
      const ext = v.url.split(".").pop();
      const visualFile = await downloadTo(v.url, path.join(dir, `visual_${i}.${ext}`));
      const voiceFile = await downloadTo(voices[i].url, path.join(dir, `voice_${i}.mp3`));
      renderScenes.push({
        visualFile,
        visualKind: v.type as "video" | "image",
        voiceFile,
        voiceDuration: voices[i].duration,
        onScreenText: scenes[i].on_screen_text ?? "",
      });
    }
    const cues = cuesFor(scenes, voices.map((v) => v.duration));
    const out = await renderVideo({ workdir: dir, format: video.format, scenes: renderScenes, cues, log });
    const renderRef = await putObject("renders", objectPath(channel.id, video.id, "final.mp4"), await readFile(out.file), "video/mp4");
    log(`render selesai: ${out.duration.toFixed(1)} dtk`);

    // Thumbnail: 3 varian dari 3 konsep M3, latar dari scene berbeda.
    const thumbs: string[] = [];
    const concepts = script.json.thumbnail_concepts.slice(0, video.format === "short" ? 1 : 3);
    for (let k = 0; k < concepts.length; k++) {
      const sc = renderScenes[Math.min(k, renderScenes.length - 1)];
      let bg: Buffer | null = null;
      try {
        bg =
          sc.visualKind === "video"
            ? await readFile(await extractFrame(sc.visualFile, path.join(dir, `frame_${k}.jpg`), 1))
            : await readFile(sc.visualFile);
      } catch {
        bg = null;
      }
      const png = await thumbnailPng(bg, concepts[k].text, k);
      thumbs.push(await putObject("thumbnails", objectPath(channel.id, video.id, `thumb_${k}.png`), png, "image/png"));
    }

    const credits = (visuals ?? [])
      .filter((a) => !a.meta?.generated && a.license_source)
      .map((a) => a.license_source as string);
    const metadata = buildMetadata({
      script: script.json,
      format: video.format,
      sceneStarts: out.sceneStarts,
      duration: out.duration,
      credits,
      language: channel.language,
      categoryId: s.category_id,
      containsSyntheticMedia: true,
      thumbnailOptions: thumbs,
    });
    await setVideo(video.id, {
      render_url: renderRef,
      thumbnail_url: thumbs[0] ?? null,
      duration_sec: out.duration,
      metadata_json: metadata,
      status: "qc",
    });

    if (video.format === "long" && s.auto_shorts !== false) await spawnShort(video, channel, script.json, log);
    await enqueue("qc", { channelId: channel.id, videoId: video.id });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Repurpose: buat video Shorts 9:16 dari potongan skrip (M3.shorts_cut). */
async function spawnShort(parent: Video, channel: Channel, script: M3Output, log: (m: string) => void) {
  const { count } = await db().from("videos").select("id", { count: "exact", head: true }).eq("parent_video_id", parent.id);
  if (count) return;
  const idx = script.shorts_cut.scene_indexes.filter((i) => i >= 0 && i < script.scenes.length);
  if (!idx.length) return;
  const chosen: Scene[] = [];
  let est = 4;
  for (const i of idx) {
    if (est + script.scenes[i].duration_sec > 52) break;
    chosen.push({ ...script.scenes[i], chapter_title: "" });
    est += script.scenes[i].duration_sec;
  }
  if (!chosen.length) return;
  const hookScene: Scene = {
    narration: script.shorts_cut.hook || script.hooks[0],
    visual_prompt: chosen[0].visual_prompt,
    stock_query: chosen[0].stock_query,
    duration_sec: 4,
    on_screen_text: script.thumbnail_concepts[0]?.text ?? "",
    chapter_title: "",
  };
  const shortJson: M3Output = {
    ...script,
    titles: [script.shorts_cut.title || script.titles[0], ...script.titles.slice(1)],
    scenes: [hookScene, ...chosen],
    description: script.description,
  };
  const { data: sc } = await db()
    .from("scripts")
    .insert({ channel_id: channel.id, idea_id: parent.idea_id, json: shortJson, model: "repurpose", version: 1 })
    .select("id")
    .single();
  const { data: child } = await db()
    .from("videos")
    .insert({
      channel_id: channel.id,
      idea_id: parent.idea_id,
      script_id: sc!.id,
      parent_video_id: parent.id,
      format: "short",
      target_duration_sec: 55,
      status: "voicing",
    })
    .select("id")
    .single();
  await enqueue("voicing", { channelId: channel.id, videoId: child!.id });
  log(`Shorts dibuat dari ${chosen.length} scene → video ${child!.id}`);
}

// ---------------------------------------------------------------- qc
async function qc({ job, log }: StageContext) {
  const { video, channel, script } = await loadVideo(job.video_id!);
  if (!script || !video.render_url || !video.metadata_json) throw new Error("Render belum ada");
  const s = channelSettings(channel);
  await setVideo(video.id, { status: "qc" });
  const dir = await tempDir(video.id);
  try {
    const file = await downloadTo(video.render_url, path.join(dir, "final.mp4"));
    const duration = await probeDuration(file);
    const black = await detectBlack(file);
    const vol = await detectVolume(file);
    const voices = await voiceDurations(video.id);
    const { data: all } = await db().from("assets").select("type,scene_index,license_source").eq("video_id", video.id);
    const scenes = script.json.scenes;
    const visualScenes = new Set((all ?? []).filter((a) => a.type === "image" || a.type === "video").map((a) => a.scene_index));
    const { data: prev } = await db()
      .from("videos")
      .select("id,parent_video_id,metadata_json,scripts(json)")
      .eq("channel_id", channel.id)
      .neq("id", video.id)
      .not("metadata_json", "is", null);
    // Shorts adalah turunan video induknya: induk, saudara, dan anak tidak dibandingkan.
    const family = new Set([video.id, video.parent_video_id].filter(Boolean));
    const previous = (prev ?? [])
      .filter((p) => !family.has(p.id) && !family.has(p.parent_video_id) && p.parent_video_id !== video.id)
      .map((p) => {
        const sj = (Array.isArray(p.scripts) ? p.scripts[0] : p.scripts) as { json: M3Output } | null;
        return {
          id: p.id as string,
          title: (p.metadata_json as { title: string }).title,
          script: sj?.json.scenes.map((x) => x.narration).join(" ") ?? "",
        };
      });
    const result = runQc({
      format: video.format,
      targetDuration: video.target_duration_sec,
      duration,
      script: script.json,
      voiceDurations: voices.map((v) => v.duration),
      sceneHasVisual: scenes.map((_, i) => visualScenes.has(i)),
      blackSegments: black,
      audioMaxDb: vol.maxDb,
      cues: cuesFor(scenes, voices.map((v) => v.duration)),
      assetsMissingLicense: (all ?? []).filter((a) => !a.license_source).length,
      metadata: video.metadata_json,
      usedTts: true,
      previous,
    });
    await setVideo(video.id, { qc_json: result, status: "review", duration_sec: duration });
    log(`QC ${result.passed ? "lolos" : "ada catatan"}: ${result.checks.filter((c) => !c.pass).map((c) => c.id).join(", ") || "semua lolos"}`);

    // Auto-publish hanya jika diaktifkan eksplisit DAN QC lolos semua.
    if (s.auto_publish && result.passed) {
      await approveVideo({ videoId: video.id, channelId: channel.id, privacy: s.default_privacy, publishAt: null });
      log("auto-publish aktif: video otomatis disetujui");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- uploading
async function uploading({ job, log }: StageContext) {
  const { video, channel } = await loadVideo(job.video_id!);
  const s = channelSettings(channel);
  const uploadId = job.payload.upload_id as string;
  const { data: up } = await db().from("uploads").select("*").eq("id", uploadId).single();
  if (!up) throw new Error("Data upload tidak ditemukan");
  if (!["approved", "uploading"].includes(video.status)) {
    throw new Error(`Video berstatus "${video.status}", bukan "approved" — upload dibatalkan.`);
  }
  if (!video.render_url || !video.metadata_json) throw new Error("Render/metadata belum ada");

  // Rate limit: batas upload per hari per kanal (hemat kuota YouTube Data API).
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await db()
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", channel.id)
    .in("status", ["uploaded", "scheduled", "published"])
    .gte("updated_at", dayStart.toISOString());
  if ((count ?? 0) >= s.upload_daily_limit) {
    throw new DeferError(`Batas ${s.upload_daily_limit} upload/hari tercapai`, startOfNextUtcDay());
  }

  await setVideo(video.id, { status: "uploading" });
  await db().from("uploads").update({ status: "uploading", error: null }).eq("id", uploadId);
  const dir = await tempDir(video.id);
  try {
    const file = await downloadTo(video.render_url, path.join(dir, "final.mp4"));
    const m = video.metadata_json;
    let ytId: string;
    try {
      ytId = await uploadVideo(
        channel.id,
        file,
        {
          title: m.title,
          description: m.description,
          tags: m.tags,
          categoryId: m.categoryId,
          defaultLanguage: m.defaultLanguage,
          privacyStatus: up.privacy,
          publishAt: up.publish_at,
          containsSyntheticMedia: video.contains_synthetic_media,
        },
        (p) => p % 25 === 0 && log(`upload ${p}%`),
      );
    } catch (e) {
      if (e instanceof YouTubeApiError && e.quotaExceeded) {
        await db().from("uploads").update({ status: "queued", error: e.message }).eq("id", uploadId);
        await setVideo(video.id, { status: "approved" });
        throw new DeferError(`Kuota YouTube habis: ${e.message}`, startOfNextUtcDay());
      }
      throw e;
    }
    log(`terunggah: https://youtu.be/${ytId}`);

    if (video.thumbnail_url && video.format === "long") {
      try {
        await setThumbnail(channel.id, ytId, await getObject(video.thumbnail_url));
        log("thumbnail kustom terpasang");
      } catch (e) {
        log(`thumbnail gagal dipasang (kanal mungkin belum terverifikasi): ${(e as Error).message}`);
      }
    }
    const status = up.publish_at ? "scheduled" : up.privacy === "public" ? "published" : "uploaded";
    await db().from("uploads").update({ yt_video_id: ytId, status }).eq("id", uploadId);
    await setVideo(video.id, { status });
  } catch (e) {
    if (!(e instanceof DeferError)) {
      await db().from("uploads").update({ status: "failed", error: (e as Error).message }).eq("id", uploadId);
    }
    throw e;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------- analytics & laporan
async function analyticsSync({ job, log }: StageContext) {
  const r = await syncAnalytics(job.channel_id, { log });
  try {
    const me = await getMyChannel(job.channel_id);
    await db().from("channels").update({ yt_channel_title: me.title, yt_thumbnail_url: me.thumbnail }).eq("id", job.channel_id);
  } catch {
    /* opsional */
  }
  log(`sinkron analitik: ${r.channelDays} hari, ${r.videos} video`);
}

async function report(period: "weekly" | "monthly", { job, log }: StageContext) {
  const { data: channel } = await db().from("channels").select("*").eq("id", job.channel_id).single();
  if (!channel) throw new Error("Kanal tidak ditemukan");
  const days = period === "weekly" ? 7 : 30;
  const summary = await buildAnalyticsSummary(channel.id, days);
  const { data: out } = await runModule({
    userId: channel.user_id,
    module: 7,
    vars: {
      channel_name: channel.yt_channel_title ?? channel.name,
      period: `${period === "weekly" ? "Mingguan" : "Bulanan"} ${summary.period.from} s/d ${summary.period.to}`,
      analytics_json: summary,
      language: channel.language,
    },
    onLog: log,
  });
  await db().from("reports").insert({
    channel_id: channel.id,
    period,
    period_start: summary.period.from,
    period_end: summary.period.to,
    json: out,
  });
  // Feedback loop: ide dari laporan masuk ke backlog.
  if (out.next_ideas.length) {
    await db().from("ideas").insert(
      out.next_ideas.map((i) => ({
        channel_id: channel.id,
        title: i.title,
        angle: i.angle,
        reason: i.reason,
        score: 75,
        source: "m7",
        status: "backlog",
      })),
    );
  }
  log(`laporan ${period} tersimpan, ${out.next_ideas.length} ide baru ke backlog`);
}

async function autoPick({ job, log }: StageContext) {
  const { data: channel } = await db().from("channels").select("*").eq("id", job.channel_id).single();
  if (!channel) throw new Error("Kanal tidak ditemukan");
  const s = channelSettings(channel as Channel);
  const n = Number(job.payload.count ?? s.daily_auto_produce ?? 0);
  if (n <= 0) return;
  const { data: ideas } = await db()
    .from("ideas")
    .select("id,title")
    .eq("channel_id", channel.id)
    .eq("status", "backlog")
    .order("score", { ascending: false })
    .limit(n);
  for (const i of ideas ?? []) {
    await createVideoFromIdea({ channelId: channel.id, ideaId: i.id, format: s.default_format, targetDurationSec: s.target_duration_sec });
    log(`ide dipilih otomatis: ${i.title}`);
  }
}

// ---------------------------------------------------------------- modul kanal (M1, M2, M4, M5, M6)
async function channelStats(channelId: string) {
  const { analyticsQuery } = await import("../youtube/api");
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = fmt(new Date(Date.now() - 86_400_000));
  const me = await getMyChannel(channelId);
  const stats: Record<string, unknown> = {
    subscribers: me.subscribers,
    total_views: me.views,
    video_count: me.videoCount,
  };
  try {
    const [r] = await analyticsQuery(channelId, {
      startDate: fmt(new Date(Date.now() - 365 * 86_400_000)),
      endDate: end,
      metrics: ["estimatedMinutesWatched", "views"],
    });
    stats.watch_hours_12m = r ? Math.round(Number(r.estimatedMinutesWatched) / 60) : 0;
  } catch {
    stats.watch_hours_12m = "tidak tersedia";
  }
  try {
    const rows = await analyticsQuery(channelId, {
      startDate: fmt(new Date(Date.now() - 90 * 86_400_000)),
      endDate: end,
      metrics: ["views"],
      dimensions: ["creatorContentType"],
    });
    stats.shorts_views_90d = Number(rows.find((x) => String(x.creatorContentType).toLowerCase() === "shorts")?.views ?? 0);
  } catch {
    stats.shorts_views_90d = "tidak tersedia";
  }
  return stats;
}

async function channelModule({ job, log }: StageContext) {
  const { data: channel } = await db().from("channels").select("*").eq("id", job.channel_id).single();
  if (!channel) throw new Error("Kanal tidak ditemukan");
  const c = channel as Channel;
  const mod = Number(job.payload.module) as 1 | 2 | 4 | 5 | 6;
  const { data: cred } = await db().from("yt_credentials").select("channel_id").eq("channel_id", c.id).maybeSingle();
  const base = {
    niche: c.niche,
    audience: c.audience,
    competitors: c.competitors,
    resources: c.resources,
    goals: c.goals,
    language: c.language,
    channel_name: c.yt_channel_title ?? c.name,
  };

  if (mod === 1) {
    const { data } = await runModule({ userId: c.user_id, module: 1, vars: base, onLog: log });
    await db().from("channels").update({ plan_json: data, positioning: data.positioning }).eq("id", c.id);
  } else if (mod === 2) {
    const { data: existing } = await db().from("ideas").select("title").eq("channel_id", c.id).limit(300);
    const plan = c.plan_json as { positioning?: string; content_pillars?: { name: string }[] } | null;
    const { data } = await runModule({
      userId: c.user_id,
      module: 2,
      vars: {
        ...base,
        count: job.payload.count ?? 100,
        plan_summary: plan ? `${plan.positioning ?? ""} | Pilar: ${(plan.content_pillars ?? []).map((p) => p.name).join(", ")}` : "",
        existing_titles: (existing ?? []).map((e) => e.title).join(" | "),
      },
      onLog: log,
    });
    const { ideas, ...rest } = data;
    await db().from("channels").update({ niche_json: rest }).eq("id", c.id);
    const known = new Set((existing ?? []).map((e) => e.title.toLowerCase().trim()));
    const fresh = ideas.filter((i) => !known.has(i.title.toLowerCase().trim()));
    if (fresh.length) {
      const { error } = await db().from("ideas").insert(
        fresh.map((i) => ({
          channel_id: c.id,
          title: i.title.slice(0, 200),
          angle: i.angle,
          category: i.category,
          score: Math.max(0, Math.min(100, i.score)),
          reason: i.reason,
          source: "m2",
          status: "backlog",
        })),
      );
      if (error) throw new Error(error.message);
    }
    log(`${fresh.length} ide baru masuk backlog`);
  } else if (mod === 4) {
    const summary = cred ? await buildAnalyticsSummary(c.id, 28) : null;
    const { data } = await runModule({
      userId: c.user_id,
      module: 4,
      vars: { ...base, analytics_summary: summary ?? "belum ada data" },
      onLog: log,
    });
    await db().from("channels").update({ growth_json: data }).eq("id", c.id);
  } else if (mod === 5) {
    const { data } = await runModule({ userId: c.user_id, module: 5, vars: base, onLog: log });
    await db().from("channels").update({ production_json: data }).eq("id", c.id);
  } else if (mod === 6) {
    const stats = cred ? await channelStats(c.id) : { catatan: "akun YouTube belum terhubung; anggap kanal baru (0 subscriber)" };
    const { data } = await runModule({ userId: c.user_id, module: 6, vars: { ...base, channel_stats: stats }, onLog: log });
    await db().from("channels").update({ monetization_json: { ...data, stats, generated_at: new Date().toISOString() } }).eq("id", c.id);
  } else {
    throw new Error(`Modul ${mod} tidak dijalankan lewat tahap ini`);
  }
  log(`M${mod} tersimpan`);
}

export const STAGE_HANDLERS: Record<Job["stage"], (ctx: StageContext) => Promise<void>> = {
  module: channelModule,
  scripting,
  voicing,
  assets,
  rendering,
  qc,
  uploading,
  analytics_sync: analyticsSync,
  report_weekly: (c) => report("weekly", c),
  report_monthly: (c) => report("monthly", c),
  auto_pick: autoPick,
};
