import Link from "next/link";
import { getActiveChannel } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ActionButton, ActionForm, AutoRefresh, SubmitButton } from "@/components/app/action-ui";
import { PageHeader } from "@/components/app/ui-bits";
import { GoogleOAuthSetup, googleOAuthStatus } from "@/components/app/google-oauth";
import { disconnectYouTube, runChannelModule, saveChannel } from "../actions";
import type { M1Output, M2Output } from "@/lib/ai/schemas";
import type { Channel } from "@/lib/types";

export const metadata = { title: "Channel Setup" };

export default async function ChannelPage({ searchParams }: PageProps<"/channel">) {
  const sp = await searchParams;
  const { supabase, user, channel: active } = await getActiveChannel();
  const google = await googleOAuthStatus(user.id);
  const isNew = sp.new === "1" || !active;
  const channel = isNew ? null : (active as Channel);
  const { data: pending } = channel
    ? await supabase.from("jobs").select("id,payload,status").eq("channel_id", channel.id).eq("stage", "module").in("status", ["queued", "running"])
    : { data: [] };
  const running = new Set((pending ?? []).map((j) => Number((j.payload as { module: number }).module)));
  const plan = channel?.plan_json as M1Output | null;
  const niche = channel?.niche_json as Omit<M2Output, "ideas"> | null;

  return (
    <>
      <AutoRefresh active={running.size > 0} />
      <PageHeader
        title={isNew ? "Kanal baru" : "Channel Setup"}
        description="Profil kanal menjadi konteks untuk semua modul AI. Hubungkan akun YouTube untuk upload & analitik."
      />
      {typeof sp.error === "string" && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{sp.error}</p>
      )}
      {typeof sp.connected === "string" && (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          Terhubung ke kanal YouTube <b>{sp.connected}</b>.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Profil kanal</CardTitle>
            <CardDescription>Dipakai Modul 1 (Rencana Kanal) dan Modul 2 (Niche & Ide).</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveChannel} className="grid gap-4 sm:grid-cols-2">
              {channel && <input type="hidden" name="id" value={channel.id} />}
              <Field label="Nama kanal" name="name" defaultValue={channel?.name} required />
              <div className="space-y-2">
                <Label htmlFor="language">Bahasa konten</Label>
                <select
                  id="language"
                  name="language"
                  defaultValue={channel?.language ?? "id"}
                  className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
                >
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                  <option value="ms">Melayu</option>
                </select>
              </div>
              <Field label="Niche" name="niche" defaultValue={channel?.niche} placeholder="mis. keuangan pribadi untuk pekerja muda" className="sm:col-span-2" />
              <Area label="Target audiens" name="audience" defaultValue={channel?.audience} placeholder="Usia, minat, masalah utama…" />
              <Area label="Pesaing" name="competitors" defaultValue={channel?.competitors} placeholder="Nama/URL kanal pesaing" />
              <Area label="Sumber daya" name="resources" defaultValue={channel?.resources} placeholder="Waktu per minggu, budget, keahlian" />
              <Area label="Tujuan jangka panjang" name="goals" defaultValue={channel?.goals} placeholder="mis. lolos YPP dalam 9 bulan, jual produk digital" />
              <div className="sm:col-span-2">
                <SubmitButton>{channel ? "Simpan profil" : "Buat kanal"}</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Akun YouTube</CardTitle>
              <CardDescription>
                Izin upload, baca kanal, dan baca analitik. Semua kredensial & token disimpan terenkripsi di server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!channel ? (
                <p className="text-sm text-muted-foreground">Simpan profil kanal dulu.</p>
              ) : channel.yt_channel_id ? (
                <>
                  <div className="flex items-center gap-3">
                    {channel.yt_thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={channel.yt_thumbnail_url} alt="" className="size-10 rounded-full" />
                    )}
                    <div>
                      <p className="font-medium">{channel.yt_channel_title}</p>
                      <p className="text-xs text-muted-foreground">{channel.yt_channel_id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/youtube/connect?channel=${channel.id}`}>Hubungkan ulang</a>
                    </Button>
                    <ActionButton
                      size="sm"
                      variant="destructive"
                      confirm="Putuskan akun YouTube? Upload terjadwal yang belum diproses akan gagal."
                      run={disconnectYouTube.bind(null, channel.id)}
                    >
                      Putuskan
                    </ActionButton>
                  </div>
                </>
              ) : !google.ready ? (
                <GoogleOAuthSetup userId={user.id} />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Kredensial Google siap. Klik untuk memilih akun YouTube Anda.</p>
                  <Button asChild size="lg">
                    <a href={`/api/youtube/connect?channel=${channel.id}`}>Hubungkan akun YouTube</a>
                  </Button>
                </div>
              )}
              {channel && google.ready && (
                <details className="group rounded-2xl border border-white/60 bg-white/30 p-3">
                  <summary className="cursor-pointer text-sm font-medium">Ubah kredensial Google (Client ID & Secret)</summary>
                  <div className="mt-4">
                    <GoogleOAuthSetup userId={user.id} />
                  </div>
                </details>
              )}
            </CardContent>
          </Card>

          {channel && (
            <Card>
              <CardHeader>
                <CardTitle>Jalankan AI</CardTitle>
                <CardDescription>Diproses worker. Hasil muncul di halaman ini.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <ActionButton run={runChannelModule.bind(null, channel.id, 1, undefined)} disabled={running.has(1)}>
                  {running.has(1) ? "M1 sedang berjalan…" : plan ? "Perbarui Rencana Kanal (M1)" : "Buat Rencana Kanal (M1)"}
                </ActionButton>
                <ActionButton variant="outline" run={runChannelModule.bind(null, channel.id, 2, 100)} disabled={running.has(2)}>
                  {running.has(2) ? "M2 sedang berjalan…" : "Riset Niche & 100 Ide (M2)"}
                </ActionButton>
                <ActionButton variant="ghost" run={runChannelModule.bind(null, channel.id, 5, undefined)} disabled={running.has(5)}>
                  {running.has(5) ? "M5 sedang berjalan…" : "Playbook Produksi (M5)"}
                </ActionButton>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {plan && <PlanView plan={plan} />}
      {niche && <NicheView niche={niche} />}
      {channel?.production_json ? <ProductionView data={channel.production_json as never} /> : null}
    </>
  );
}

function Field(props: { label: string; name: string; defaultValue?: string | null; placeholder?: string; required?: boolean; className?: string }) {
  return (
    <div className={`space-y-2 ${props.className ?? ""}`}>
      <Label htmlFor={props.name}>{props.label}</Label>
      <Input id={props.name} name={props.name} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder} required={props.required} />
    </div>
  );
}
function Area(props: { label: string; name: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.name}>{props.label}</Label>
      <Textarea id={props.name} name={props.name} rows={3} defaultValue={props.defaultValue ?? ""} placeholder={props.placeholder} />
    </div>
  );
}

function PlanView({ plan }: { plan: M1Output }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rencana Kanal (M1)</CardTitle>
        <CardDescription>{plan.positioning}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <section className="grid gap-3 md:grid-cols-3">
          {plan.content_pillars.map((p) => (
            <div key={p.name} className="rounded-lg border p-3">
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-muted-foreground">{p.description}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {p.example_topics.slice(0, 4).map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 font-medium">Format</p>
            <ul className="space-y-1.5">
              {plan.formats.map((f) => (
                <li key={f.name} className="flex gap-2">
                  <Badge variant="secondary">{f.type === "short" ? "Shorts" : "Long"}</Badge>
                  <span>
                    <b>{f.name}</b> · {f.duration} — <span className="text-muted-foreground">{f.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 font-medium">Jadwal publikasi</p>
            <p>
              {plan.publish_schedule.long_per_week} video panjang + {plan.publish_schedule.shorts_per_week} Shorts per minggu ·{" "}
              {plan.publish_schedule.best_days.join(", ")} · {plan.publish_schedule.best_time_local}
            </p>
            <p className="mt-1 text-muted-foreground">{plan.publish_schedule.notes}</p>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <ListBlock title="Pertumbuhan audiens" items={plan.growth_plan} />
          <ListBlock title="Retensi penonton" items={plan.retention_plan} />
        </section>
        <section>
          <p className="mb-2 font-medium">Rencana aksi mingguan</p>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {plan.weekly_actions.map((w) => (
              <div key={w.week} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Minggu {w.week}</p>
                <p className="font-medium">{w.focus}</p>
                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                  {w.actions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function NicheView({ niche }: { niche: Omit<M2Output, "ideas"> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Niche & identitas (M2)</CardTitle>
        <CardDescription>
          {niche.channel_identity.tagline} · Nada: {niche.channel_identity.tone}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 text-sm md:grid-cols-2">
        <div className="space-y-2">
          <p className="font-medium">Skor niche</p>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1">Niche</th>
                <th>Demand</th>
                <th>Kompetisi</th>
                <th>Monetisasi</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {niche.niche_scores.map((n) => (
                <tr key={n.niche} className="border-t">
                  <td className="py-1.5 pr-2">{n.niche}</td>
                  <td>{n.demand}</td>
                  <td>{n.competition}</td>
                  <td>{n.monetization}</td>
                  <td className="font-semibold">{n.overall}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-muted-foreground">Pembeda: {niche.channel_identity.differentiator}</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium">Penonton ideal</p>
          <p className="text-muted-foreground">{niche.ideal_viewer.description}</p>
          <ListBlock title="Masalah" items={niche.ideal_viewer.pains} />
          <p className="pt-2">
            Kategori: {niche.categories.join(" · ")} ·{" "}
            <Link href="/ideas" className="text-primary underline-offset-4 hover:underline">
              Lihat ide →
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductionView({ data }: { data: { workflow: { step: string; tools: string[]; tips: string[] }[]; qc_checklist: string[] } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Playbook produksi (M5)</CardTitle>
        <CardDescription>Alur kerja platform sudah mengotomatiskan langkah-langkah ini; QC otomatis berjalan sebelum Review Queue.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <ol className="list-decimal space-y-2 pl-4">
          {data.workflow.map((w) => (
            <li key={w.step}>
              <b>{w.step}</b>
              <span className="text-muted-foreground"> — {w.tools.join(", ")}</span>
            </li>
          ))}
        </ol>
        <ListBlock title="Checklist QC tambahan" items={data.qc_checklist} />
      </CardContent>
    </Card>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 font-medium">{title}</p>
      <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
