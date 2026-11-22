import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "./actions";

export const metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const notice = typeof sp.notice === "string" ? sp.notice : null;
  const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-gradient-to-br from-[#0B3D91] via-[#1E6FE0] to-[#22C4E0] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="" width={40} height={40} className="rounded-lg bg-white/95 p-1" />
          <span className="text-lg font-semibold">EarnYoutube</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-balance">
            Otomatisasi produksinya, bukan kualitasnya.
          </h1>
          <p className="text-white/80">
            Riset niche, skrip, voice-over, render, thumbnail, dan upload ke YouTube dalam satu alur. Setiap video tetap
            lewat review Anda sebelum tayang.
          </p>
        </div>
        <p className="text-sm text-white/60">Human-in-the-loop · Patuh kebijakan YouTube · Aset berlisensi</p>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="" width={36} height={36} />
            <span className="text-lg font-semibold">EarnYoutube</span>
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Masuk</h2>
            <p className="text-sm text-muted-foreground">Masuk atau buat akun dengan email.</p>
          </div>

          {!configured && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Supabase belum dikonfigurasi. Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
              <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di <code>.env.local</code>, lalu jalankan ulang server.
            </p>
          )}
          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {notice && <p className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">{notice}</p>}

          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata sandi</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required />
            </div>
            <div className="flex flex-col gap-2">
              <Button formAction={signIn} className="w-full">
                Masuk
              </Button>
              <Button formAction={signUp} variant="outline" className="w-full">
                Buat akun baru
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
