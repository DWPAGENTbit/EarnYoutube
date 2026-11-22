"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { M3Output } from "@/lib/ai/schemas";
import { saveScript, swapSceneAsset } from "../../actions";

export interface SceneMedia {
  voiceUrl: string | null;
  voiceDuration: number | null;
  visualUrl: string | null;
  visualKind: "image" | "video" | null;
  license: string | null;
}

export function ScriptEditor({
  videoId,
  script,
  media,
  editable,
}: {
  videoId: string;
  script: M3Output;
  media: SceneMedia[];
  editable: boolean;
}) {
  const [draft, setDraft] = useState(script);
  const [pending, start] = useTransition();
  const [swapping, setSwapping] = useState<number | null>(null);
  const router = useRouter();
  const dirty = JSON.stringify(draft) !== JSON.stringify(script);

  const update = (i: number, patch: Partial<M3Output["scenes"][number]>) =>
    setDraft((d) => ({ ...d, scenes: d.scenes.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Skrip per scene</CardTitle>
          <CardDescription>
            Menyimpan editan membuat versi skrip baru lalu mengulang voice-over, aset, dan render. Ganti visual satu scene
            tanpa mengubah skrip lewat tombol ganti aset.
          </CardDescription>
        </div>
        {editable && (
          <Button
            disabled={!dirty || pending}
            onClick={() =>
              start(async () => {
                const r = await saveScript(videoId, draft);
                (r.ok ? toast.success : toast.error)(r.message);
                router.refresh();
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            Simpan & produksi ulang
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-sm md:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Hook</p>
            <ul className="mt-1 list-disc pl-4">
              {script.hooks.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Taktik retensi</p>
            <ul className="mt-1 list-disc pl-4">
              {script.retention_tactics.slice(0, 4).map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">CTA</p>
            <p className="mt-1">{script.cta}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">Alasan (rationale)</summary>
              <p className="mt-1 text-xs">{script.rationale}</p>
            </details>
          </div>
        </div>

        <ol className="space-y-3">
          {draft.scenes.map((s, i) => {
            const m = media[i];
            return (
              <li key={i} className="grid gap-3 rounded-lg border p-3 md:grid-cols-[200px_1fr]">
                <div className="space-y-2">
                  <div className="aspect-video overflow-hidden rounded-md bg-muted">
                    {m?.visualUrl &&
                      (m.visualKind === "video" ? (
                        <video src={m.visualUrl} muted loop playsInline className="size-full object-cover" onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => e.currentTarget.pause()} />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.visualUrl} alt="" className="size-full object-cover" />
                      ))}
                  </div>
                  {m?.license && <p className="line-clamp-2 text-[11px] text-muted-foreground" title={m.license}>{m.license}</p>}
                  {m?.voiceUrl && <audio src={m.voiceUrl} controls className="h-8 w-full" />}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Scene {i + 1}
                      {i === 0 ? " · hook" : ""}
                      {s.chapter_title ? ` · bab: ${s.chapter_title}` : ""}
                    </span>
                    <span>{m?.voiceDuration ? `${m.voiceDuration.toFixed(1)} dtk` : `~${s.duration_sec} dtk`}</span>
                  </div>
                  <Textarea
                    value={s.narration}
                    disabled={!editable}
                    rows={3}
                    onChange={(e) => update(i, { narration: e.target.value })}
                    aria-label={`Narasi scene ${i + 1}`}
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Teks di layar</Label>
                      <Input value={s.on_screen_text} disabled={!editable} onChange={(e) => update(i, { on_screen_text: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Kata kunci stok (EN)</Label>
                      <div className="flex gap-1.5">
                        <Input value={s.stock_query} disabled={!editable} onChange={(e) => update(i, { stock_query: e.target.value })} />
                        {editable && (
                          <Button
                            variant="outline"
                            size="icon"
                            title="Ganti aset scene ini"
                            disabled={swapping !== null}
                            onClick={async () => {
                              setSwapping(i);
                              const r = await swapSceneAsset(videoId, i, s.stock_query);
                              (r.ok ? toast.success : toast.error)(r.message);
                              setSwapping(null);
                              router.refresh();
                            }}
                          >
                            {swapping === i ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
