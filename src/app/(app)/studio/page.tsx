import Link from "next/link";
import { getActiveChannel } from "@/lib/supabase/server";
import { AutoRefresh } from "@/components/app/action-ui";
import { EmptyState, NeedChannel, PageHeader, StatusBadge, fmtDate } from "@/components/app/ui-bits";
import { PipelineSteps } from "@/components/app/pipeline-steps";
import type { Video } from "@/lib/types";

export const metadata = { title: "Studio" };

const ACTIVE = ["queued", "scripting", "voicing", "assets", "rendering", "qc"];

export default async function StudioPage() {
  const { supabase, channel } = await getActiveChannel();
  if (!channel)
    return (
      <>
        <PageHeader title="Studio" />
        <NeedChannel />
      </>
    );
  const { data } = await supabase
    .from("videos")
    .select("id,status,format,metadata_json,updated_at,parent_video_id,idea_id,ideas(title)")
    .eq("channel_id", channel.id)
    .order("updated_at", { ascending: false })
    .limit(100);
  const videos = (data ?? []) as unknown as (Video & { ideas: { title: string } | null })[];
  const active = videos.some((v) => ACTIVE.includes(v.status));

  return (
    <>
      <AutoRefresh active={active} />
      <PageHeader
        title="Studio"
        description="Semua video di kanal ini. Buka video untuk mengedit skrip per scene, mendengar voice-over, mengganti aset, dan memilih thumbnail."
      />
      {videos.length === 0 ? (
        <EmptyState
          title="Belum ada video"
          description="Mulai dari Idea Backlog: pilih ide lalu klik Produksi."
          action={<Link className="text-sm font-medium text-primary" href="/ideas">Buka Idea Backlog →</Link>}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {videos.map((v) => (
            <li key={v.id}>
              <Link href={`/studio/${v.id}`} className="flex flex-col gap-3 p-4 hover:bg-muted/40 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{v.metadata_json?.title ?? v.ideas?.title ?? "Video"}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.format === "short" ? "Shorts 9:16" : "Long-form 16:9"}
                    {v.parent_video_id ? " · repurpose" : ""} · diperbarui {fmtDate(v.updated_at)}
                  </p>
                </div>
                <PipelineSteps status={v.status} compact />
                <StatusBadge status={v.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
