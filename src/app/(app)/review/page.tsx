import Link from "next/link";
import { getActiveChannel } from "@/lib/supabase/server";
import { signedUrl } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, NeedChannel, PageHeader } from "@/components/app/ui-bits";
import { QcList } from "@/components/app/qc-list";
import { channelSettings, type Video } from "@/lib/types";
import { ReviewActions } from "./review-actions";

export const metadata = { title: "Review Queue" };

export default async function ReviewPage() {
  const { supabase, channel } = await getActiveChannel();
  if (!channel)
    return (
      <>
        <PageHeader title="Review Queue" />
        <NeedChannel />
      </>
    );
  const s = channelSettings(channel);
  const { data } = await supabase
    .from("videos")
    .select("*")
    .eq("channel_id", channel.id)
    .eq("status", "review")
    .order("updated_at", { ascending: true });
  const videos = (data ?? []) as Video[];
  const items = await Promise.all(
    videos.map(async (v) => ({ v, render: await signedUrl(v.render_url), thumb: await signedUrl(v.thumbnail_url) })),
  );

  return (
    <>
      <PageHeader
        title="Review Queue"
        description={
          <>
            Tidak ada video yang tayang tanpa persetujuan Anda. Auto-publish:{" "}
            <b>{s.auto_publish ? "AKTIF (hanya video yang lolos semua QC)" : "nonaktif"}</b>.
          </>
        }
      />
      {!channel.yt_channel_id && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Akun YouTube belum terhubung — persetujuan upload akan ditolak sampai Anda menghubungkannya di{" "}
          <Link className="underline" href="/channel">Channel Setup</Link>.
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState title="Antrean review kosong" description="Video yang lolos produksi & QC otomatis akan muncul di sini." />
      ) : (
        <div className="space-y-4">
          {items.map(({ v, render, thumb }) => (
            <Card key={v.id}>
              <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                  {render && (
                    <video
                      src={render}
                      controls
                      preload="metadata"
                      poster={thumb ?? undefined}
                      className={v.format === "short" ? "mx-auto aspect-[9/16] max-h-[60vh] rounded-lg bg-black" : "aspect-video w-full rounded-lg bg-black"}
                    />
                  )}
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{v.format === "short" ? "Shorts" : "Long-form"}</Badge>
                      <span className="text-xs text-muted-foreground">{Math.round(Number(v.duration_sec ?? 0))} dtk</span>
                      {v.contains_synthetic_media && <Badge variant="outline">AI disclosure</Badge>}
                    </div>
                    <p className="font-medium">{v.metadata_json?.title}</p>
                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer">Deskripsi & tag</summary>
                      <p className="mt-2 whitespace-pre-line">{v.metadata_json?.description}</p>
                      <p className="mt-2 text-xs">{v.metadata_json?.tags.join(", ")}</p>
                    </details>
                  </div>
                </div>
                <div className="space-y-4">
                  {v.qc_json && (
                    <div className="rounded-lg border p-3">
                      <p className="mb-2 text-sm font-medium">
                        QC: {v.qc_json.passed ? "semua lolos" : `${v.qc_json.checks.filter((c) => !c.pass).length} catatan`}
                      </p>
                      <QcList qc={v.qc_json} />
                    </div>
                  )}
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/studio/${v.id}`}>Edit di Studio</Link>
                  </Button>
                  <ReviewActions videoId={v.id} qcPassed={!!v.qc_json?.passed} defaultPrivacy={s.default_privacy} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
