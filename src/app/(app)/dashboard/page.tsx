import Link from "next/link";
import { getActiveChannel } from "@/lib/supabase/server";
import { isoDaysAgo } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/app/action-ui";
import { Meter, NeedChannel, PageHeader, Stat, StatusBadge, fmtDate, fmtNum } from "@/components/app/ui-bits";
import { YPP, yppProgress, type ChannelStats } from "@/lib/ypp";
import type { Video } from "@/lib/types";

export const metadata = { title: "Dashboard" };

const STAGE_LABEL: Record<string, string> = {
  scripting: "Skrip (M3)",
  voicing: "Voice-over",
  assets: "Aset & subtitle",
  rendering: "Render",
  qc: "QC",
  uploading: "Upload",
  analytics_sync: "Sinkron analitik",
  report_weekly: "Laporan mingguan (M7)",
  report_monthly: "Laporan bulanan (M7)",
  auto_pick: "Pilih ide otomatis",
  module: "Modul AI",
};

export default async function DashboardPage() {
  const { supabase, channel } = await getActiveChannel();
  if (!channel)
    return (
      <>
        <PageHeader title="Dashboard" />
        <NeedChannel />
      </>
    );

  const since = isoDaysAgo(28);
  const [{ data: rows }, { data: jobs }, { data: videos }, { count: backlog }] = await Promise.all([
    supabase
      .from("analytics_daily")
      .select("views,watch_time_minutes,subs_gained,subs_lost")
      .eq("channel_id", channel.id)
      .eq("yt_video_id", "__channel__")
      .gte("date", since),
    supabase
      .from("jobs")
      .select("id,stage,status,attempts,max_attempts,error,payload,video_id,created_at")
      .eq("channel_id", channel.id)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("videos").select("id,status,format,metadata_json,updated_at").eq("channel_id", channel.id).order("updated_at", { ascending: false }).limit(8),
    supabase.from("ideas").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).eq("status", "backlog"),
  ]);
  const sum = (k: "views" | "watch_time_minutes" | "subs_gained" | "subs_lost") =>
    (rows ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const stats = (channel.monetization_json as { stats?: ChannelStats } | null)?.stats;
  const ypp = yppProgress(stats);
  const connected = !!channel.yt_channel_id;
  const inReview = (videos ?? []).filter((v) => v.status === "review").length;

  return (
    <>
      <AutoRefresh active={(jobs ?? []).length > 0} />
      <PageHeader
        title={channel.yt_channel_title ?? channel.name}
        description={channel.positioning ?? channel.niche ?? "Ringkasan kanal, progres YPP, dan pekerjaan yang sedang berjalan."}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/ideas">Backlog ide ({backlog ?? 0})</Link>
            </Button>
            <Button asChild>
              <Link href="/review">Review Queue{inReview ? ` (${inReview})` : ""}</Link>
            </Button>
          </>
        }
      />

      {!connected && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">Akun YouTube belum terhubung. Upload dan analitik membutuhkan koneksi OAuth.</p>
            <Button asChild size="sm">
              <Link href="/channel">Hubungkan YouTube</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Views (28 hari)" value={fmtNum(sum("views"))} />
        <Stat label="Jam tonton (28 hari)" value={fmtNum(Math.round(sum("watch_time_minutes") / 60))} />
        <Stat label="Subscriber bersih (28 hari)" value={fmtNum(sum("subs_gained") - sum("subs_lost"))} />
        <Stat label="Ide di backlog" value={fmtNum(backlog ?? 0)} hint={`${inReview} video menunggu review`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Progres YPP</CardTitle>
            <CardDescription>
              {stats ? (ypp.eligible ? "Syarat utama YPP terpenuhi — ajukan dari YouTube Studio." : "Jalur: 1.000 subscriber + 4.000 jam tonton (12 bln) atau 10 jt views Shorts (90 hr).") : "Jalankan Monetization (M6) untuk mengambil statistik kanal terbaru."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Meter label="Subscriber" value={ypp.subs} max={YPP.full.subs} />
            <Meter label="Jam tonton publik (12 bln)" value={ypp.hours} max={YPP.full.watchHours12m} />
            <Meter label="Views Shorts (90 hr)" value={ypp.shorts} max={YPP.full.shortsViews90d} />
            <Button asChild variant="link" className="px-0">
              <Link href="/monetization">Detail monetisasi →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Job aktif</CardTitle>
            <CardDescription>Diproses oleh worker (`npm run worker`). Halaman menyegarkan otomatis.</CardDescription>
          </CardHeader>
          <CardContent>
            {(jobs ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada job berjalan.</p>
            ) : (
              <ul className="divide-y text-sm">
                {(jobs ?? []).map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {STAGE_LABEL[j.stage] ?? j.stage}
                        {j.stage === "module" ? ` M${(j.payload as { module?: number }).module}` : ""}
                      </p>
                      {j.error && <p className="truncate text-xs text-destructive">{j.error}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {j.status === "running" ? "berjalan" : "antre"} · {j.attempts}/{j.max_attempts}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Video terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {(videos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada video. Pilih ide di <Link className="text-primary underline" href="/ideas">Idea Backlog</Link> lalu klik Produksi.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {(videos as Pick<Video, "id" | "status" | "format" | "metadata_json" | "updated_at">[]).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/studio/${v.id}`} className="min-w-0 truncate hover:underline">
                    <span className="mr-2 text-xs uppercase text-muted-foreground">{v.format === "short" ? "Shorts" : "Long"}</span>
                    {v.metadata_json?.title ?? "Sedang diproduksi…"}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDate(v.updated_at)}</span>
                    <StatusBadge status={v.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
