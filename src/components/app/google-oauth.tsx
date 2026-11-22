import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { listSecretStatus } from "@/lib/secrets";
import { requestOrigin } from "@/lib/origin";
import { redirectUri } from "@/lib/youtube/oauth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ActionButton, ActionForm, SubmitButton } from "@/components/app/action-ui";
import { CopyField } from "@/components/app/copy-field";
import { removeGoogleOAuth, saveGoogleOAuth } from "@/app/(app)/actions";

export async function googleOAuthStatus(userId: string) {
  const all = await listSecretStatus(userId);
  const id = all.find((s) => s.name === "GOOGLE_CLIENT_ID");
  const secret = all.find((s) => s.name === "GOOGLE_CLIENT_SECRET");
  const envFallback = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  return { id, secret, ready: (!!id && !!secret) || envFallback, envFallback };
}

const LINK = "inline-flex items-center gap-0.5 font-medium underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground";

/**
 * Isi Client ID & Secret OAuth Google langsung dari web. Disimpan terenkripsi
 * (AES-256-GCM) di server; secret tidak pernah dikirim balik ke browser.
 */
export async function GoogleOAuthSetup({ userId, showGuide = true }: { userId: string; showGuide?: boolean }) {
  const st = await googleOAuthStatus(userId);
  const redirect = redirectUri(await requestOrigin());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={st.id ? "secondary" : "outline"}>
          <KeyRound /> Client ID {st.id ? `••••${st.id.last4}` : "belum diisi"}
        </Badge>
        <Badge variant={st.secret ? "secondary" : "outline"}>
          <ShieldCheck /> Client Secret {st.secret ? `••••${st.secret.last4}` : "belum diisi"}
        </Badge>
        {!st.id && st.envFallback && <Badge variant="outline">memakai cadangan server</Badge>}
      </div>

      {showGuide && (
        <ol className="space-y-3 text-sm">
          {[
            <>
              Buka{" "}
              <a className={LINK} href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noreferrer">
                Google Cloud <ExternalLink className="size-3" />
              </a>{" "}
              dan buat proyek. Aktifkan{" "}
              <a className={LINK} href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noreferrer">
                YouTube Data API v3 <ExternalLink className="size-3" />
              </a>{" "}
              dan{" "}
              <a className={LINK} href="https://console.cloud.google.com/apis/library/youtubeanalytics.googleapis.com" target="_blank" rel="noreferrer">
                YouTube Analytics API <ExternalLink className="size-3" />
              </a>
              .
            </>,
            <>
              Di{" "}
              <a className={LINK} href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noreferrer">
                Audience <ExternalLink className="size-3" />
              </a>
              , pilih <b>External</b> lalu tambahkan email akun YouTube Anda di <b>Test users</b>.
            </>,
            <>
              Di{" "}
              <a className={LINK} href="https://console.cloud.google.com/auth/clients" target="_blank" rel="noreferrer">
                Clients <ExternalLink className="size-3" />
              </a>{" "}
              → <b>Create client</b> → <b>Web application</b>. Tempel ini di <b>Authorized redirect URIs</b>:
              <div className="mt-2">
                <CopyField value={redirect} label="Salin Redirect URI" />
              </div>
            </>,
            <>Salin <b>Client ID</b> dan <b>Client Secret</b> yang muncul ke form di bawah, lalu Simpan.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-[11px] font-semibold text-background">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 leading-relaxed text-foreground/85">{step}</div>
            </li>
          ))}
        </ol>
      )}

      <ActionForm action={saveGoogleOAuth} resetOnSuccess className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="client_id">Client ID</Label>
          <Input
            id="client_id"
            name="client_id"
            autoComplete="off"
            spellCheck={false}
            placeholder={st.id ? `Tersimpan ••••${st.id.last4} (isi untuk mengganti)` : "xxxx.apps.googleusercontent.com"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client_secret">Client Secret</Label>
          <Input
            id="client_secret"
            name="client_secret"
            type="password"
            autoComplete="off"
            placeholder={st.secret ? `Tersimpan ••••${st.secret.last4} (isi untuk mengganti)` : "GOCSPX-…"}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <SubmitButton>Simpan kredensial</SubmitButton>
          {(st.id || st.secret) && (
            <ActionButton variant="ghost" confirm="Hapus Client ID & Secret Google?" run={removeGoogleOAuth}>
              Hapus
            </ActionButton>
          )}
          <span className="text-xs text-muted-foreground">Disimpan terenkripsi di server, tidak pernah dikirim balik ke browser.</span>
        </div>
      </ActionForm>
    </div>
  );
}
