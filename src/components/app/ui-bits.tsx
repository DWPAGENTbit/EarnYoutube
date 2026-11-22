import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type VideoStatus } from "@/lib/types";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_TONE: Partial<Record<VideoStatus, string>> = {
  review: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  uploading: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  uploaded: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  scheduled: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  published: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/15 text-destructive",
  rejected: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", STATUS_TONE[status] ?? "bg-primary/10 text-primary")}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function NeedChannel() {
  return (
    <EmptyState
      title="Belum ada kanal"
      description="Buat kanal dulu di Channel Setup: isi niche, audiens, dan tujuan, lalu hubungkan akun YouTube."
      action={
        <Link href="/channel" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          Buka Channel Setup →
        </Link>
      }
    />
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value.toLocaleString("id-ID")} / {max.toLocaleString("id-ID")}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const fmtNum = (n: number | null | undefined) => (n == null ? "–" : Number(n).toLocaleString("id-ID"));
export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "–";
