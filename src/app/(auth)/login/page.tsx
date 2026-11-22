import { Clapperboard, Eye, Sparkles } from "lucide-react";
import { LoginCard } from "./login-card";

export const metadata = { title: "Masuk" };

const BARS = [38, 52, 44, 70, 58, 92, 64];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* Cahaya hangat yang melayang pelan */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ey-float absolute -top-24 -left-24 size-96 rounded-full bg-white/40 blur-3xl" />
        <div className="ey-float absolute -right-24 -bottom-32 size-[30rem] rounded-full bg-[oklch(0.75_0.07_175/0.35)] blur-3xl [animation-delay:-4s]" />
        <div className="ey-float absolute top-1/4 right-1/3 size-48 rounded-full bg-[oklch(0.85_0.06_70/0.45)] blur-2xl [animation-delay:-2s]" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_420px]">
        {/* Etalase: cuplikan dashboard, hanya di layar lebar */}
        <section aria-hidden className="hidden lg:block">
          <p className="text-sm font-medium text-foreground/60 animate-in fade-in duration-700 fill-mode-both">EarnYoutube</p>
          <h2 className="mt-2 max-w-md text-[44px] leading-[1.05] font-semibold tracking-tight animate-in fade-in slide-in-from-bottom-3 delay-100 duration-700 fill-mode-both">
            Kanal YouTube yang jalan sendiri.
          </h2>
          <p className="mt-3 max-w-sm text-[15px] text-foreground/60 animate-in fade-in delay-200 duration-700 fill-mode-both">
            Riset ide, skrip, voice-over, render, sampai upload terjadwal. Anda cukup review.
          </p>

          <div className="relative mt-9 h-[300px] max-w-lg">
            <div className="glass absolute top-0 left-0 w-64 rounded-[28px] p-4 animate-in fade-in slide-in-from-bottom-6 delay-300 duration-700 fill-mode-both">
              <div className="flex items-center justify-between text-xs text-foreground/60">
                <span>Views minggu ini</span>
                <span className="rounded-full bg-white px-2 py-0.5 font-medium text-foreground shadow-sm">7 hari</span>
              </div>
              <div className="mt-4 flex h-28 items-end gap-2">
                {BARS.map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className={
                      i === 5
                        ? "flex-1 rounded-lg bg-[var(--chart-2)]"
                        : "flex-1 rounded-lg bg-[repeating-linear-gradient(135deg,var(--teal)_0_4px,oklch(0.74_0.07_178)_4px_7px)]"
                    }
                  />
                ))}
              </div>
            </div>

            <div className="absolute top-8 left-72 w-48 overflow-hidden rounded-3xl bg-gradient-to-br from-[oklch(0.66_0.085_175)] to-[oklch(0.5_0.08_182)] p-4 text-white shadow-[0_20px_40px_-18px_oklch(0.45_0.08_180/0.9)] animate-in fade-in slide-in-from-bottom-6 delay-500 duration-700 fill-mode-both">
              <span className="hatch pointer-events-none absolute inset-0 opacity-30" />
              <div className="relative flex items-center justify-between text-xs text-white/85">
                Total views
                <span className="grid size-7 place-items-center rounded-full bg-white/20">
                  <Eye className="size-3.5" />
                </span>
              </div>
              <p className="relative mt-5 text-3xl font-semibold tracking-tight">128,4 rb</p>
              <p className="relative mt-1 text-[11px] text-white/80">↑ 24% dari bulan lalu</p>
            </div>

            <div className="glass-strong absolute top-48 left-24 flex items-center gap-3 rounded-full py-2 pr-5 pl-2 animate-in fade-in slide-in-from-bottom-6 delay-700 duration-700 fill-mode-both">
              <span className="grid size-10 place-items-center rounded-full bg-foreground text-background">
                <Clapperboard className="size-4" />
              </span>
              <div className="text-sm">
                <p className="font-semibold">Video siap direview</p>
                <p className="text-xs text-foreground/55">QC lolos · jadwal 19.00 WIB</p>
              </div>
            </div>

            <div className="glass-strong absolute top-64 left-80 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium animate-in fade-in zoom-in-90 delay-1000 duration-700 fill-mode-both">
              <Sparkles className="size-3.5 text-[var(--teal)]" /> 12 ide baru dari AI
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[420px]">
          <LoginCard initialError={error} initialNotice={notice} configured={configured} />
        </div>
      </div>
    </main>
  );
}
