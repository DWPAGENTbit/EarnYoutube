import Image from "next/image";

/** Tampil seketika saat pindah halaman, selama data halaman tujuan dimuat. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="relative grid size-14 shrink-0 place-items-center">
          <span className="absolute inset-0 rounded-full border-[3px] border-foreground/10" />
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-[var(--teal)] border-r-foreground/70 [animation-duration:900ms]" />
          <span className="relative grid size-9 place-items-center rounded-full bg-white shadow-md">
            <Image src="/logo.png" alt="" width={22} height={22} priority />
          </span>
        </div>
        <div>
          <p className="text-lg font-semibold">Memuat halaman…</p>
          <p className="text-sm text-foreground/55">Sebentar, data sedang diambil</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-strong space-y-3 rounded-[28px] p-5">
            <div className="ey-shimmer h-3 w-1/3 rounded-full" />
            <div className="ey-shimmer h-8 w-2/3 rounded-xl" />
            <div className="ey-shimmer h-3 w-1/2 rounded-full" />
          </div>
        ))}
      </div>
      <div className="glass-strong space-y-3 rounded-[28px] p-5" aria-hidden>
        <div className="ey-shimmer h-3 w-1/4 rounded-full" />
        <div className="ey-shimmer h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
