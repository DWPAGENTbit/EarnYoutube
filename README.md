<p align="center"><img src="assets/logo.png" width="96" alt="EarnYoutube"></p>

# EarnYoutube: YouTube Auto Creator Platform

Platform untuk merencanakan, memproduksi, dan mengunggah video YouTube dengan bantuan AI, **dengan manusia tetap memegang keputusan akhir**. Setiap video melewati QC otomatis lalu masuk **Review Queue**. Tidak ada yang terunggah sebelum Anda menyetujuinya, kecuali Anda sendiri menyalakan *auto-publish* di Settings (default: mati).

## Fitur

| Halaman | Isi |
|---|---|
| **Dashboard** | KPI kanal, progres syarat YPP, job yang berjalan, video terbaru |
| **Channel** | Profil kanal, hubungkan akun YouTube (OAuth), M1 Rencana Kanal, M2 Riset Niche & Ide, M5 Sistem Produksi |
| **Ideas** | Backlog ide (dari M2/M7/manual). Pilih ide → produksi video panjang atau Shorts |
| **Studio** | Edit naskah per scene, dengar ulang voice, ganti aset visual, render ulang, metadata & thumbnail |
| **Review** | QC checklist, pratinjau, pilih privasi & jadwal, Setujui / Tolak |
| **Scheduler** | Kalender unggahan, antrean upload, M4 Strategi Pertumbuhan |
| **Analytics** | Views, CTR, retensi, sumber traffic, laporan M7 mingguan/bulanan |
| **Monetization** | Progres YPP (1.000 subs + 4.000 jam / 10 jt views Shorts), M6 sumber pendapatan |
| **Settings** | API key (terenkripsi), pengaturan produksi, versi prompt template |

**Pipeline:** `queued → scripting → voicing → assets → rendering → qc → review → approved → uploading → scheduled → published` (atau `failed`).

- **AI (7 modul):** prompt template berversi, output JSON divalidasi Zod, maks. 2 kali coba ulang.
- **Voice:** OpenAI TTS atau ElevenLabs.
- **Footage:** Pexels → Pixabay (berlisensi, `license_source` dicatat) → latar gradien.
- **Render:** FFmpeg 1080p/9:16 dengan subtitle & teks layar, loudness −14 LUFS.
- **Shorts:** dipotong otomatis dari video panjang (`shorts_cut`).
- **Upload:** resumable, `containsSyntheticMedia` diset, jadwal `publishAt`, thumbnail.
- **Kuota:** batas unggah harian per kanal; job ditunda otomatis saat kuota API habis.

## Arsitektur

- **Next.js 16** (App Router, Server Actions, `proxy.ts`) + Tailwind v4 + shadcn/ui: UI & API ringan.
- **Supabase**:
  - Postgres dengan RLS per pemilik kanal;
  - Auth email;
  - Storage privat (`renders`, `thumbnails`, `voices`, `assets`);
  - `pg_cron` untuk job terjadwal.
- **Worker** (`worker/index.ts`, Node + tsx): mengambil job dari tabel `jobs` lewat `claim_next_job()` (`FOR UPDATE SKIP LOCKED`), menjalankan AI/TTS/FFmpeg/upload. Jalankan di mesin yang punya CPU cukup (render video), bisa lebih dari satu instance.
- **Keamanan**:
  - Token OAuth YouTube & API key disimpan terenkripsi AES-256-GCM.
  - Hanya server/worker (service role) yang bisa membacanya.
  - Browser tidak pernah menerima secret.

## Setup

### 1. Supabase

Proyek: `https://wnyvkeodfuouoxnfsyao.supabase.co`. Di **SQL Editor**, jalankan berurutan:

1. `supabase/migrations/20261122000001_init_schema.sql`: tabel, RLS, storage bucket, fungsi antrean
2. `supabase/migrations/20261122000002_cron.sql`: jadwal sinkron analitik, laporan, dan auto-pick ide. Ekstensi **pg_cron** ikut diaktifkan; kalau gagal, aktifkan manual di Database → Extensions lalu jalankan ulang.
3. `supabase/seed.sql`: 7 prompt template bawaan (aman dijalankan ulang)

Atau dengan Supabase CLI: `supabase link --project-ref wnyvkeodfuouoxnfsyao`, lalu `supabase db push`.

Di **Authentication → URL Configuration**, isi:

- **Site URL**: `APP_URL` Anda.
- **Redirect URLs**: tambahkan `${APP_URL}/auth/callback`.

### 2. Google Cloud (YouTube)

1. Buat proyek. Aktifkan **YouTube Data API v3** dan **YouTube Analytics API**.
2. Siapkan OAuth consent screen. Scopes: `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`.
3. Buat OAuth client **Web application** dengan redirect URI `${APP_URL}/api/youtube/callback`.
4. Selama aplikasi belum lolos *audit* API YouTube, video yang diunggah lewat API dari proyek yang belum diverifikasi **dikunci private**. Ajukan audit (YouTube API Services Audit) sebelum dipakai produksi. Kuota default 10.000 unit/hari.

### 3. Lingkungan & jalankan

```powershell
copy .env.example .env.local   # lalu isi nilainya
npm install
npm run dev                    # UI di http://localhost:3000
npm run worker                 # di terminal lain: memproses antrean
```

API key AI/stock/TTS bisa diisi di `.env.local` (berlaku untuk semua user) atau per user di halaman **Settings** (disimpan terenkripsi, diutamakan).

### Skrip

| Perintah | Fungsi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | Worker antrean (loop). `WORKER_STAGES=rendering,qc` untuk membatasi tahap |
| `npm run worker:once` | Proses satu job lalu berhenti |
| `npm run typecheck` / `lint` | Pemeriksaan kode |
| `npm run seed:gen` | Tulis ulang `supabase/seed.sql` dari `src/lib/ai/templates.ts` |

## Kepatuhan kebijakan YouTube

- Konten harus orisinal dan bernilai. Platform ini **bukan** untuk produksi massal konten berulang (*inauthentic / mass-produced content* tidak bisa dimonetisasi). QC menolak judul/naskah yang terlalu mirip video sebelumnya.
- Narasi suara AI → `containsSyntheticMedia = true` dan baris pengungkapan di deskripsi.
- Hanya aset berlisensi (Pexels/Pixabay License) dengan kredit otomatis di deskripsi.
- Metrik pendapatan (estimated revenue) butuh scope `yt-analytics-monetary.readonly`. Belum diminta, jadi kolom pendapatan kosong.
