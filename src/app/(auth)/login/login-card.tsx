"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, MailCheck } from "lucide-react";
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
    <div className="relative z-10 w-full max-w-[400px]">
      <div
        ref={cardRef}
        className={cn(
          "overflow-hidden rounded-[28px] bg-white/10 shadow-[0_30px_70px_-25px_rgb(8_24_64/0.75)] ring-1 ring-white/25 backdrop-blur-2xl",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-6 duration-700 ease-out fill-mode-both",
        )}
      >
        {/* Kepala kartu */}
        <div className="rounded-b-[30px] bg-gradient-to-br from-[#1c4386] via-[#2a559c] to-[#3d6aae] px-8 pt-8 pb-7 text-center shadow-[inset_0_-14px_24px_-14px_rgb(0_0_0/0.45)]">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-white shadow-lg animate-in zoom-in-50 fade-in delay-150 duration-500 fill-mode-both">
            <Image src="/logo.png" alt="EarnYoutube" width={46} height={46} priority />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-[0.12em] text-white uppercase animate-in fade-in slide-in-from-bottom-2 delay-200 duration-500 fill-mode-both">
            {state.status === "success" ? "Selamat datang" : signup ? "Buat Akun" : "Masuk"}
          </h1>
          <p className="mt-1 text-sm text-white/70 animate-in fade-in delay-300 duration-500 fill-mode-both">
            EarnYoutube · YouTube Auto Creator
          </p>
        </div>

        <div className="px-8 pt-7 pb-8">
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
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="mode" value={mode} />

              {!configured && (
                <p className="rounded-xl border border-amber-300/50 bg-amber-400/15 p-3 text-xs leading-relaxed">
                  Supabase belum dikonfigurasi di server (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).
                </p>
              )}
              {error && (
                <p role="alert" className="rounded-xl border border-red-300/50 bg-red-400/15 px-3 py-2.5 text-sm text-red-50">
                  {error}
                </p>
              )}
              {notice && <p className="rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-sm">{notice}</p>}

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
                placeholder="Kata sandi"
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 8 : undefined}
                disabled={pending}
                delay="delay-500"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="rounded-md p-1 text-white/70 transition-colors hover:text-white"
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
                    "mx-auto flex h-12 w-4/5 items-center justify-center gap-2 rounded-full text-[15px] font-semibold tracking-[0.14em] uppercase",
                    "bg-gradient-to-r from-[#b9d3ee] to-[#e3effb] text-[#1c3f7e] shadow-[0_10px_25px_-10px_rgb(8_24_64/0.6)]",
                    "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-10px_rgb(8_24_64/0.7)] active:translate-y-0",
                    "focus-visible:ring-4 focus-visible:ring-cyan-200/60 focus-visible:outline-none disabled:cursor-wait disabled:opacity-80",
                  )}
                >
                  {pending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Memproses…
                    </>
                  ) : signup ? (
                    "Daftar"
                  ) : (
                    "Login"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {state.status !== "success" && !showNotice && (
        <p className="mt-8 text-center text-sm text-white/85 animate-in fade-in delay-1000 duration-700 fill-mode-both">
          {signup ? "Sudah punya akun? " : "Belum punya akun? "}
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode(signup ? "signin" : "signup")}
            className="font-semibold tracking-wide text-[#8be9f7] uppercase underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            {signup ? "Masuk" : "Buat akun"}
          </button>
        </p>
      )}
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
      <Icon aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-white/75" />
      <input
        {...input}
        required
        className={cn(
          "h-12 w-full rounded-xl border border-white/70 bg-white/[0.06] pr-11 pl-11 text-[15px] text-white",
          "placeholder:text-xs placeholder:tracking-[0.18em] placeholder:text-white/80 placeholder:uppercase",
          "transition-all duration-200 outline-none focus:border-[#8be9f7] focus:bg-white/[0.12] focus:ring-4 focus:ring-cyan-300/25",
          "disabled:opacity-70",
        )}
      />
      {trailing && <span className="absolute top-1/2 right-3 -translate-y-1/2">{trailing}</span>}
    </label>
  );
}

function SuccessView({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center py-4 text-center">
      <div className="ey-pop grid size-20 place-items-center rounded-full bg-emerald-400/20 ring-2 ring-emerald-300/60">
        <svg viewBox="0 0 52 52" className="size-11" aria-hidden>
          <path
            pathLength={100}
            d="M14 27 l8 8 l16 -18"
            fill="none"
            stroke="#a7f3d0"
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
      <p className="mt-1 text-sm text-white/75 animate-in fade-in delay-500 duration-500 fill-mode-both">
        Mengalihkan ke dashboard…
      </p>
      <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
        <div className="ey-fill h-full rounded-full bg-gradient-to-r from-[#8be9f7] to-white" />
      </div>
    </div>
  );
}

function NoticeView({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div role="status" className="flex flex-col items-center py-2 text-center">
      <div className="ey-pop grid size-16 place-items-center rounded-full bg-white/15 ring-2 ring-white/40">
        <MailCheck className="size-8 text-[#8be9f7]" />
      </div>
      <p className="mt-4 font-semibold">Cek email Anda</p>
      <p className="mt-1 text-sm leading-relaxed text-white/80">{message}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-full border border-white/50 px-5 py-2 text-sm font-medium transition-colors hover:bg-white/10"
      >
        Kembali ke login
      </button>
    </div>
  );
}
