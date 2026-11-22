"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, MailCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { authAction, type AuthState } from "./actions";

type Mode = "signin" | "signup";
const REDIRECT_MS = 1400;

export function LoginCard({
  initialError,
  initialNotice,
  configured,
}: {
  initialError: string | null;
  initialNotice: string | null;
  configured: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [showPw, setShowPw] = useState(false);
  const [state, formAction, pending] = useActionState<AuthState, FormData>(authAction, { status: "idle" });
  const [dismissedAt, setDismissedAt] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Kartu bergetar setiap kali login gagal (tanpa me-mount ulang form).
  useEffect(() => {
    if (state.status !== "error") return;
    cardRef.current?.animate(
      [0, -8, 8, -8, 8, 0].map((x) => ({ transform: `translateX(${x}px)` })),
      { duration: 450, easing: "ease-in-out" },
    );
  }, [state]);

  // Setelah animasi "berhasil" selesai, pindah ke dashboard.
  useEffect(() => {
    if (state.status !== "success") return;
    router.prefetch("/dashboard");
    const t = setTimeout(() => router.replace("/dashboard"), REDIRECT_MS);
    return () => clearTimeout(t);
  }, [state, router]);

  const error = state.status === "error" ? state.message : state.status === "idle" ? initialError : null;
  const notice = state.status === "idle" ? initialNotice : null;
  const showNotice = state.status === "notice" && state.at !== dismissedAt;
  const lastEmail = state.status === "error" ? state.email : "";
  const signup = mode === "signup";

  return (
    <div className="relative z-10 w-full max-w-[420px]">
      <div
        ref={cardRef}
        className="glass-strong rounded-[32px] p-7 sm:p-8 animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-700 ease-out fill-mode-both"
      >
        {/* Kepala kartu */}
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 delay-150 duration-500 fill-mode-both">
          <span className="grid size-12 place-items-center rounded-full bg-white shadow-[0_8px_20px_-10px_rgb(60_40_20/0.6)]">
            <Image src="/logo.png" alt="EarnYoutube" width={30} height={30} priority />
          </span>
          <div>
            <p className="text-sm font-semibold">EarnYoutube</p>
            <p className="text-xs text-foreground/55">YouTube Auto Creator</p>
          </div>
        </div>
        <h1 className="mt-6 text-[28px] leading-tight font-semibold tracking-tight animate-in fade-in slide-in-from-bottom-2 delay-200 duration-500 fill-mode-both">
          {state.status === "success" ? "Berhasil masuk" : signup ? "Buat akun baru" : "Selamat datang kembali"}
        </h1>
        <p className="mt-1 text-sm text-foreground/60 animate-in fade-in delay-300 duration-500 fill-mode-both">
          {signup ? "Daftar untuk mulai mengotomasi kanal Anda." : "Masuk untuk melanjutkan produksi video."}
        </p>

        {state.status !== "success" && !showNotice && (
          <div
            role="tablist"
            className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-foreground/[0.06] p-1 animate-in fade-in delay-300 duration-500 fill-mode-both"
          >
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                disabled={pending}
                onClick={() => setMode(m)}
                className={cn(
                  "h-9 rounded-full text-sm font-medium transition-all duration-300",
                  mode === m ? "bg-white text-foreground shadow-[0_4px_14px_-6px_rgb(60_40_20/0.5)]" : "text-foreground/55 hover:text-foreground",
                )}
              >
                {m === "signin" ? "Masuk" : "Daftar"}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          {state.status === "success" ? (
            <SuccessView message={state.message} />
          ) : showNotice && state.status === "notice" ? (
            <NoticeView
              message={state.message}
              onBack={() => {
                setMode("signin");
                setDismissedAt(state.at);
              }}
            />
          ) : (
            <form action={formAction} className="space-y-3.5">
              <input type="hidden" name="mode" value={mode} />

              {!configured && (
                <p className="rounded-2xl bg-amber-400/20 p-3 text-xs leading-relaxed text-amber-900">
                  Supabase belum dikonfigurasi di server (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).
                </p>
              )}
              {error && (
                <p role="alert" className="rounded-2xl bg-red-500/12 px-3.5 py-2.5 text-sm text-red-800">
                  {error}
                </p>
              )}
              {notice && <p className="rounded-2xl bg-white/60 px-3.5 py-2.5 text-sm">{notice}</p>}

              <Field
                icon={Mail}
                name="email"
                type="email"
                placeholder="Email"
                autoComplete="email"
                defaultValue={lastEmail}
                disabled={pending}
                delay="delay-300"
              />
              <Field
                icon={Lock}
                name="password"
                type={showPw ? "text" : "password"}
                placeholder={signup ? "Kata sandi (min. 8 karakter)" : "Kata sandi"}
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 8 : undefined}
                disabled={pending}
                delay="delay-500"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="grid size-8 place-items-center rounded-full text-foreground/55 transition-colors hover:bg-foreground/5 hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                }
              />

              <div className="pt-2 animate-in fade-in slide-in-from-bottom-2 delay-700 duration-500 fill-mode-both">
                <button
                  type="submit"
                  disabled={pending}
                  className={cn(
                    "group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-medium text-background",
                    "shadow-[0_14px_28px_-14px_rgb(20_14_10/0.9)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0",
                    "focus-visible:ring-4 focus-visible:ring-[var(--teal)]/35 focus-visible:outline-none disabled:cursor-wait disabled:opacity-80",
                  )}
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Memproses…
                    </>
                  ) : (
                    <>
                      {signup ? "Buat akun" : "Masuk"}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  trailing,
  delay,
  ...input
}: React.ComponentProps<"input"> & { icon: typeof Mail; trailing?: React.ReactNode; delay: string }) {
  return (
    <label className={cn("relative block animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both", delay)}>
      <span className="sr-only">{input.placeholder}</span>
      <Icon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-foreground/45" />
      <input
        {...input}
        required
        className={cn(
          "h-12 w-full rounded-2xl border border-white/80 bg-white/65 pr-12 pl-11 text-[15px] shadow-[inset_0_1px_2px_rgb(60_40_20/0.06)]",
          "placeholder:text-foreground/45",
          "transition-all duration-200 outline-none focus:border-[var(--teal)] focus:bg-white focus:ring-4 focus:ring-[var(--teal)]/15",
          "disabled:opacity-70",
        )}
      />
      {trailing && <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</span>}
    </label>
  );
}

function SuccessView({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center py-4 text-center">
      <div className="ey-pop grid size-20 place-items-center rounded-full bg-gradient-to-br from-[oklch(0.66_0.085_175)] to-[oklch(0.5_0.08_182)] shadow-[0_14px_30px_-12px_oklch(0.45_0.08_180/0.8)]">
        <svg viewBox="0 0 52 52" className="size-11" aria-hidden>
          <path
            pathLength={100}
            d="M14 27 l8 8 l16 -18"
            fill="none"
            stroke="#ffffff"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ey-draw"
          />
        </svg>
      </div>
      <p className="mt-5 text-lg font-semibold animate-in fade-in slide-in-from-bottom-2 delay-300 duration-500 fill-mode-both">
        {message}
      </p>
      <p className="mt-1 text-sm text-foreground/60 animate-in fade-in delay-500 duration-500 fill-mode-both">
        Mengalihkan ke dashboard…
      </p>
      <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,oklch(0.3_0.01_60/0.12)_0_2px,transparent_2px_6px)]">
        <div className="ey-fill h-full rounded-full bg-gradient-to-r from-[var(--teal-deep)] to-[var(--teal)]" />
      </div>
    </div>
  );
}

function NoticeView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div role="status" className="flex flex-col items-center py-2 text-center">
      <div className="ey-pop grid size-16 place-items-center rounded-full bg-white shadow-md">
        <MailCheck className="size-8 text-[var(--teal)]" />
      </div>
      <p className="mt-4 font-semibold">Cek email Anda</p>
      <p className="mt-1 text-sm leading-relaxed text-foreground/65">{message}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-white/80"
      >
        Kembali ke login
      </button>
    </div>
  );
}
