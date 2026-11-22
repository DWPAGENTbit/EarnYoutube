"use client";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, SubmitButton } from "@/components/app/action-ui";
import { cn } from "@/lib/utils";
import type { VideoMetadata } from "@/lib/pipeline/metadata";
import { saveMetadata } from "../../actions";

export function MetadataForm({
  videoId,
  metadata,
  thumbnail,
  thumbs,
  synthetic,
}: {
  videoId: string;
  metadata: VideoMetadata;
  thumbnail: string | null;
  thumbs: { ref: string; url: string | null }[];
  synthetic: boolean;
}) {
  const [title, setTitle] = useState(metadata.title);
  const [thumb, setThumb] = useState(thumbnail ?? thumbs[0]?.ref ?? "");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Judul, thumbnail & metadata</CardTitle>
        <CardDescription>Chapters dan kredit lisensi aset sudah dimasukkan ke deskripsi secara otomatis.</CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm action={saveMetadata} className="grid gap-5 lg:grid-cols-2">
          <input type="hidden" name="video_id" value={videoId} />
          <input type="hidden" name="thumbnail" value={thumb} />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Judul ({title.length}/100)</Label>
              <Input id="title" name="title" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
              <div className="flex flex-wrap gap-1.5">
                {metadata.title_options.map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setTitle(t)}
                    className={cn("rounded-full border px-2.5 py-1 text-left text-xs hover:bg-muted", t === title && "border-primary bg-primary/10")}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea id="description" name="description" rows={10} defaultValue={metadata.description} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tag (pisahkan koma)</Label>
              <Input id="tags" name="tags" defaultValue={metadata.tags.join(", ")} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="synthetic" defaultChecked={synthetic} className="mt-1" />
              <span>
                <b>Konten sintetis (AI disclosure)</b> — set <code>containsSyntheticMedia</code>. Wajib aktif bila suara/visual
                realistis dibuat AI.
              </span>
            </label>
          </div>
          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {thumbs.map((t, k) => (
                <button
                  type="button"
                  key={t.ref}
                  onClick={() => setThumb(t.ref)}
                  className={cn("overflow-hidden rounded-lg border-2", thumb === t.ref ? "border-primary" : "border-transparent")}
                >
                  {t.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.url} alt={`Thumbnail ${k + 1}`} className="aspect-video w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
            {metadata.chapters.length > 0 && (
              <div className="pt-2 text-sm">
                <p className="font-medium">Chapters</p>
                <ul className="text-muted-foreground">
                  {metadata.chapters.map((c) => (
                    <li key={c.start}>
                      {Math.floor(c.start / 60)}:{String(Math.floor(c.start % 60)).padStart(2, "0")} {c.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="pt-4">
              <SubmitButton>Simpan metadata</SubmitButton>
            </div>
          </div>
        </ActionForm>
      </CardContent>
    </Card>
  );
}
