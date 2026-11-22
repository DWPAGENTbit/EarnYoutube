import { cn } from "@/lib/utils";
import type { VideoStatus } from "@/lib/types";

const STEPS: { id: VideoStatus; label: string }[] = [
  { id: "scripting", label: "Skrip" },
  { id: "voicing", label: "Voice" },
  { id: "assets", label: "Aset" },
  { id: "rendering", label: "Render" },
  { id: "qc", label: "QC" },
  { id: "review", label: "Review" },
  { id: "uploading", label: "Upload" },
];
const ORDER: VideoStatus[] = [
  "queued", "scripting", "voicing", "assets", "rendering", "qc", "review", "approved", "uploading", "uploaded", "scheduled", "published",
];

export function PipelineSteps({ status, compact }: { status: VideoStatus; compact?: boolean }) {
  const pos = ORDER.indexOf(status);
  return (
    <ol className={cn("flex items-center gap-1", compact ? "w-full md:w-72" : "w-full")}>
      {STEPS.map((s) => {
        const i = ORDER.indexOf(s.id);
        const done = pos > i || (s.id === "uploading" && pos >= ORDER.indexOf("uploaded"));
        const current = pos === i || (s.id === "review" && status === "approved");
        return (
          <li key={s.id} className="flex flex-1 flex-col gap-1">
            <span
              className={cn(
                "h-1.5 rounded-full",
                status === "failed" || status === "rejected"
                  ? "bg-muted"
                  : done
                    ? "bg-primary"
                    : current
                      ? "animate-pulse bg-primary/60"
                      : "bg-muted",
              )}
            />
            {!compact && <span className={cn("text-[11px]", current ? "font-medium" : "text-muted-foreground")}>{s.label}</span>}
          </li>
        );
      })}
    </ol>
  );
}
