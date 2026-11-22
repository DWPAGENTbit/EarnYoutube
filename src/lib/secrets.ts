import { adminClient } from "./supabase/admin";
import { decrypt, encrypt } from "./crypto";
import type { SecretName } from "./env";

/**
 * Ambil API key milik user (terenkripsi di tabel user_secrets). Jika user
 * belum mengisi, pakai variabel lingkungan server dengan nama yang sama.
 * Nilai ini hanya dipakai di server dan tidak pernah dikirim ke browser.
 */
export async function getSecret(userId: string, name: SecretName): Promise<string | null> {
  const { data } = await adminClient()
    .from("user_secrets")
    .select("value_enc")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();
  if (data?.value_enc) return decrypt(data.value_enc);
  return process.env[name] ?? null;
}

export async function requireSecret(userId: string, name: SecretName): Promise<string> {
  const v = await getSecret(userId, name);
  if (!v) throw new Error(`${name} belum diatur. Isi di Settings → API Keys.`);
  return v;
}

export async function setSecret(userId: string, name: SecretName, value: string) {
  const { error } = await adminClient()
    .from("user_secrets")
    .upsert({
      user_id: userId,
      name,
      value_enc: encrypt(value),
      last4: value.slice(-4),
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(error.message);
}

export async function deleteSecret(userId: string, name: SecretName) {
  await adminClient().from("user_secrets").delete().eq("user_id", userId).eq("name", name);
}

/** Status secret untuk UI: hanya "terisi/tidak" + 4 karakter terakhir. */
export async function listSecretStatus(userId: string) {
  const { data } = await adminClient()
    .from("user_secrets")
    .select("name,last4,updated_at")
    .eq("user_id", userId);
  return data ?? [];
}
