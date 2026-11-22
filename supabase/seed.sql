-- Template prompt global (versi 1) untuk 7 modul AI.
-- Hanya menambah template yang belum ada, jadi aman dijalankan ulang.
insert into public.prompt_templates (user_id, module, version, name, template, is_active)
select v.* from (values
(null::uuid, 1, 1, $tpl$Rencana Kanal (Channel Plan)$tpl$, $tpl$Bertindaklah sebagai ahli strategi YouTube dan konsultan monetisasi.
Buat rencana lengkap untuk meluncurkan kanal YouTube dari nol dan mulai meraih penghasilan dari monetisasi.

Evaluasi niche saya ({{niche}}), target audiens ({{audience}}), pesaing ({{competitors}}), sumber daya yang tersedia ({{resources}}), dan tujuan jangka panjang ({{goals}}).

Buat strategi detail yang mencakup penempatan kanal, pilar konten, format video, jadwal publikasi, pertumbuhan audiens, retensi penonton, peluang monetisasi, dan rencana aksi mingguan (minimal 8 minggu).

Bahasa output: {{language|id}}.$tpl$, true),
(null::uuid, 2, 1, $tpl$Pilih Niche & Ide$tpl$, $tpl$Bertindak sebagai peneliti pasar YouTube berpengalaman dan strategis dalam menentukan niche yang memiliki permintaan audiens tinggi dan potensi pertumbuhan jangka panjang.

Konteks kanal:
- Niche awal: {{niche}}
- Target audiens: {{audience}}
- Pesaing: {{competitors}}
- Rencana kanal (ringkas): {{plan_summary|belum ada}}
- Judul yang SUDAH ada di backlog (jangan diulang atau dibuat mirip): {{existing_titles|tidak ada}}

Evaluasi persaingan, cari peluang, potensi monetisasi, keberlanjutan konten, dan cara untuk menonjol.

Bangun identitas channel yang unik, tentukan penonton ideal saya, sarankan kategori konten, dan hasilkan {{count|100}} ide video yang diberi peringkat berdasarkan potensi menarik audiens. Skor 0–100. Setiap ide harus punya sudut pandang (angle) yang berbeda — jangan sekadar variasi kata dari ide lain.

Bahasa output: {{language|id}}.$tpl$, true),
(null::uuid, 3, 1, $tpl$Skrip Viral, Hook & Thumbnail$tpl$, $tpl$Bertindaklah sebagai ahli strategi konten YouTube dan produser video.
Kembangkan kerangka lengkap pembuatan konten yang dirancang untuk meningkatkan rasio klik-tayang dan retensi penonton.

Untuk ide: {{idea_title}}
Sudut pandang: {{idea_angle|-}}
Durasi target: {{duration}} detik, format: {{format}} (long = 16:9, short = 9:16 maks 60 detik)
Positioning kanal: {{positioning|-}}
Gaya visual: {{visual_style|clean, modern}}

Hasilkan cara menarik perhatian, konsep thumbnail, urutan pembukaan, alur cerita, strategi menahan penonton, cara mengajak bertindak, dan skrip video yang lengkap.

Ketentuan teknis:
- titles: tepat 3 judul, masing-masing ≤ 100 karakter, jujur terhadap isi.
- hooks: tepat 3 hook; hook terbaik dipakai sebagai narasi scene pertama dan harus selesai ≤ 5 detik.
- thumbnail_concepts: tepat 3 konsep; "text" maksimal 4 kata.
- scenes: urut, total duration_sec ≈ durasi target. narration = teks yang dibacakan voice-over (kalimat lengkap, tanpa arahan panggung). stock_query = 2–4 kata bahasa Inggris untuk mencari footage stok. chapter_title diisi pada scene yang membuka bab baru (kosongkan jika tidak).
- description: deskripsi YouTube 2–3 paragraf (chapters ditambahkan otomatis oleh sistem).
- tags: 8–15 tag relevan.
- shorts_cut: pilih scene terbaik untuk dipotong menjadi Shorts ≤ 60 detik.

Jelaskan (di "rationale") mengapa setiap konsep tersebut dapat menarik perhatian penonton serta mendorong mereka menonton hingga akhir.

Bahasa output: {{language|id}}.$tpl$, true),
(null::uuid, 4, 1, $tpl$Pertumbuhan & Algoritma$tpl$, $tpl$Bertindaklah sebagai ahli strategi YouTube dengan pengalaman menemukan perilaku audiens.

Jelaskan bagaimana pertumbuhan YouTube bekerja, termasuk tayangan, rasio klik-tayang, waktu tonton, retensi audiens, video yang disarankan, lalu lintas pencarian, dan sistem rekomendasi.

Buat strategi pertumbuhan yang praktis untuk channel {{channel_name}} (niche: {{niche}}) mengenai frekuensi mengunggah, pengujian konten, optimasi performa, keterlibatan audiens, dan metode untuk mengubah penonton menjadi subscriber.

Data performa terbaru: {{analytics_summary|belum ada data}}.
Sumber daya produksi: {{resources|-}}.

Bahasa output: {{language|id}}.$tpl$, true),
(null::uuid, 5, 1, $tpl$Produksi 3x Lebih Cepat$tpl$, $tpl$Bertindak sebagai manajer produksi YouTube profesional. Rancang alur kerja berbantuan AI yang membantu saya membuat video YouTube berkualitas tinggi lebih efisien untuk kanal {{channel_name}} (niche: {{niche}}).

Kembangkan proses yang terstruktur untuk riset topik, penulisan naskah, pengisi suara, pengeditan, desain thumbnail, publikasi, analisis performa, dan repurposing konten untuk YouTube Shorts, TikTok, Instagram Reels, dan platform lainnya.

Rekomendasikan alat AI yang berguna, alur kerja yang dapat diulang, template produksi, dan daftar periksa kontrol kualitas untuk mengurangi pekerjaan yang tidak perlu sambil menjaga kualitas konten.

Bahasa output: {{language|id}}.$tpl$, true),
(null::uuid, 6, 1, $tpl$Rencana Monetisasi$tpl$, $tpl$Bertindaklah sebagai pakar strategi bisnis yang mengkhususkan diri dalam monetisasi YouTube.

Susun strategi pendapatan yang komprehensif untuk channel YouTube saya ({{channel_name}}, niche: {{niche}}). Sertakan persiapan untuk Program Partner YouTube, strategi periklanan, pendapatan dari merek, produk digital, kursus online berbayar, keanggotaan berbayar, komunitas, dan peluang pendapatan tambahan.

Jelaskan persyaratan, kelebihan, keterbatasan, serta waktu ideal untuk memperkenalkan setiap metode monetisasi sebagai pengembangan channel saya.

Data channel saat ini: {{channel_stats}}.
Pada ypp_readiness isi angka SAAT INI (subs, watch_hours 12 bulan terakhir, shorts_views 90 hari) dan jelaskan selisihnya terhadap syarat YPP yang berlaku.

Bahasa output: {{language|id}}.$tpl$, true),
(null::uuid, 7, 1, $tpl$Baca Analitik Seperti Pro$tpl$, $tpl$Bertindaklah sebagai analis data YouTube berpengalaman. Buatlah sistem yang komprehensif untuk memantau, mengevaluasi, dan meningkatkan performa kanal saya ({{channel_name}}).

Analisis metrik penting, termasuk impressions, click-through rate (CTR), rata-rata durasi tonton, retensi audiens, konversi subscriber, sumber trafik, dan pendapatan.
Periode: {{period}}.
Data: {{analytics_json}}

Kembangkan ringkasan performa untuk mengidentifikasi pola konten yang berhasil, memahami alasan mengapa video tertentu kurang performa, dan rekomendasikan peningkatan spesifik.

Bantu saya menggunakan wawasan ini untuk membuat keputusan konten yang lebih baik. Isi next_ideas dengan 5–10 ide video baru yang memanfaatkan pola pemenang (ide ini otomatis masuk backlog).

Bahasa output: {{language|id}}.$tpl$, true)
) as v(user_id, module, version, name, template, is_active)
where not exists (
  select 1 from public.prompt_templates p
  where p.user_id is null and p.module = v.module and p.version = v.version
);
