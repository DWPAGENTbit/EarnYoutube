"use server";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export type AuthState =
  | { status: "idle" }
  | { status: "error"; message: string; at: number; email: string }
  | { status: "notice"; message: string; at: number }
  | { status: "success"; message: string; at: number };

/** Terjemahkan pesan umum Supabase Auth ke Bahasa Indonesia. */
function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi. Buka link konfirmasi di kotak masuk Anda.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Email ini sudah terdaftar. Silakan masuk.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "Kata sandi terlalu lemah. Gunakan minimal 8 karakter.";
  if (m.includes("rate limit") || m.includes("too many")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (m.includes("fetch failed") || m.includes("network")) return "Tidak bisa terhubung ke server autentikasi. Coba lagi.";
  if (m.includes("invalid api key"))
    return "Konfigurasi server salah: API key Supabase tidak cocok dengan URL proyeknya. Hubungi admin.";
  return msg;
}

/**
 * Masuk atau daftar. Tidak langsung redirect, supaya halaman login bisa
 * menampilkan animasi "berhasil" lebih dulu, lalu pindah ke dashboard.
 */
export async function authAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const mode = form.get("mode") === "signup" ? "signup" : "signin";
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const at = Date.now();
  if (!email || !password) return { status: "error", message: "Isi email dan kata sandi.", at, email };

  try {
    const supabase = await serverClient();
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { status: "error", message: translate(error.message), at, email };
      return { status: "success", message: "Berhasil masuk!", at };
    }
    if (password.length < 8) return { status: "error", message: "Kata sandi minimal 8 karakter.", at, email };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${env.appUrl()}/auth/callback` },
    });
    if (error) return { status: "error", message: translate(error.message), at, email };
    if (!data.session)
      return { status: "notice", message: `Link konfirmasi sudah dikirim ke ${email}. Buka email itu, lalu masuk.`, at };
    return { status: "success", message: "Akun berhasil dibuat!", at };
  } catch (e) {
    return { status: "error", message: translate(e instanceof Error ? e.message : String(e)), at, email };
  }
}

export async function signOut() {
  const supabase = await serverClient();
  await supabase.auth.signOut();
  redirect("/login");
}
