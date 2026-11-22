import Link from "next/link";
import { getActiveChannel } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ActionButton, ActionForm, AutoRefresh, SubmitButton } from "@/components/app/action-ui";
import { EmptyState, NeedChannel, PageHeader } from "@/components/app/ui-bits";
import { addIdea, produceIdea, runChannelModule, setIdeaStatus } from "../actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Idea Backlog" };

const TABS = [
  { id: "backlog", label: "Backlog" },
  { id: "picked", label: "Diproduksi" },
  { id: "rejected", label: "Dibuang" },
] as const;
const SOURCE: Record<string, string> = { m2: "Riset M2", m7: "Dari analitik M7", manual: "Manual" };

export default async function IdeasPage({ searchParams }: PageProps<"/ideas">) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.status)?.id ?? "backlog";
  const { supabase, channel } = await getActiveChannel();
  if (!channel)
    return (
      <>
        <PageHeader title="Idea Backlog" />
        <NeedChannel />
      </>
    );
  const statuses = tab === "picked" ? ["picked", "produced"] : [tab];
  const [{ data: ideas }, { data: pending }] = await Promise.all([
    supabase.from("ideas").select("*").eq("channel_id", channel.id).in("status", statuses).order("score", { ascending: false }).limit(300),
    supabase.from("jobs").select("id").eq("channel_id", channel.id).eq("stage", "module").contains("payload", { module: 2 }).in("status", ["queued", "running"]),
  ]);
  const generating = (pending ?? []).length > 0;

  return (
    <>
      <AutoRefresh active={generating} />
      <PageHeader
        title="Idea Backlog"
        description="Ide diurutkan berdasarkan skor potensi. Klik Produksi untuk memulai pipeline: skrip → voice-over → render → QC → review."
        actions={
          <ActionButton run={runChannelModule.bind(null, channel.id, 2, 100)} disabled={generating}>
            {generating ? "Membuat ide…" : "Generate 100 ide (M2)"}
          </ActionButton>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tambah ide manual</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionForm action={addIdea} resetOnSuccess className="flex flex-col gap-2 md:flex-row">
            <input type="hidden" name="channel_id" value={channel.id} />
            <Input name="title" placeholder="Judul ide" required className="md:flex-[2]" />
            <Input name="angle" placeholder="Sudut pandang unik" className="md:flex-[2]" />
            <Input name="score" type="number" min={0} max={100} defaultValue={60} className="md:w-24" aria-label="Skor" />
            <SubmitButton>Tambah</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/ideas?status=${t.id}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              tab === t.id ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {(ideas ?? []).length === 0 ? (
        <EmptyState
          title={tab === "backlog" ? "Backlog kosong" : "Belum ada ide di sini"}
          description={tab === "backlog" ? "Jalankan Generate 100 ide (M2) atau tambahkan ide manual." : undefined}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {(ideas ?? []).map((i) => (
            <li key={i.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold tabular-nums text-primary">
                {Math.round(Number(i.score))}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium leading-snug">{i.title}</p>
                {i.angle && <p className="text-sm text-muted-foreground">{i.angle}</p>}
                {i.reason && <p className="text-xs text-muted-foreground/80">{i.reason}</p>}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary">{SOURCE[i.source] ?? i.source}</Badge>
                  {i.category && <Badge variant="outline">{i.category}</Badge>}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {tab === "backlog" && (
                  <>
                    <ActionButton size="sm" run={produceIdea.bind(null, i.id, "long")}>
                      Produksi
                    </ActionButton>
                    <ActionButton size="sm" variant="outline" run={produceIdea.bind(null, i.id, "short")}>
                      Shorts
                    </ActionButton>
                    <ActionButton size="sm" variant="ghost" run={setIdeaStatus.bind(null, i.id, "rejected")}>
                      Buang
                    </ActionButton>
                  </>
                )}
                {tab === "rejected" && (
                  <ActionButton size="sm" variant="outline" run={setIdeaStatus.bind(null, i.id, "backlog")}>
                    Kembalikan
                  </ActionButton>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
