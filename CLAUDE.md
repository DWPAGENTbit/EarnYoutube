# EarnYoutube

Repo: https://github.com/DWPAGENTbit/EarnYoutube (branch `main`)

## Logo (wajib)

- Logo resmi satu-satunya: `assets/logo.png` (PNG 512×512, latar transparan): bentuk pita "play" biru–cyan dengan titik bulat di kanan atas.
- Selalu pakai file ini untuk logo aplikasi, favicon, ikon PWA/app, header, splash, dan materi promosi. Jangan membuat, menggambar ulang, atau mengganti logo dengan ikon lain.
- Kalau butuh ukuran lain (favicon 32/16, apple-touch 180, PWA 192/512), turunkan dari `assets/logo.png`.
- Warna merek diambil dari logo: biru (~#1E6FE0) sampai cyan (~#22C4E0).

## Proyek

YouTube Auto Creator Platform: AI menyusun rencana, naskah, voice, render, metadata; **manusia menyetujui** di Review Queue sebelum unggah. Panduan setup ada di README.md. Ikuti juga AGENTS.md (Next.js 16 berbeda dari versi lama: `proxy.ts` menggantikan middleware, `params` async, `PageProps<"/route">` dari `npx next typegen`).

### Peta kode

- `src/app/(app)/*`: 9 halaman (dashboard, channel, ideas, studio, review, scheduler, analytics, monetization, settings); semua mutasi di `src/app/(app)/actions.ts`.
- `src/lib/ai/`: `schemas.ts` (Zod M1–M7 + `postValidate`), `templates.ts` (prompt bawaan), `run.ts` (`runModule`: Claude + validasi + maks. 2 retry).
- `src/lib/pipeline/`: `stages.ts` (handler tiap tahap job), `queue.ts` (enqueue/approve/retry), `render.ts`, `ffmpeg.ts`, `tts.ts`, `stock.ts`, `graphics.ts`, `qc.ts`, `metadata.ts`.
- `src/lib/youtube/`: OAuth, upload resumable, Analytics.
- `worker/index.ts`: loop `claim_next_job` → `STAGE_HANDLERS`. Kerja berat (AI panjang, render, upload) **selalu** lewat job, bukan di request HTTP.
- `supabase/migrations/`: skema + RLS + cron; `supabase/seed.sql` dihasilkan `npm run seed:gen`.

### Aturan

- Jangan pernah mengunggah tanpa persetujuan: upload hanya dari status `approved`/`uploading`; `auto_publish` default `false`.
- Secret (token OAuth, API key) hanya di server/worker, terenkripsi `src/lib/crypto.ts`. `src/lib/supabase/admin.ts` (service role) tidak boleh diimpor Client Component.
- Aset wajib punya `license_source`; video dengan narasi AI wajib `containsSyntheticMedia = true`.
- Supabase proyek `jeyxnvtqhxlxfyutpwmx` (terhubung ke Vercel `dwp_earnyoutube` lewat integrasi) ada di akun lain (MCP tidak punya akses): perubahan skema = file migrasi baru yang dijalankan user di SQL Editor.
- Proyek Supabase baru tidak memberi izin tabel otomatis: tabel baru wajib diberi `grant` eksplisit (lihat migrasi `..._grants.sql`).
- Tampilan: tema tunggal "Warm Glass" (latar ruangan hangat yang buram + panel kaca putih, aksen teal, tombol pil hitam/putih), token & utilitas `glass`/`glass-strong`/`hatch` di `src/app/globals.css`; tema terang dipaksa (forcedTheme="light"). Kerangka: top bar kaca, rail ikon kiri, tab bar pil bawah (`src/components/app/shell.tsx`). Jangan menambah latar hitam/putih polos.
- Kredensial Google OAuth diisi pengguna lewat web (Channel / Settings), disimpan terenkripsi di `user_secrets`; env GOOGLE_CLIENT_ID/SECRET hanya cadangan.
- Sebelum commit: `npm run typecheck`, `npm run lint`, `npx next build`.
