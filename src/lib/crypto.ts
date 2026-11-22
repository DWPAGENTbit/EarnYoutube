import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

// AES-256-GCM. Format tersimpan: v1.<iv b64>.<tag b64>.<ciphertext b64>
// TOKEN_ENCRYPTION_KEY = 32 byte acak dalam base64 (openssl rand -base64 32).

function key(): Buffer {
  const k = Buffer.from(env.tokenEncryptionKey(), "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY harus 32 byte (base64).");
  return k;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Format data terenkripsi tidak dikenal.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}
