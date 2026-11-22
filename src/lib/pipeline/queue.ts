import { adminClient } from "../supabase/admin";
import type { JobStage } from "../types";

/** Masukkan job ke antrean worker. */
export async function enqueue(
  stage: JobStage,
  opts: { channelId: string; videoId?: string | null; payload?: Record<string, unknown>; runAfter?: Date },
) {
  const { data, error } = await adminClient()
    .from("jobs")
    .insert({
      stage,
      channel_id: opts.channelId,
      video_id: opts.videoId ?? null,
      payload: opts.payload ?? {},
      run_after: (opts.runAfter ?? new Date()).toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Buat video dari ide backlog dan mulai pipeline dari tahap skrip. */
export async function createVideoFromIdea(opts: {
  channelId: string;
  ideaId: string;
  format: "long" | "short";
  targetDurationSec: number;
}) {
  const db = adminClient();
  const { data: video, error } = await db
    .from("videos")
    .insert({
      channel_id: opts.channelId,
      idea_id: opts.ideaId,
      format: opts.format,
      target_duration_sec: opts.format === "short" ? Math.min(opts.targetDurationSec, 55) : opts.targetDurationSec,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await db.from("ideas").update({ status: "picked" }).eq("id", opts.ideaId);
  await enqueue("scripting", { channelId: opts.channelId, videoId: video.id });
  return video.id as string;
}

/** Ulangi tahap yang gagal: buat job baru di tahap yang sama. */
export async function retryVideo(videoId: string) {
  const db = adminClient();
  const { data: last } = await db
    .from("jobs")
    .select("stage,channel_id,payload")
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (!last) throw new Error("Tidak ada job untuk video ini.");
  const statusForStage: Record<string, string> = {
    scripting: "scripting",
    voicing: "voicing",
    assets: "assets",
    rendering: "rendering",
    qc: "qc",
    uploading: "approved",
  };
  await db.from("videos").update({ status: statusForStage[last.stage] ?? "queued" }).eq("id", videoId);
  if (last.stage === "uploading") {
    await db.from("uploads").update({ status: "queued", error: null }).eq("video_id", videoId).eq("status", "failed");
  }
  return enqueue(last.stage as JobStage, { channelId: last.channel_id, videoId, payload: last.payload });
}

/** Setujui video → buat antrean upload (privacy & jadwal dari reviewer). */
export async function approveVideo(opts: {
  videoId: string;
  channelId: string;
  privacy: "private" | "unlisted" | "public";
  publishAt: string | null;
}) {
  const db = adminClient();
  await db.from("videos").update({ status: "approved" }).eq("id", opts.videoId);
  const { data: up, error } = await db
    .from("uploads")
    .insert({
      channel_id: opts.channelId,
      video_id: opts.videoId,
      privacy: opts.publishAt ? "private" : opts.privacy,
      publish_at: opts.publishAt,
      status: "queued",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await enqueue("uploading", { channelId: opts.channelId, videoId: opts.videoId, payload: { upload_id: up.id } });
}
