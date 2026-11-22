import { getActiveChannel } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton, AutoRefresh } from "@/components/app/action-ui";
import { Meter, NeedChannel, PageHeader, fmtDate } from "@/components/app/ui-bits";
import { runChannelModule } from "../actions";
import { YPP, yppProgress, type ChannelStats } from "@/lib/ypp";
import type { M6Output } from "@/lib/ai/schemas";

export const metadata = { title: "Monetization" };

export default async function MonetizationPage() {
  const { supabase, channel } = await getActiveChannel();
  if (!channel)
    return (
      <>
        <PageHeader title="Monetization" />
        <NeedChannel />
      </>
    );
  const { data: jobs } = await supabase.from("jobs").select("id").eq("channel_id", channel.id).eq("stage", "module").contains("payload", { module: 6 }).in("status", ["queued", "running"]);
  const busy = (jobs ?? []).length > 0;
  const m6 = channel.monetization_json as (M6Output & { stats?: ChannelStats; generated_at?: string }) | null;
  const ypp = yppProgress(m6?.stats);

  return (
    <>
      <AutoRefresh active={busy} />
      <PageHeader
        title="Monetization"
        description="Tracker YouTube Partner Program dan rencana pendapatan (M6). Syarat YPP bisa berubah; cek halaman resmi YouTube sebelum mengajukan."
        actions={
          <ActionButton run={runChannelModule.bind(null, channel.id, 6, undefined)} disabled={busy}>
            {busy ? "M6 berjalan…" : m6 ? "Perbarui rencana (M6)" : "Buat rencana monetisasi (M6)"}
          </ActionButton>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>YPP penuh (bagi hasil iklan)</CardTitle>
            <CardDescription>1.000 subscriber + (4.000 jam tonton publik 12 bln atau 10 jt views Shorts 90 hr)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Meter label="Subscriber" value={ypp.subs} max={YPP.full.subs} />
            <Meter label="Jam tonton (12 bln)" value={ypp.hours} max={YPP.full.watchHours12m} />
            <Meter label="Views Shorts (90 hr)" value={ypp.shorts} max={YPP.full.shortsViews90d} />
            <p className="text-xs text-muted-foreground">
              {m6?.generated_at ? `Statistik per ${fmtDate(m6.generated_at)}` : "Jalankan M6 untuk mengambil statistik kanal."}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Akses awal (fan funding)</CardTitle>
            <CardDescription>500 subscriber + 3 upload publik (90 hr) + (3.000 jam tonton atau 3 jt views Shorts) — di negara yang tersedia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Meter label="Subscriber" value={ypp.subs} max={YPP.early.subs} />
            <Meter label="Jam tonton (12 bln)" value={ypp.hours} max={YPP.early.watchHours12m} />
            <Meter label="Views Shorts (90 hr)" value={ypp.shorts} max={YPP.early.shortsViews90d} />
          </CardContent>
        </Card>
      </div>

      {m6 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Kesiapan YPP</CardTitle>
              <CardDescription>{m6.ypp_readiness.gap}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">{m6.ypp_readiness.path}</CardContent>
          </Card>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {m6.streams.map((s) => (
              <Card key={s.name}>
                <CardHeader>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <CardDescription>Mulai: {s.start_when}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{s.requirements}</p>
                  <div>
                    <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Kelebihan</p>
                    <ul className="list-disc pl-4 text-muted-foreground">{s.pros.map((p) => <li key={p}>{p}</li>)}</ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Keterbatasan</p>
                    <ul className="list-disc pl-4 text-muted-foreground">{s.limits.map((p) => <li key={p}>{p}</li>)}</ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
