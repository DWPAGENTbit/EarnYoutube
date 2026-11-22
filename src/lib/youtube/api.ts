import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { getAccessToken } from "./oauth";

const DATA_API = "https://www.googleapis.com/youtube/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/youtube/v3";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";

export class YouTubeApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly reason?: string) {
    super(message);
  }
  /** Error yang layak dicoba ulang (kuota habis tidak termasuk: tunggu reset harian). */
  get retryable() {
    return this.status >= 500 || this.status === 429;
  }
  get quotaExceeded() {
    return this.reason === "quotaExceeded" || this.reason === "uploadLimitExceeded";
  }
}

async function ytFetch(channelId: string, url: string, init: RequestInit = {}) {
  const token = await getAccessToken(channelId);
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok && res.status !== 308) {
    let msg = `${res.status}`;
    let reason: string | undefined;
    try {
      const j = await res.json();
      msg = j.error?.message ?? msg;
      reason = j.error?.errors?.[0]?.reason;
    } catch {
      /* body bukan JSON */
    }
    throw new YouTubeApiError(`YouTube API: ${msg}`, res.status, reason);
  }
  return res;
}

export async function getMyChannel(channelId: string) {
  const res = await ytFetch(channelId, `${DATA_API}/channels?part=snippet,statistics,contentDetails&mine=true`);
  const j = await res.json();
  const c = j.items?.[0];
  if (!c) throw new Error("Akun Google ini belum punya kanal YouTube.");
  return {
    id: c.id as string,
    title: c.snippet.title as string,
    thumbnail: c.snippet.thumbnails?.default?.url as string | undefined,
    subscribers: Number(c.statistics.subscriberCount ?? 0),
    views: Number(c.statistics.viewCount ?? 0),
    videoCount: Number(c.statistics.videoCount ?? 0),
    uploadsPlaylist: c.contentDetails?.relatedPlaylists?.uploads as string | undefined,
  };
}

export interface UploadMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage?: string;
  privacyStatus: "private" | "unlisted" | "public";
  /** ISO 8601. YouTube mensyaratkan privacyStatus=private agar publishAt berlaku. */
  publishAt?: string | null;
  containsSyntheticMedia: boolean;
  madeForKids?: boolean;
}

/**
 * Upload resumable (videos.insert). Dikirim per potongan 8 MiB; bila
 * koneksi putus, status upload ditanyakan ulang lalu dilanjutkan.
 */
export async function uploadVideo(
  channelId: string,
  filePath: string,
  meta: UploadMetadata,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const size = (await stat(filePath)).size;
  const body = {
    snippet: {
      title: meta.title.slice(0, 100),
      description: meta.description.slice(0, 5000),
      tags: meta.tags,
      categoryId: meta.categoryId,
      defaultLanguage: meta.defaultLanguage,
      defaultAudioLanguage: meta.defaultLanguage,
    },
    status: {
      privacyStatus: meta.publishAt ? "private" : meta.privacyStatus,
      publishAt: meta.publishAt ?? undefined,
      selfDeclaredMadeForKids: meta.madeForKids ?? false,
      containsSyntheticMedia: meta.containsSyntheticMedia,
    },
  };
  const init = await ytFetch(
    channelId,
    `${UPLOAD_API}/videos?uploadType=resumable&part=snippet,status&notifySubscribers=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(size),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(body),
    },
  );
  const sessionUrl = init.headers.get("location");
  if (!sessionUrl) throw new Error("YouTube tidak mengembalikan URL sesi upload.");

  const CHUNK = 8 * 1024 * 1024; // kelipatan 256 KiB
  let offset = 0;
  let failures = 0;
  while (offset < size) {
    const end = Math.min(offset + CHUNK, size) - 1;
    try {
      const chunk = await readRange(filePath, offset, end);
      const res = await ytFetch(channelId, sessionUrl, {
        method: "PUT",
        headers: { "Content-Length": String(chunk.length), "Content-Range": `bytes ${offset}-${end}/${size}` },
        body: new Uint8Array(chunk),
      });
      if (res.status === 308) {
        offset = nextOffset(res.headers.get("range"));
      } else {
        const j = await res.json();
        onProgress?.(100);
        return j.id as string;
      }
      failures = 0;
      onProgress?.(Math.round((offset / size) * 100));
    } catch (e) {
      if (e instanceof YouTubeApiError && !e.retryable) throw e;
      if (++failures > 5) throw e;
      await new Promise((r) => setTimeout(r, 2 ** failures * 1000));
      // Tanyakan berapa byte yang sudah diterima server.
      const res = await ytFetch(channelId, sessionUrl, {
        method: "PUT",
        headers: { "Content-Length": "0", "Content-Range": `bytes */${size}` },
      });
      if (res.status !== 308) {
        const j = await res.json();
        return j.id as string;
      }
      offset = nextOffset(res.headers.get("range"));
    }
  }
  throw new Error("Upload berakhir tanpa ID video.");
}

function nextOffset(range: string | null) {
  // Format: "bytes=0-12345"
  if (!range) return 0;
  const m = range.match(/-(\d+)$/);
  return m ? Number(m[1]) + 1 : 0;
}

async function readRange(path: string, start: number, end: number): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const c of createReadStream(path, { start, end })) parts.push(c as Buffer);
  return Buffer.concat(parts);
}

/** Thumbnail kustom (butuh kanal terverifikasi; error tidak menggagalkan upload). */
export async function setThumbnail(channelId: string, ytVideoId: string, png: Buffer) {
  await ytFetch(channelId, `${UPLOAD_API}/thumbnails/set?videoId=${ytVideoId}`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: new Uint8Array(png),
  });
}

export async function listRecentUploads(channelId: string, max = 50) {
  const ch = await getMyChannel(channelId);
  if (!ch.uploadsPlaylist) return [];
  const res = await ytFetch(
    channelId,
    `${DATA_API}/playlistItems?part=contentDetails,snippet&maxResults=${max}&playlistId=${ch.uploadsPlaylist}`,
  );
  const j = await res.json();
  return (j.items ?? []).map((i: { contentDetails: { videoId: string }; snippet: { title: string; publishedAt: string } }) => ({
    videoId: i.contentDetails.videoId,
    title: i.snippet.title,
    publishedAt: i.snippet.publishedAt,
  }));
}

export interface AnalyticsQuery {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  metrics: string[];
  dimensions?: string[];
  filters?: string;
  sort?: string;
  maxResults?: number;
}

/** YouTube Analytics API reports.query → array objek {kolom: nilai}. */
export async function analyticsQuery(channelId: string, q: AnalyticsQuery) {
  const u = new URL(ANALYTICS_API);
  u.searchParams.set("ids", "channel==MINE");
  u.searchParams.set("startDate", q.startDate);
  u.searchParams.set("endDate", q.endDate);
  u.searchParams.set("metrics", q.metrics.join(","));
  if (q.dimensions?.length) u.searchParams.set("dimensions", q.dimensions.join(","));
  if (q.filters) u.searchParams.set("filters", q.filters);
  if (q.sort) u.searchParams.set("sort", q.sort);
  if (q.maxResults) u.searchParams.set("maxResults", String(q.maxResults));
  const res = await ytFetch(channelId, u.toString());
  const j = await res.json();
  const cols: string[] = (j.columnHeaders ?? []).map((h: { name: string }) => h.name);
  return (j.rows ?? []).map((r: unknown[]) => Object.fromEntries(cols.map((c, i) => [c, r[i]]))) as Record<
    string,
    string | number
  >[];
}

/** Ambil judul video (videos.list, 1 unit per 50 video). */
export async function getVideoTitles(channelId: string, ids: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const res = await ytFetch(channelId, `${DATA_API}/videos?part=snippet&id=${ids.slice(i, i + 50).join(",")}`);
    const j = await res.json();
    for (const v of j.items ?? []) out[v.id] = v.snippet.title;
  }
  return out;
}
