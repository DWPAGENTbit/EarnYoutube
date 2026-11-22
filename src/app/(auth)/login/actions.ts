"use server";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

const back = (key: "error" | "notice", msg: string) => redirect(`/login?${key}=${encodeURIComponent(msg)}`);

export async function signIn(form: FormData) {
  const supabase = await serverClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error) back("error", error.message);
  redirect("/dashboard");
}

export async function signUp(form: FormData) {
  const supabase = await serverClient();
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email")),
    password: String(form.get("password")),
    options: { emailRedirectTo: `${env.appUrl()}/auth/callback` },
  });
  if (error) back("error", error.message);
  if (!data.session) back("notice", "Cek email Anda untuk konfirmasi akun, lalu masuk.");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await serverClient();
  await supabase.auth.signOut();
  redirect("/login");
}
