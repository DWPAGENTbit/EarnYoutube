"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approve, reject } from "../actions";

export function ReviewActions({
  videoId,
  qcPassed,
  defaultPrivacy,
}: {
  videoId: string;
  qcPassed: boolean;
  defaultPrivacy: "private" | "unlisted" | "public";
}) {
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const doApprove = () => {
    if (!qcPassed && !window.confirm("Masih ada cek QC yang gagal. Tetap setujui?")) return;
    start(async () => {
      const publishAt = when ? new Date(when).toISOString() : null;
      const r = await approve(videoId, privacy, publishAt);
      (r.ok ? toast.success : toast.error)(r.message);
      router.refresh();
    });
  };
  const doReject = () =>
    start(async () => {
      const r = await reject(videoId, notes);
      (r.ok ? toast.success : toast.error)(r.message);
      router.refresh();
    });

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`p-${videoId}`}>Privasi</Label>
          <select
            id={`p-${videoId}`}
            value={privacy}
            disabled={!!when}
            onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`w-${videoId}`}>Jadwal tayang (opsional)</Label>
          <Input id={`w-${videoId}`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </div>
      </div>
      {when && <p className="text-xs text-muted-foreground">Video diunggah sebagai private lalu otomatis tayang publik pada jadwal ini.</p>}
      <Button className="w-full" onClick={doApprove} disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Setujui & unggah
      </Button>
      <div className="space-y-1.5 border-t pt-3">
        <Textarea placeholder="Catatan penolakan (opsional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button variant="destructive" className="w-full" onClick={doReject} disabled={pending}>
          Tolak
        </Button>
      </div>
    </div>
  );
}
