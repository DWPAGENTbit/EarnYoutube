import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminClient } from "../supabase/admin";
import { decrypt, encrypt } from "../crypto";
import { env } from "../env";

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function redirectUri() {
  return `${env.appUrl()}/api/youtube/callback`;
}

// state = base64url(payload).hmac — mencegah CSRF & menautkan callback ke kanal + user.
function sign(data: string) {
  return createHmac("sha256", env.tokenEncryptionKey()).update(data).digest("base64url");
}
export function makeState(payload: { channelId: string; userId: string }) {
  const body = Buffer.from(JSON.stringify({ ...payload, n: randomBytes(8).toString("hex"), t: Date.now() })).toString("base64url");
  return `${body}.${sign(body)}`;
}
export function readState(state: string): { channelId: string; userId: string } {
  const [body, mac] = state.split(".");
  if (!body || !mac) throw new Error("state tidak valid");
  const a = Buffer.from(sign(body));
  const b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("state tidak valid");
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  if (Date.now() - p.t > 15 * 60 * 1000) throw new Error("state kedaluwarsa, ulangi koneksi");
  return { channelId: p.channelId, userId: p.userId };
}

export function buildAuthUrl(state: string) {
  const u = new URL(AUTH_URL);
  u.searchParams.set("client_id", env.googleClientId());
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", YT_SCOPES.join(" "));
  u.searchParams.set("access_type", "offline"); // supaya dapat refresh_token
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", state);
  return u.toString();
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId(),
      client_secret: env.googleClientSecret(),
      ...params,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google OAuth: ${json.error_description ?? json.error ?? res.status}`);
  return json;
}

export async function exchangeCode(code: string) {
  return tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

export async function saveCredentials(channelId: string, tok: TokenResponse) {
  const db = adminClient();
  const { data: existing } = await db
    .from("yt_credentials")
    .select("refresh_token_enc")
    .eq("channel_id", channelId)
    .maybeSingle();
  const refreshEnc = tok.refresh_token ? encrypt(tok.refresh_token) : existing?.refresh_token_enc;
  if (!refreshEnc) {
    throw new Error("Google tidak mengirim refresh token. Cabut akses aplikasi di myaccount.google.com/permissions lalu hubungkan ulang.");
  }
  const { error } = await db.from("yt_credentials").upsert({
    channel_id: channelId,
    refresh_token_enc: refreshEnc,
    access_token_enc: encrypt(tok.access_token),
    scopes: tok.scope.split(" "),
    expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Access token yang masih berlaku (otomatis refresh). Hanya di server. */
export async function getAccessToken(channelId: string): Promise<string> {
  const db = adminClient();
  const { data } = await db.from("yt_credentials").select("*").eq("channel_id", channelId).maybeSingle();
  if (!data) throw new Error("Akun YouTube belum terhubung untuk kanal ini.");
  if (data.access_token_enc && data.expires_at && new Date(data.expires_at).getTime() > Date.now() + 60_000) {
    return decrypt(data.access_token_enc);
  }
  const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: decrypt(data.refresh_token_enc) });
  await saveCredentials(channelId, tok);
  return tok.access_token;
}

export async function revokeCredentials(channelId: string) {
  const db = adminClient();
  const { data } = await db.from("yt_credentials").select("refresh_token_enc").eq("channel_id", channelId).maybeSingle();
  if (data) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(data.refresh_token_enc))}`, {
      method: "POST",
    }).catch(() => undefined);
    await db.from("yt_credentials").delete().eq("channel_id", channelId);
  }
}
