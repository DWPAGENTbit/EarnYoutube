import { adminClient } from "../supabase/admin";
import { analyticsQuery, getVideoTitles } from "./api";

const fmt = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => fmt(new Date(Date.now() - n * 86_400_000));

const BASE_METRICS = [
  "views",
  "estimatedMinutesWatched",
  "averageViewDuration",
  "averageViewPercentage",
  "subscribersGained",
  "subscribersLost",
];
// Metrik impressions/CTR thumbnail. Jika API menolak (belum tersedia untuk
// kanal/akun), sinkronisasi tetap jalan tanpa kolom ini.
const IMPRESSION_METRICS = ["videoThumbnailImpressions", "videoThumbnailImpressionsClickRate"];

async function tryImpressions(channelId: string, q: Parameters<typeof analyticsQuery>[1]) {
  try {
    return await analyticsQuery(channelId, { ...q, metrics: IMPRESSION_METRICS });
  } catch {
    return [];
  }
}

/**
 * Sinkronisasi analitik harian ke tabel analytics_daily.
 * Data YouTube Analytics biasanya tertunda 2–3 hari, jadi rentang default
 * 28 hari terakhir di-upsert ulang setiap hari.
 */
export async function syncAnalytics(channelId: string, opts: { days?: number; log?: (m: string) => void } = {}) {
  const db = adminClient();
  const days = opts.days ?? 28;
  const startDate = daysAgo(days);
  const endDate = daysAgo(1);
  const log = opts.log ?? (() => undefined);

  // 1) Agregat kanal per hari
  const daily = await analyticsQuery(channelId, { startDate, endDate, metrics: BASE_METRICS, dimensions: ["day"] });
  const dailyImp = await tryImpressions(channelId, { startDate, endDate, metrics: [], dimensions: ["day"] });
  const impByDay = new Map(dailyImp.map((r) => [r.day as string, r]));

  // 2) Sumber trafik (agregat rentang) disimpan di baris hari terakhir
  let traffic: Record<string, number> = {};
  try {
    const t = await analyticsQuery(channelId, {
      startDate,
      endDate,
      metrics: ["views"],
      dimensions: ["insightTrafficSourceType"],
      sort: "-views",
    });
    traffic = Object.fromEntries(t.map((r) => [String(r.insightTrafficSourceType), Number(r.views)]));
  } catch (e) {
    log(`traffic sources dilewati: ${(e as Error).message}`);
  }

  const channelRows = daily.map((r) => {
    const imp = impByDay.get(r.day as string);
    return {
      channel_id: channelId,
      yt_video_id: "__channel__",
      date: r.day,
      views: Number(r.views),
      watch_time_minutes: Number(r.estimatedMinutesWatched),
      avg_view_duration: Number(r.averageViewDuration),
      avg_view_percentage: Number(r.averageViewPercentage),
      subs_gained: Number(r.subscribersGained),
      subs_lost: Number(r.subscribersLost),
      impressions: imp ? Number(imp.videoThumbnailImpressions) : null,
      ctr: imp ? Number(imp.videoThumbnailImpressionsClickRate) : null,
      traffic_sources: r.day === endDate ? traffic : null,
      revenue: null, // butuh scope yt-analytics-monetary.readonly (belum diminta)
    };
  });
  if (channelRows.length) {
    const { error } = await db.from("analytics_daily").upsert(channelRows);
    if (error) throw new Error(error.message);
  }
  log(`kanal: ${channelRows.length} hari tersimpan`);

  // 3) Per video: video yang diunggah lewat platform + 25 teratas di rentang ini
  const top = await analyticsQuery(channelId, {
    startDate,
    endDate,
    metrics: ["views"],
    dimensions: ["video"],
    sort: "-views",
    maxResults: 25,
  });
  const { data: ups } = await db
    .from("uploads")
    .select("yt_video_id")
    .eq("channel_id", channelId)
    .not("yt_video_id", "is", null);
  const ids = Array.from(new Set([...top.map((r) => String(r.video)), ...(ups ?? []).map((u) => u.yt_video_id as string)]));

  let saved = 0;
  for (const vid of ids) {
    const rows = await analyticsQuery(channelId, {
      startDate,
      endDate,
      metrics: BASE_METRICS,
      dimensions: ["day"],
      filters: `video==${vid}`,
    });
    const imp = await tryImpressions(channelId, { startDate, endDate, metrics: [], dimensions: ["day"], filters: `video==${vid}` });
    const impMap = new Map(imp.map((r) => [r.day as string, r]));
    let retention: unknown = null;
    try {
      retention = await analyticsQuery(channelId, {
        startDate: daysAgo(365),
        endDate,
        metrics: ["audienceWatchRatio"],
        dimensions: ["elapsedVideoTimeRatio"],
        filters: `video==${vid}`,
      });
    } catch {
      /* retensi tidak tersedia untuk video dengan tayangan sedikit */
    }
    const lastDay = rows.at(-1)?.day;
    const payload = rows.map((r) => {
      const i = impMap.get(r.day as string);
      return {
        channel_id: channelId,
        yt_video_id: vid,
        date: r.day,
        views: Number(r.views),
        watch_time_minutes: Number(r.estimatedMinutesWatched),
        avg_view_duration: Number(r.averageViewDuration),
        avg_view_percentage: Number(r.averageViewPercentage),
        subs_gained: Number(r.subscribersGained),
        subs_lost: Number(r.subscribersLost),
        impressions: i ? Number(i.videoThumbnailImpressions) : null,
        ctr: i ? Number(i.videoThumbnailImpressionsClickRate) : null,
        retention_json: r.day === lastDay ? retention : null,
        revenue: null,
      };
    });
    if (payload.length) {
      const { error } = await db.from("analytics_daily").upsert(payload);
      if (error) throw new Error(error.message);
      saved += payload.length;
    }
  }
  log(`video: ${ids.length} video, ${saved} baris tersimpan`);
  return { channelDays: channelRows.length, videos: ids.length };
}

/** Ringkasan untuk input Modul 7 (dan M4/M6). */
export async function buildAnalyticsSummary(channelId: string, days: number) {
  const db = adminClient();
  const since = daysAgo(days);
  const { data: rows } = await db
    .from("analytics_daily")
    .select("*")
    .eq("channel_id", channelId)
    .gte("date", since)
    .order("date");
  const all = rows ?? [];
  const ch = all.filter((r) => r.yt_video_id === "__channel__");
  const sum = (arr: typeof all, k: string) => arr.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const perVideo = new Map<string, typeof all>();
  for (const r of all.filter((r) => r.yt_video_id !== "__channel__")) {
    perVideo.set(r.yt_video_id, [...(perVideo.get(r.yt_video_id) ?? []), r]);
  }
  let titles: Record<string, string> = {};
  try {
    titles = await getVideoTitles(channelId, Array.from(perVideo.keys()));
  } catch {
    /* judul opsional */
  }
  const videos = Array.from(perVideo.entries()).map(([id, rs]) => {
    const imp = sum(rs, "impressions");
    const views = sum(rs, "views");
    return {
      video_id: id,
      title: titles[id] ?? id,
      views,
      impressions: imp || null,
      ctr_pct: imp ? +((rs.reduce((a, r) => a + Number(r.ctr ?? 0) * Number(r.impressions ?? 0), 0) / imp) * 100).toFixed(2) : null,
      watch_minutes: Math.round(sum(rs, "watch_time_minutes")),
      avg_view_duration_sec: Math.round(rs.reduce((a, r) => a + Number(r.avg_view_duration ?? 0), 0) / rs.length),
      avg_view_pct: +(rs.reduce((a, r) => a + Number(r.avg_view_percentage ?? 0), 0) / rs.length).toFixed(1),
      subs_gained: sum(rs, "subs_gained"),
      retention_curve: rs.find((r) => r.retention_json)?.retention_json ?? null,
    };
  });
  const totalImp = sum(ch, "impressions");
  return {
    period: { from: since, to: daysAgo(1), days },
    channel: {
      views: sum(ch, "views"),
      impressions: totalImp || null,
      watch_hours: +(sum(ch, "watch_time_minutes") / 60).toFixed(1),
      subs_net: sum(ch, "subs_gained") - sum(ch, "subs_lost"),
      avg_view_duration_sec: ch.length ? Math.round(sum(ch, "avg_view_duration") / ch.length) : 0,
      traffic_sources: ch.at(-1)?.traffic_sources ?? null,
    },
    videos: videos.sort((a, b) => b.views - a.views),
  };
}
