import { getActiveChannel } from "@/lib/supabase/server";
import { isoDaysAgo } from "@/lib/dates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton, AutoRefresh } from "@/components/app/action-ui";
import { EmptyState, NeedChannel, PageHeader, Stat, fmtDate, fmtNum } from "@/components/app/ui-bits";
import { queueAnalytics } from "../actions";
import { CtrChart, RetentionChart, TrafficChart, ViewsChart } from "./charts";
import type { M7Output } from "@/lib/ai/schemas";

export const metadata = { title: "Analytics" };

const TRAFFIC: Record<string, string> = {
  YT_SEARCH: "Pencarian YouTube",
  RELATED_VIDEO: "Video disarankan",
  SUBSCRIBER: "Beranda/Subscriber",
  BROWSE: "Fitur jelajah",
  SHORTS: "Feed Shorts",
  EXT_URL: "Eksternal",
  NO_LINK_OTHER: "Langsung/tidak diketahui",
  PLAYLIST: "Playlist",
  NOTIFICATION: "Notifikasi",
  YT_CHANNEL: "Halaman kanal",
  END_SCREEN: "Layar akhir",
};

export default async function AnalyticsPage() {
  const { supabase, channel } = await getActiveChannel();
  if (!channel)
    return (
      <>
        <PageHeader title="Analytics" />
        <NeedChannel />
      </>
    );
  const since = isoDaysAgo(90);
  const [{ data: rows }, { data: videoRows }, { data: reports }, { data: jobs }] = await Promise.all([
    supabase.from("analytics_daily").select("*").eq("channel_id", channel.id).eq("yt_video_id", "__channel__").gte("date", since).order("date"),
    supabase.from("analytics_daily").select("yt_video_id,views,impressions,ctr,avg_view_percentage,retention_json,date").eq("channel_id", channel.id).neq("yt_video_id", "__channel__").gte("date", since),
    supabase.from("reports").select("*").eq("channel_id", channel.id).order("created_at", { ascending: false }).limit(6),
    supabase.from("jobs").select("id,stage").eq("channel_id", channel.id).in("stage", ["analytics_sync", "report_weekly", "report_monthly"]).in("status", ["queued", "running"]),
  ]);
  const days = rows ?? [];
  const last28 = days.slice(-28);
  const sum = (k: string, arr = last28) => arr.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const impressions = sum("impressions");
  const ctrAvg = impressions ? last28.reduce((a, r) => a + Number(r.ctr ?? 0) * Number(r.impressions ?? 0), 0) / impressions : null;
  const chart = days.map((r) => ({ date: r.date as string, views: Number(r.views ?? 0), ctr: r.ctr == null ? null : +(Number(r.ctr) * 100).toFixed(2) }));
  const traffic = Object.entries((days.at(-1)?.traffic_sources ?? {}) as Record<string, number>)
    .map(([source, views]) => ({ source: TRAFFIC[source] ?? source, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  // Video teratas & kurva retensi video terbaik
  const byVideo = new Map<string, { views: number; retention: unknown }>();
  for (const r of videoRows ?? []) {
    const cur = byVideo.get(r.yt_video_id) ?? { views: 0, retention: null };
    cur.views += Number(r.views ?? 0);
    if (r.retention_json) cur.retention = r.retention_json;
    byVideo.set(r.yt_video_id, cur);
  }
  const top = [...byVideo.entries()].sort((a, b) => b[1].views - a[1].views).slice(0, 10);
  const withRet = top.find(([, v]) => Array.isArray(v.retention) && (v.retention as unknown[]).length);
  const retention = withRet
    ? (withRet[1].retention as { elapsedVideoTimeRatio: number; audienceWatchRatio: number }[]).map((p) => ({
        x: Math.round(p.elapsedVideoTimeRatio * 100),
        y: +(p.audienceWatchRatio * 100).toFixed(1),
      }))
    : [];
  const busy = (jobs ?? []).length > 0;
  const latest = reports?.[0];

  return (
    <>
      <AutoRefresh active={busy} />
      <PageHeader
        title="Analytics"
        description="Data dari YouTube Analytics API (tertunda ±2–3 hari). Sinkron otomatis setiap hari; laporan M7 mingguan & bulanan otomatis masuk backlog ide."
        actions={
          <>
            <ActionButton variant="outline" run={queueAnalytics.bind(null, channel.id, "analytics_sync")} disabled={busy}>
              Sinkron sekarang
            </ActionButton>
            <ActionButton run={queueAnalytics.bind(null, channel.id, "report_weekly")} disabled={busy}>
              {busy ? "Memproses…" : "Buat laporan mingguan (M7)"}
            </ActionButton>
          </>
        }
      />
      {days.length === 0 ? (
        <EmptyState
          title="Belum ada data analitik"
          description={channel.yt_channel_id ? "Klik Sinkron sekarang dan pastikan worker berjalan." : "Hubungkan akun YouTube di Channel Setup terlebih dahulu."}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Views (28 hr)" value={fmtNum(sum("views"))} />
            <Stat label="Impressions (28 hr)" value={impressions ? fmtNum(impressions) : "–"} />
            <Stat label="CTR rata-rata" value={ctrAvg == null ? "–" : `${(ctrAvg * 100).toFixed(1)}%`} />
            <Stat label="Rata-rata durasi tonton" value={`${Math.round(sum("avg_view_duration") / Math.max(1, last28.length))} dtk`} />
            <Stat label="Subscriber bersih" value={fmtNum(sum("subs_gained") - sum("subs_lost"))} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Views harian (90 hari)</CardTitle></CardHeader>
              <CardContent><ViewsChart data={chart} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>CTR thumbnail</CardTitle>
                <CardDescription>Kosong bila metrik impressions belum tersedia untuk kanal lewat API.</CardDescription>
              </CardHeader>
              <CardContent><CtrChart data={chart} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Retensi penonton</CardTitle>
                <CardDescription>{withRet ? `Video ${withRet[0]} (teratas dengan data retensi)` : "Belum ada data retensi"}</CardDescription>
              </CardHeader>
              <CardContent>{retention.length ? <RetentionChart data={retention} /> : <p className="text-sm text-muted-foreground">–</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Sumber trafik (28 hr)</CardTitle></CardHeader>
              <CardContent>{traffic.length ? <TrafficChart data={traffic} /> : <p className="text-sm text-muted-foreground">–</p>}</CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Laporan M7</CardTitle>
          <CardDescription>{latest ? `${latest.period === "weekly" ? "Mingguan" : "Bulanan"} · ${latest.period_start} s/d ${latest.period_end} · dibuat ${fmtDate(latest.created_at)}` : "Belum ada laporan."}</CardDescription>
        </CardHeader>
        {latest && <ReportView r={latest.json as M7Output} />}
      </Card>
      {(reports ?? []).slice(1).length > 0 && (
        <details className="rounded-xl border p-4 text-sm">
          <summary className="cursor-pointer font-medium">Laporan sebelumnya</summary>
          <ul className="mt-3 space-y-3">
            {(reports ?? []).slice(1).map((r) => (
              <li key={r.id}>
                <p className="font-medium">{r.period === "weekly" ? "Mingguan" : "Bulanan"} {r.period_start} s/d {r.period_end}</p>
                <p className="text-muted-foreground">{(r.json as M7Output).summary}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function ReportView({ r }: { r: M7Output }) {
  return (
    <CardContent className="space-y-5 text-sm">
      <p>{r.summary}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 font-medium">Pemenang</p>
          <ul className="space-y-1">{r.winners.map((w) => <li key={w.video_id}><b>{w.title}</b> — <span className="text-muted-foreground">{w.why}</span></li>)}</ul>
        </div>
        <div>
          <p className="mb-1 font-medium">Kurang performa</p>
          <ul className="space-y-1">{r.underperformers.map((w) => <li key={w.video_id}><b>{w.title}</b> — <span className="text-muted-foreground">{w.reason}</span></li>)}</ul>
        </div>
        <div>
          <p className="mb-1 font-medium">Pola</p>
          <ul className="list-disc pl-4 text-muted-foreground">{r.patterns.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <div>
          <p className="mb-1 font-medium">Rekomendasi</p>
          <ul className="list-disc pl-4 text-muted-foreground">{r.recommendations.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      </div>
      <div>
        <p className="mb-1 font-medium">Ide berikutnya (sudah masuk backlog)</p>
        <ul className="list-disc pl-4">{r.next_ideas.map((i) => <li key={i.title}>{i.title} <span className="text-muted-foreground">— {i.angle}</span></li>)}</ul>
      </div>
    </CardContent>
  );
}
