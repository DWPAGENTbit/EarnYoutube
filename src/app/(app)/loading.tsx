import Image from "next/image";

/** Tampil seketika saat pindah halaman, selama data halaman tujuan dimuat. */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[65vh] flex-col items-center justify-center gap-6 animate-in fade-in duration-300"
    >
      <div className="relative grid size-24 place-items-center">
        <span className="absolute inset-0 rounded-full border-[3px] border-white/15" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--brand-cyan)] border-r-white/70 [animation-duration:900ms]" />
        <span className="absolute inset-3 animate-ping rounded-full bg-white/10 [animation-duration:1.8s]" />
        <span className="relative grid size-12 place-items-center rounded-2xl bg-white shadow-lg">
          <Image src="/logo.png" alt="" width={34} height={34} priority />
        </span>
      </div>
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium tracking-wide text-white">Memuat halaman…</p>
        <p className="text-xs text-muted-foreground">Sebentar, data sedang diambil</p>
      </div>
      <div className="w-full max-w-md space-y-2.5" aria-hidden>
        <div className="ey-shimmer h-3 w-3/4 rounded-full" />
        <div className="ey-shimmer h-3 w-full rounded-full" />
        <div className="ey-shimmer h-3 w-5/6 rounded-full" />
      </div>
    </div>
  );
}
