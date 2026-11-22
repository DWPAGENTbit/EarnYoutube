-- Izin akses tabel untuk role API Supabase.
--
-- Proyek Supabase baru tidak lagi otomatis memberi hak akses tabel di skema
-- public ke role API (anon, authenticated, service_role). Tanpa file ini,
-- server mendapat error "permission denied for table ...".
--
-- Aman dijalankan ulang. Keamanan data per user tetap dijaga oleh RLS
-- (migrasi 1): user login hanya bisa melihat/mengubah data kanalnya sendiri.

grant usage on schema public to anon, authenticated, service_role;

-- Server & worker (service_role): akses penuh.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- User yang sudah login: CRUD, dibatasi RLS.
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.owns_channel(uuid) to authenticated;

-- Tabel rahasia & fungsi antrean: hanya server/worker.
revoke all on public.yt_credentials from anon, authenticated;
revoke all on public.user_secrets from anon, authenticated;
revoke all on function public.claim_next_job(text, text[]) from public, anon, authenticated;
revoke all on function public.enqueue_scheduled_jobs(text) from public, anon, authenticated;

-- Tamu (anon) tidak butuh akses tabel apa pun: login lewat Supabase Auth.
revoke all on all tables in schema public from anon;

-- Tabel yang dibuat migrasi berikutnya otomatis bisa diakses server.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
