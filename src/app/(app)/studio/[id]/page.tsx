import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActionButton, AutoRefresh } from "@/components/app/action-ui";
import { PageHeader, StatusBadge, fmtDate } from "@/components/app/ui-bits";
import { PipelineSteps } from "@/components/app/pipeline-steps";
import { QcList } from "@/components/app/qc-list";
import { ScriptEditor, type SceneMedia } from "./script-editor";
import { MetadataForm } from "./metadata-form";
import { rerender, retry } from "../../actions";
import type { Job, ScriptRow, Video } from "@/lib/types";

export const metadata = { title: "Studio" };

const ACTIVE = ["queued", "scripting", "voicing", "assets", "rendering", "qc", "approved", "uploading"];

export default async function VideoStudioPage({ params }: PageProps<"/studio/[id]">) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data: v } = await supabase.from("videos").select("*").eq("id", id).maybeSingle();
  if (!v) notFound();
  const video = v as Video;
  const [{ data: script }, { data: assets }, { data: jobs }, { data: children }, { data: upload }] = await Promise.all([
    video.script_id ? supabase.from("scripts").select("*").eq("id", video.script_id).single() : Promise.resolve({ data: null }),
    supabase.from("assets").select("*").eq("video_id", id).order("scene_index"),
    supabase.from("jobs").select("*").eq("video_id", id).order("created_at", { ascending: false }).limit(8),
    supabase.from("videos").select("id,status,format").eq("parent_video_id", id),
    supabase.from("uploads").select("*").eq("video_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const media: SceneMedia[] = [];
  const sc = script as ScriptRow | null;
  if (sc) {
    for (let i = 0; i < sc.json.scenes.length; i++) {
      const voice = (assets ?? []).find((a) => a.type === "voice" && a.scene_index === i);
      const visual = (assets ?? []).find((a) => (a.type === "image" || a.type === "video") && a.scene_index === i);
      media.push({
        voiceUrl: await signedUrl(voice?.url),
        voiceDuration: voice ? Number(voice.meta?.duration) : null,
        visualUrl: await signedUrl(visual?.url),
        visualKind: (visual?.type as "image" | "video") ?? null,
        license: visual?.license_source ?? null,
      });
    }
  }
  const renderUrl = await signedUrl(video.render_url);
  const thumbs = await Promise.all(
    (video.metadata_json?.thumbnail_options ?? []).map(async (ref) => ({ ref, url: await signedUrl(ref) })),
  );
  const lastJob = (jobs ?? [])[0] as Job | undefined;
  const running = ACTIVE.includes(video.status);

  return (
    <>
      <AutoRefresh active={running} seconds={6} />
      <PageHeader
        title={video.metadata_json?.title ?? "Video dalam produksi"}
        description={
          <>
            {video.format === "short" ? "Shorts 9:16" : "Long-form 16:9"} · target {video.target_duration_sec} dtk
            {video.duration_sec ? ` · hasil ${Math.round(Number(video.duration_sec))} dtk` : ""}
            {sc ? ` · skrip v${sc.version}` : ""}
            {video.parent_video_id && (
              <>
                {" · "}
                <Link className="underline" href={`/studio/${video.parent_video_id}`}>
                  video induk
                </Link>
              </>
            )}
          </>
        }
        actions={
          <>
            <StatusBadge status={video.status} />
            {video.status === "failed" && <ActionButton run={retry.bind(null, id)}>Ulangi tahap gagal</ActionButton>}
            {["review", "failed", "rejected"].includes(video.status) && sc && (
              <ActionButton variant="outline" run={rerender.bind(null, id)}>
                Render ulang
              </ActionButton>
            )}
            {video.status === "review" && (
              <Link href="/review" className="text-sm font-medium text-primary">
                Ke Review Queue →
              </Link>
            )}
          </>
        }
      />
      <PipelineSteps status={video.status} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {renderUrl ? (
              <video
                src={renderUrl}
                controls
                className={video.format === "short" ? "mx-auto aspect-[9/16] max-h-[70vh] rounded-lg bg-black" : "aspect-video w-full rounded-lg bg-black"}
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                {running ? "Video sedang diproduksi…" : "Belum ada render"}
              </div>
            )}
            {upload?.yt_video_id && (
              <p className="mt-3 text-sm">
                YouTube:{" "}
                <a className="text-primary underline" href={`https://youtu.be/${upload.yt_video_id}`} target="_blank" rel="noreferrer">
                  youtu.be/{upload.yt_video_id}
                </a>{" "}
                · {upload.privacy}
                {upload.publish_at ? ` · tayang ${fmtDate(upload.publish_at)}` : ""}
              </p>
            )}
            {(children ?? []).map((c) => (
              <p key={c.id} className="mt-2 text-sm">
                Shorts repurpose:{" "}
                <Link className="text-primary underline" href={`/studio/${c.id}`}>
                  buka
                </Link>{" "}
                <StatusBadge status={c.status} />
              </p>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {video.qc_json && (
            <Card>
              <CardHeader>
                <CardTitle>QC otomatis</CardTitle>
                <CardDescription>{video.qc_json.passed ? "Semua cek lolos." : "Ada cek yang perlu perhatian sebelum disetujui."}</CardDescription>
              </CardHeader>
              <CardContent>
                <QcList qc={video.qc_json} />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Log job</CardTitle>
              <CardDescription>
                {lastJob ? `${lastJob.stage} · ${lastJob.status} · percobaan ${lastJob.attempts}/${lastJob.max_attempts}` : "Belum ada job"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lastJob?.error && <p className="mb-2 rounded-md bg-destructive/10 p-2 text-xs text-destructive">{lastJob.error}</p>}
              <ul className="max-h-64 space-y-1 overflow-auto font-mono text-[11px] text-muted-foreground">
                {(jobs ?? [])
                  .flatMap((j) => (j as Job).logs.map((l) => ({ ...l, stage: j.stage })))
                  .sort((a, b) => b.t.localeCompare(a.t))
                  .slice(0, 60)
                  .map((l, k) => (
                    <li key={k}>
                      <span className="text-foreground/60">{l.t.slice(11, 19)}</span> [{l.stage}] {l.m}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {video.metadata_json && (
        <MetadataForm videoId={id} metadata={video.metadata_json} thumbnail={video.thumbnail_url} thumbs={thumbs} synthetic={video.contains_synthetic_media} />
      )}

      {sc && (
        <ScriptEditor
          videoId={id}
          script={sc.json}
          media={media}
          editable={!["approved", "uploading", "uploaded", "scheduled", "published"].includes(video.status) && !running}
        />
      )}
    </>
  );
}
