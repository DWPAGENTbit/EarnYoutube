// Ambang YouTube Partner Program. Verifikasi berkala ke
// https://support.google.com/youtube/answer/72851 karena syarat bisa berubah.
export const YPP = {
  full: { subs: 1000, watchHours12m: 4000, shortsViews90d: 10_000_000 },
  early: { subs: 500, uploads90d: 3, watchHours12m: 3000, shortsViews90d: 3_000_000 },
} as const;

export interface ChannelStats {
  subscribers?: number;
  watch_hours_12m?: number | string;
  shorts_views_90d?: number | string;
}

export function yppProgress(stats: ChannelStats | null | undefined) {
  const subs = Number(stats?.subscribers ?? 0);
  const hours = typeof stats?.watch_hours_12m === "number" ? stats.watch_hours_12m : 0;
  const shorts = typeof stats?.shorts_views_90d === "number" ? stats.shorts_views_90d : 0;
  const eligible =
    subs >= YPP.full.subs && (hours >= YPP.full.watchHours12m || shorts >= YPP.full.shortsViews90d);
  return { subs, hours, shorts, eligible };
}
