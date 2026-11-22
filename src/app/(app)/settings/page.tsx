import { getActiveChannel } from "@/lib/supabase/server";
import { listSecretStatus } from "@/lib/secrets";
import { SECRET_NAMES } from "@/lib/env";
import { DEFAULT_TEMPLATES } from "@/lib/ai/templates";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ActionButton, ActionForm, SubmitButton } from "@/components/app/action-ui";
import { NeedChannel, PageHeader, fmtDate } from "@/components/app/ui-bits";
import { removeApiKey, saveApiKey, saveSettings, saveTemplate } from "../actions";
import { channelSettings } from "@/lib/types";
import { GoogleOAuthSetup } from "@/components/app/google-oauth";

export const metadata = { title: "Settings" };

const KEY_HELP: Record<string, string> = {
  ANTHROPIC_API_KEY: "Claude API — semua modul AI (M1–M7)",
  OPENAI_API_KEY: "OpenAI TTS (voice-over)",
  ELEVENLABS_API_KEY: "ElevenLabs TTS (opsional)",
  PEXELS_API_KEY: "Footage & foto stok Pexels",
  PIXABAY_API_KEY: "Footage & foto stok Pixabay (cadangan)",
};

export default async function SettingsPage() {
  const { supabase, user, channel } = await getActiveChannel();
  const secrets = await listSecretStatus(user.id);
  const { data: templates } = await supabase
    .from("prompt_templates")
    .select("id,module,version,name,template,user_id,created_at")
    .order("module")
    .order("version", { ascending: false });
  const s = channel ? channelSettings(channel) : null;

  return (
    <>
      <PageHeader title="Settings" description="API key disimpan terenkripsi (AES-256-GCM) di server dan tidak pernah dikirim kembali ke browser." />

      <Card>
        <CardHeader>
          <CardTitle>Koneksi Google (YouTube)</CardTitle>
          <CardDescription>Client ID & Secret OAuth dari Google Cloud. Dipakai untuk tombol Hubungkan YouTube di halaman Channel.</CardDescription>
        </CardHeader>
        <CardContent>
          <GoogleOAuthSetup userId={user.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>Jika kosong, server memakai variabel lingkungan dengan nama yang sama.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {SECRET_NAMES.map((name) => {
            const st = secrets.find((x) => x.name === name);
            return (
              <div key={name} className="flex flex-col gap-2 py-3 md:flex-row md:items-center">
                <div className="md:w-72">
                  <p className="font-mono text-sm">{name}</p>
                  <p className="text-xs text-muted-foreground">{KEY_HELP[name]}</p>
                </div>
                <div className="flex-1">
                  {st ? (
                    <Badge variant="secondary">tersimpan ••••{st.last4} · {fmtDate(st.updated_at)}</Badge>
                  ) : (
                    <Badge variant="outline">belum diisi</Badge>
                  )}
                </div>
                <ActionForm action={saveApiKey} resetOnSuccess className="flex gap-2 md:w-[420px]">
                  <input type="hidden" name="name" value={name} />
                  <Input name="value" type="password" autoComplete="off" placeholder={st ? "Ganti key…" : "Tempel key…"} required />
                  <SubmitButton variant="outline">Simpan</SubmitButton>
                </ActionForm>
                {st && (
                  <ActionButton variant="ghost" size="sm" confirm={`Hapus ${name}?`} run={removeApiKey.bind(null, name)}>
                    Hapus
                  </ActionButton>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {!channel || !s ? (
        <NeedChannel />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Produksi & publikasi — {channel.name}</CardTitle>
            <CardDescription>Berlaku untuk kanal aktif.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionForm action={saveSettings} className="grid gap-4 md:grid-cols-3">
              <input type="hidden" name="channel_id" value={channel.id} />
              <Sel label="Format default" name="default_format" value={s.default_format} options={[["long", "Long-form 16:9"], ["short", "Shorts 9:16"]]} />
              <Num label="Durasi target long-form (detik)" name="target_duration_sec" value={s.target_duration_sec} min={30} max={3600} />
              <Num label="Produksi otomatis per hari (0 = mati)" name="daily_auto_produce" value={s.daily_auto_produce} min={0} max={5} />
              <Sel label="Penyedia TTS" name="tts_provider" value={s.tts_provider} options={[["openai", "OpenAI TTS"], ["elevenlabs", "ElevenLabs"]]} />
              <Txt label="Suara (OpenAI: alloy, nova, onyx… / ElevenLabs: voice_id)" name="tts_voice" value={s.tts_voice} />
              <Sel label="Stok utama" name="stock_provider" value={s.stock_provider} options={[["pexels", "Pexels"], ["pixabay", "Pixabay"]]} />
              <Txt label="Gaya visual" name="visual_style" value={s.visual_style} className="md:col-span-2" />
              <Txt label="Kategori YouTube (ID)" name="category_id" value={s.category_id ?? "27"} />
              <Sel label="Privasi default" name="default_privacy" value={s.default_privacy} options={[["private", "Private"], ["unlisted", "Unlisted"], ["public", "Public"]]} />
              <Num label="Batas upload per hari" name="upload_daily_limit" value={s.upload_daily_limit} min={1} max={20} />
              <div className="space-y-3 md:col-span-3">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="auto_shorts" defaultChecked={s.auto_shorts !== false} className="mt-1" />
                  <span><b>Repurpose Shorts otomatis</b> dari setiap video long-form.</span>
                </label>
                <label className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                  <input type="checkbox" name="auto_publish" defaultChecked={s.auto_publish} className="mt-1" />
                  <span>
                    <b>Auto-publish</b> (default OFF). Video yang lolos SEMUA cek QC langsung disetujui & diunggah dengan privasi default
                    tanpa review manual. Tidak disarankan — review manusia menjaga kualitas & kepatuhan kebijakan YouTube.
                  </span>
                </label>
              </div>
              <div className="md:col-span-3">
                <SubmitButton>Simpan pengaturan</SubmitButton>
              </div>
            </ActionForm>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Prompt templates</CardTitle>
          <CardDescription>
            Menyimpan membuat versi baru yang langsung aktif. Variabel memakai {"{{nama}}"} atau {"{{nama|default}}"}. Output tetap divalidasi skema JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {([1, 2, 3, 4, 5, 6, 7] as const).map((m) => {
            const versions = (templates ?? []).filter((t) => t.module === m);
            const active = versions.find((t) => t.user_id === user.id) ?? versions.find((t) => t.user_id === null);
            return (
              <details key={m} className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  M{m} — {DEFAULT_TEMPLATES[m].name}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {active ? `versi ${active.version}${active.user_id ? " (milik Anda)" : " (global)"}` : "bawaan kode"}
                  </span>
                </summary>
                <ActionForm action={saveTemplate} className="mt-3 space-y-2">
                  <input type="hidden" name="module" value={m} />
                  <Textarea name="template" rows={12} defaultValue={active?.template ?? DEFAULT_TEMPLATES[m].template} className="font-mono text-xs" />
                  <SubmitButton size="sm">Simpan sebagai versi baru</SubmitButton>
                </ActionForm>
              </details>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}

function Txt({ label, name, value, className }: { label: string; name: string; value: string; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={value} />
    </div>
  );
}
function Num({ label, name, value, min, max }: { label: string; name: string; value: number; min: number; max: number }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={min} max={max} defaultValue={value} />
    </div>
  );
}
function Sel({ label, name, value, options }: { label: string; name: string; value: string; options: [string, string][] }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={value} className="h-8 w-full rounded-lg border bg-background px-2 text-sm">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
