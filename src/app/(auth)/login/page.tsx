import { LoginCard } from "./login-card";

export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* Cahaya dekoratif yang melayang pelan */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="ey-float absolute -top-24 -left-24 size-80 rounded-full bg-white/15 blur-3xl" />
        <div className="ey-float absolute -right-20 -bottom-32 size-[28rem] rounded-full bg-cyan-300/25 blur-3xl [animation-delay:-4s]" />
        <div className="ey-float absolute top-1/3 right-1/4 size-40 rounded-full bg-sky-200/10 blur-2xl [animation-delay:-2s]" />
      </div>
      <LoginCard initialError={error} initialNotice={notice} configured={configured} />
    </main>
  );
}
