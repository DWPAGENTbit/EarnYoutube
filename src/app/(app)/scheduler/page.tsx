import Link from "next/link";
import { getActiveChannel } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionButton, AutoRefresh } from "@/components/app/action-ui";
import { NeedChannel, PageHeader, fmtDate } from "@/components/app/ui-bits";
import { retry, runChannelModule } from "../actions";
import { channelSettings } from "@/lib/types";
import type { M4Output } from "@/lib/ai/schemas";
import { cn } from "@/lib/utils";

export const metadata = { title: "Scheduler" };

const UP_LABEL: Record<string, string> = {
  queued: "Antre",
  uploading: "Mengunggah",
  uploaded: "Terunggah (private)",
  scheduled: "Terjadwal",
  published: "Tayang",
  failed: "Gagal",
};

export default async function SchedulerPage({ searchParams }: PageProps<"/scheduler">) {
  const sp = await searchParams;
  const { supabase, channel } = await getActiveChannel();
  if (!channel)
    return (
      <>
        <PageHeader title="Scheduler" />
        <NeedChannel />
      </>
    );
  const now = new Date();
  const [y, m] = typeof sp.m === "string" && /^\d{4}-\d{2}$/.test(sp.m) ? sp.m.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const { data: uploads } = await supabase
    .from("uploads")
    .select("id,video_id,status,privacy,publish_at,yt_video_id,error,created_at,updated_at,videos(metadata_json,format)")
    .eq("channel_id", channel.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const { data: m4Jobs } = await supabase.from("jobs").select("id").eq("channel_id", channel.id).eq("stage", "module").contains("payload", { module: 4 }).in("status", ["queued", "running"]);
  const list = (uploads ?? []).map((u) => {
    const v = (Array.isArray(u.videos) ? u.videos[0] : u.videos) as { metadata_json: { title: string } | null; format: string } | null;
    return { ...u, title: v?.metadata_json?.title ?? "Video", format: v?.format ?? "long", day: new Date(u.publish_at ?? u.updated_at) };
  });
  const queue = list.filter((u) => ["queued", "uploading", "failed"].includes(u.status));
  const growth = channel.growth_json as M4Output | null;
  const s = channelSettings(channel);

  const days: (Date | null)[] = [];
  const lead = (first.getDay() + 6) % 7; // Senin = kolom pertama
  for (let i = 0; i < lead; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(y, m - 1, d));
  const prev = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;

  return (
    <>
      <AutoRefresh active={queue.some((q) => q.status !== "failed") || (m4Jobs ?? []).length > 0} />
      <PageHeader
        title="Scheduler"
        description={`Kalender publikasi & antrean upload. Batas ${s.upload_daily_limit} upload/hari untuk menjaga kuota YouTube Data API.`}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{first.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</CardTitle>
          <div className="flex gap-1">
            <Button asChild variant="outline" size="sm"><Link href={`/scheduler?m=${prev}`}>←</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href="/scheduler">Hari ini</Link></Button>
            <Button asChild variant="outline" size="sm"><Link href={`/scheduler?m=${next}`}>→</Link></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
              <div key={d} className="bg-muted px-2 py-1.5 font-medium text-muted-foreground">{d}</div>
            ))}
            {days.map((d, i) => {
              const items = d ? list.filter((u) => u.day.toDateString() === d.toDateString()) : [];
              const today = d?.toDateString() === now.toDateString();
              return (
                <div key={i} className={cn("min-h-20 bg-background p-1.5", !d && "bg-muted/30")}>
                  {d && <p className={cn("mb-1 text-[11px]", today ? "font-semibold text-primary" : "text-muted-foreground")}>{d.getDate()}</p>}
                  {items.slice(0, 3).map((u) => (
                    <Link
                      key={u.id}
                      href={`/studio/${u.video_id}`}
                      title={u.title}
                      className={cn(
                        "mb-0.5 block truncate rounded px-1 py-0.5 text-[11px]",
                        u.status === "scheduled" ? "bg-violet-500/15" : u.status === "failed" ? "bg-destructive/15" : "bg-primary/10",
                      )}
                    >
                      {u.format === "short" ? "▮ " : ""}
                      {u.title}
                    </Link>
                  ))}
                  {items.length > 3 && <p className="text-[10px] text-muted-foreground">+{items.length - 3}</p>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Antrean upload</CardTitle>
            <CardDescription>Upload resumable lewat YouTube Data API. Kegagalan bisa diulang.</CardDescription>
          </CardHeader>
          <CardContent>
            {queue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Antrean kosong.</p>
            ) : (
              <ul className="divide-y text-sm">
                {queue.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {UP_LABEL[u.status]} · {u.privacy}
                        {u.publish_at ? ` · tayang ${fmtDate(u.publish_at)}` : ""}
                      </p>
                      {u.error && <p className="truncate text-xs text-destructive">{u.error}</p>}
                    </div>
                    {u.status === "failed" && (
                      <ActionButton size="sm" variant="outline" run={retry.bind(null, u.video_id)}>
                        Ulangi
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Strategi pertumbuhan (M4)</CardTitle>
              <CardDescription>Frekuensi upload & rencana uji judul/thumbnail berdasarkan data kanal.</CardDescription>
            </div>
            <ActionButton size="sm" variant="outline" run={runChannelModule.bind(null, channel.id, 4, undefined)} disabled={(m4Jobs ?? []).length > 0}>
              {(m4Jobs ?? []).length ? "Berjalan…" : growth ? "Perbarui" : "Jalankan M4"}
            </ActionButton>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!growth ? (
              <p className="text-muted-foreground">Belum ada strategi. Jalankan M4 setelah beberapa video tayang agar rekomendasi memakai data nyata.</p>
            ) : (
              <>
                <p>
                  Rekomendasi: <b>{growth.upload_frequency.long_per_week}</b> video panjang + <b>{growth.upload_frequency.shorts_per_week}</b> Shorts per minggu.
                  <span className="block text-muted-foreground">{growth.upload_frequency.reasoning}</span>
                </p>
                <div>
                  <p className="font-medium">Rencana uji</p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {growth.test_plan.map((t) => (
                      <li key={t.hypothesis}>
                        {t.hypothesis} — ubah <i>{t.variable}</i>, ukur {t.metric} ({t.duration_days} hari)
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-medium">Aturan optimasi</p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {growth.optimization_rules.map((r) => (
                      <li key={r.when}>
                        Jika {r.when} → {r.then}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
