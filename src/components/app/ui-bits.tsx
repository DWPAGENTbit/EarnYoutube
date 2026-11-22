import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type VideoStatus } from "@/lib/types";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-[40px] md:leading-[1.1]">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-foreground/60 md:text-[15px]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_DOT: Partial<Record<VideoStatus, string>> = {
  review: "bg-amber-500",
  approved: "bg-sky-500",
  uploading: "bg-sky-500",
  uploaded: "bg-emerald-500",
  scheduled: "bg-violet-500",
  published: "bg-emerald-500",
  failed: "bg-red-500",
  rejected: "bg-stone-400",
};

/** Status dengan titik warna, seperti kolom status tabel. */
export function StatusBadge({ status }: { status: VideoStatus }) {
  const dot = STATUS_DOT[status] ?? "bg-[var(--teal)] animate-pulse";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/55 px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-[inset_0_0_0_1px_rgb(255_255_255/0.7)]">
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      {STATUS_LABEL[status] ?? status}
    </span>
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
    <div className="flex flex-col items-center justify-center gap-2 rounded-[28px] border border-dashed border-foreground/15 bg-white/25 px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
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
        <Link
          href="/channel"
          className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background shadow-md transition-transform hover:-translate-y-px"
        >
          Buka Channel Setup
        </Link>
      }
    />
  );
}

/** Ubin angka. tone="teal" untuk ubin sorotan berwarna. */
export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "glass",
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "glass" | "teal";
  trend?: { value: string; up: boolean } | null;
}) {
  const teal = tone === "teal";
  return (
    <div
      className={cn(
        "relative flex min-h-32 flex-col justify-between overflow-hidden rounded-3xl p-4",
        teal
          ? "bg-gradient-to-br from-[oklch(0.66_0.085_175)] to-[oklch(0.5_0.08_182)] text-white shadow-[0_14px_30px_-14px_oklch(0.45_0.08_180/0.8)]"
          : "glass-strong",
      )}
    >
      {teal && <span aria-hidden className="hatch pointer-events-none absolute inset-0 opacity-30" />}
      <div className="relative flex items-start justify-between gap-2">
        <p className={cn("text-[13px] font-medium", teal ? "text-white/85" : "text-foreground/65")}>{label}</p>
        {Icon && (
          <span className={cn("grid size-7 shrink-0 place-items-center rounded-full", teal ? "bg-white/20" : "bg-white shadow-sm")}>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div className="relative">
        <p className="text-[28px] leading-tight font-semibold tracking-tight tabular-nums">{value}</p>
        {(trend || hint) && (
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            {trend && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-semibold",
                  teal ? "bg-white/20" : trend.up ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700",
                )}
              >
                {trend.up ? "↑" : "↓"} {trend.value}
              </span>
            )}
            {hint && <span className={teal ? "text-white/75" : "text-foreground/55"}>{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Progress bar bergaya "batas pengeluaran": isi teal + sisa bergaris. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-foreground/60">
          <b className="font-semibold text-foreground">{value.toLocaleString("id-ID")}</b> / {max.toLocaleString("id-ID")}
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,oklch(0.3_0.01_60/0.12)_0_2px,transparent_2px_6px)] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.6)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--teal-deep)] to-[var(--teal)] transition-[width] duration-700"
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export const fmtNum = (n: number | null | undefined) => (n == null ? "–" : Number(n).toLocaleString("id-ID"));
export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "–";
