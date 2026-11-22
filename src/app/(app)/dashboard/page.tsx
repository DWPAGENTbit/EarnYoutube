import Link from "next/link";
import { Clock3, Eye, Lightbulb, ListChecks, Loader, PlayCircle, PlugZap, UserPlus } from "lucide-react";
import { getActiveChannel } from "@/lib/supabase/server";
import { isoDaysAgo } from "@/lib/dates";
import { displayName, greeting } from "@/lib/greeting";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AutoRefresh } from "@/components/app/action-ui";
import { Meter, NeedChannel, PageHeader, Stat, StatusBadge, fmtDate, fmtNum } from "@/components/app/ui-bits";
import { DailyBars } from "../analytics/charts";
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
  const { supabase, user, channel } = await getActiveChannel();
  const hello = `${greeting()}, ${displayName(user.email)}`;
  if (!channel)
    return (
      <div className="space-y-6">
        <PageHeader title={hello} description="Mulai dengan membuat kanal pertama Anda." />
        <NeedChannel />
      </div>
    );

  const since = isoDaysAgo(28);
  const [{ data: rows }, { data: jobs }, { data: videos }, { count: backlog }] = await Promise.all([
    supabase
      .from("analytics_daily")
      .select("date,views,watch_time_minutes,subs_gained,subs_lost")
      .eq("channel_id", channel.id)
      .eq("yt_video_id", "__channel__")
      .gte("date", since)
      .order("date"),
    supabase
      .from("jobs")
      .select("id,stage,status,attempts,max_attempts,error,payload,video_id,created_at")
      .eq("channel_id", channel.id)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("videos").select("id,status,format,metadata_json,updated_at").eq("channel_id", channel.id).order("updated_at", { ascending: false }).limit(8),
    supabase.from("ideas").select("id", { count: "exact", head: true }).eq("channel_id", channel.id).eq("status", "backlog"),
  ]);
  const sum = (k: "views" | "watch_time_minutes" | "subs_gained" | "subs_lost") =>
    (rows ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const daily = (rows ?? []).slice(-14).map((r) => ({ date: String(r.date), views: Number(r.views ?? 0) }));
  const stats = (channel.monetization_json as { stats?: ChannelStats } | null)?.stats;
  const ypp = yppProgress(stats);
  const connected = !!channel.yt_channel_id;
  const list = (videos ?? []) as Pick<Video, "id" | "status" | "format" | "metadata_json" | "updated_at">[];
  const inReview = list.filter((v) => v.status === "review").length;
  const activeJobs = jobs ?? [];

  return (
    <div className="space-y-6">
      <AutoRefresh active={activeJobs.length > 0} />
      <PageHeader title={hello} description="Pantau produksi, review, dan pertumbuhan kanal Anda di satu tempat." />

      {!connected && (
        <div className="glass-strong flex flex-col gap-3 rounded-3xl p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--teal)] text-white">
              <PlugZap className="size-5" />
            </span>
            <p className="text-sm">
              <b>Akun YouTube belum terhubung.</b> Upload dan analitik butuh koneksi. Semua bisa diatur dari web.
            </p>
          </div>
          <Button asChild>
            <Link href="/channel">Hubungkan YouTube</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Kanal aktif */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-foreground/70">Kanal aktif</CardTitle>
            <CardAction>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium shadow-sm">
                <PlayCircle className="size-3.5 text-red-600" /> {connected ? "Terhubung" : "Belum"}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {channel.yt_thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={channel.yt_thumbnail_url} alt="" className="size-12 rounded-full ring-2 ring-white" />
              ) : (
                <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-[#3a3330] to-[#6b5a4c] text-lg font-semibold text-white">
                  {(channel.yt_channel_title ?? channel.name).slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{channel.yt_channel_title ?? channel.name}</p>
                <p className="truncate text-xs text-foreground/55">{channel.positioning ?? channel.niche ?? "Atur niche di Channel Setup"}</p>
              </div>
            </div>
            <div>
              <p className="text-4xl font-semibold tracking-tight tabular-nums">{fmtNum(ypp.subs)}</p>
              <p className="text-xs text-foreground/55">subscriber{stats ? "" : " · jalankan M6 untuk memperbarui"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild size="lg" className="w-full">
                <Link href="/review">
                  <ListChecks /> Review{inReview ? ` (${inReview})` : ""}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full">
                <Link href="/ideas">
                  <Lightbulb /> Ide ({backlog ?? 0})
                </Link>
              </Button>
            </div>
            <div className="glass-strong grid grid-cols-3 gap-2 rounded-3xl p-2.5">
              {[
                { k: "Backlog", v: backlog ?? 0 },
                { k: "Di review", v: inReview },
                { k: "Job aktif", v: activeJobs.length },
              ].map((x) => (
                <div key={x.k} className="rounded-2xl bg-white/70 px-3 py-2.5 shadow-sm">
                  <p className="text-[11px] text-foreground/55">{x.k}</p>
                  <p className="text-lg font-semibold tabular-nums">{x.v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Ubin statistik */}
        <div className="glass grid grid-cols-2 gap-3 rounded-[28px] p-3 lg:col-span-4">
          <Stat tone="teal" icon={Eye} label="Views" value={fmtNum(sum("views"))} hint="28 hari terakhir" />
          <Stat icon={Clock3} label="Jam tonton" value={fmtNum(Math.round(sum("watch_time_minutes") / 60))} hint="28 hari" />
          <Stat
            icon={UserPlus}
            label="Subscriber bersih"
            value={fmtNum(sum("subs_gained") - sum("subs_lost"))}
            trend={rows?.length ? { value: `${fmtNum(sum("subs_gained"))} baru`, up: sum("subs_gained") >= sum("subs_lost") } : null}
          />
          <Stat icon={Lightbulb} label="Ide di backlog" value={fmtNum(backlog ?? 0)} hint={`${inReview} menunggu review`} />
        </div>

        {/* Grafik views harian */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Views harian</CardTitle>
            <CardDescription>14 hari terakhir</CardDescription>
            <CardAction className="flex items-center gap-3 text-[11px] text-foreground/60">
              <span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-[var(--teal)]" /> Views</span>
              <span className="flex items-center gap-1"><i className="size-2 rounded-sm bg-[var(--chart-2)]" /> Tertinggi</span>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="glass-strong rounded-3xl p-2">
              {daily.length ? (
                <DailyBars data={daily} />
              ) : (
                <p className="grid h-[210px] place-items-center px-6 text-center text-sm text-foreground/55">
                  Data muncul setelah YouTube terhubung & sinkron analitik berjalan.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* YPP + job */}
        <div className="space-y-4 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle>Progres YPP</CardTitle>
              <CardDescription>
                {stats
                  ? ypp.eligible
                    ? "Syarat utama terpenuhi, ajukan dari YouTube Studio."
                    : "1.000 subscriber + 4.000 jam tonton atau 10 jt views Shorts."
                  : "Jalankan M6 di Monetization untuk statistik terbaru."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Meter label="Subscriber" value={ypp.subs} max={YPP.full.subs} />
              <Meter label="Jam tonton (12 bln)" value={ypp.hours} max={YPP.full.watchHours12m} />
              <Meter label="Views Shorts (90 hr)" value={ypp.shorts} max={YPP.full.shortsViews90d} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Job aktif</CardTitle>
              <CardDescription>Diproses worker, halaman menyegarkan otomatis.</CardDescription>
            </CardHeader>
            <CardContent>
              {activeJobs.length === 0 ? (
                <p className="text-sm text-foreground/55">Tidak ada job berjalan.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {activeJobs.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/50 px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {STAGE_LABEL[j.stage] ?? j.stage}
                          {j.stage === "module" ? ` M${(j.payload as { module?: number }).module}` : ""}
                        </p>
                        {j.error && <p className="truncate text-xs text-destructive">{j.error}</p>}
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-foreground/55">
                        {j.status === "running" && <Loader className="size-3 animate-spin" />}
                        {j.status === "running" ? "berjalan" : "antre"} · {j.attempts}/{j.max_attempts}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Aktivitas terbaru */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="text-base">Aktivitas terbaru</CardTitle>
            <CardAction>
              <Button asChild variant="outline" size="sm">
                <Link href="/studio">Lihat semua</Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="rounded-3xl bg-white/40 p-6 text-center text-sm text-foreground/60">
                Belum ada video. Pilih ide di{" "}
                <Link className="font-medium underline" href="/ideas">
                  Idea Backlog
                </Link>{" "}
                lalu klik Produksi.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-3xl bg-white/35 p-1.5">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-foreground/55">
                      <th className="rounded-l-2xl bg-white/60 px-3 py-2.5 font-medium">Format</th>
                      <th className="bg-white/60 px-3 py-2.5 font-medium">Judul</th>
                      <th className="bg-white/60 px-3 py-2.5 font-medium">Status</th>
                      <th className="rounded-r-2xl bg-white/60 px-3 py-2.5 font-medium">Diperbarui</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((v) => (
                      <tr key={v.id} className="group">
                        <td className="rounded-l-2xl px-3 py-3 transition-colors group-hover:bg-white/55">
                          <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold uppercase shadow-sm">
                            {v.format === "short" ? "Shorts" : "Long"}
                          </span>
                        </td>
                        <td className="max-w-[280px] px-3 py-3 transition-colors group-hover:bg-white/55">
                          <Link href={`/studio/${v.id}`} className="block truncate font-medium hover:underline">
                            {v.metadata_json?.title ?? "Sedang diproduksi…"}
                          </Link>
                        </td>
                        <td className="px-3 py-3 transition-colors group-hover:bg-white/55">
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="rounded-r-2xl px-3 py-3 text-xs whitespace-nowrap text-foreground/55 transition-colors group-hover:bg-white/55">
                          {fmtDate(v.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
