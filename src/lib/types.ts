import type { M3Output } from "./ai/schemas";
import type { VideoMetadata } from "./pipeline/metadata";
import type { QcResult } from "./pipeline/qc";

export interface ChannelSettings {
  auto_publish: boolean;
  auto_shorts?: boolean;
  daily_auto_produce: number;
  default_format: "long" | "short";
  target_duration_sec: number;
  default_privacy: "private" | "unlisted" | "public";
  tts_provider: "openai" | "elevenlabs";
  tts_voice: string;
  visual_style: string;
  stock_provider: "pexels" | "pixabay";
  upload_daily_limit: number;
  category_id?: string;
}

export const DEFAULT_SETTINGS: ChannelSettings = {
  auto_publish: false,
  auto_shorts: true,
  daily_auto_produce: 0,
  default_format: "long",
  target_duration_sec: 480,
  default_privacy: "private",
  tts_provider: "openai",
  tts_voice: "alloy",
  visual_style: "clean, modern, high-contrast",
  stock_provider: "pexels",
  upload_daily_limit: 3,
  category_id: "27",
};

export interface Channel {
  id: string;
  user_id: string;
  name: string;
  niche: string | null;
  audience: string | null;
  competitors: string | null;
  resources: string | null;
  goals: string | null;
  language: string;
  positioning: string | null;
  plan_json: unknown;
  niche_json: unknown;
  growth_json: unknown;
  monetization_json: unknown;
  production_json: unknown;
  settings: Partial<ChannelSettings>;
  yt_channel_id: string | null;
  yt_channel_title: string | null;
  yt_thumbnail_url: string | null;
  created_at: string;
}

export function channelSettings(c: Pick<Channel, "settings">): ChannelSettings {
  return { ...DEFAULT_SETTINGS, ...(c.settings ?? {}) };
}

export type VideoStatus =
  | "queued" | "scripting" | "voicing" | "assets" | "rendering" | "qc" | "review"
  | "approved" | "uploading" | "uploaded" | "scheduled" | "published" | "rejected" | "failed";

export interface Video {
  id: string;
  channel_id: string;
  idea_id: string | null;
  script_id: string | null;
  parent_video_id: string | null;
  format: "long" | "short";
  target_duration_sec: number;
  duration_sec: number | null;
  render_url: string | null;
  thumbnail_url: string | null;
  srt_url: string | null;
  voice_url: string | null;
  metadata_json: VideoMetadata | null;
  qc_json: QcResult | null;
  contains_synthetic_media: boolean;
  review_notes: string | null;
  status: VideoStatus;
  created_at: string;
  updated_at: string;
}

export interface ScriptRow {
  id: string;
  channel_id: string;
  idea_id: string | null;
  json: M3Output;
  model: string | null;
  version: number;
  created_at: string;
}

export type JobStage =
  | "scripting" | "voicing" | "assets" | "rendering" | "qc" | "uploading"
  | "analytics_sync" | "report_weekly" | "report_monthly" | "auto_pick" | "module";

export interface Job {
  id: string;
  channel_id: string;
  video_id: string | null;
  stage: JobStage;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  error: string | null;
  logs: { t: string; m: string }[];
  run_after: string;
  created_at: string;
}

export const STATUS_LABEL: Record<VideoStatus, string> = {
  queued: "Antre",
  scripting: "Menulis skrip",
  voicing: "Voice-over",
  assets: "Aset & subtitle",
  rendering: "Render",
  qc: "QC",
  review: "Menunggu review",
  approved: "Disetujui",
  uploading: "Mengunggah",
  uploaded: "Terunggah (private)",
  scheduled: "Terjadwal",
  published: "Tayang",
  rejected: "Ditolak",
  failed: "Gagal",
};
