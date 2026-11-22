-- =====================================================================
-- Penjadwalan otomatis dengan pg_cron.
-- pg_cron hanya MEMASUKKAN job ke tabel `jobs`; pekerjaan beratnya
-- (LLM, render, upload, analytics) dijalankan oleh worker Node.
-- Aktifkan extension pg_cron (Dashboard → Database → Extensions) bila
-- perintah di bawah gagal.
-- =====================================================================

create extension if not exists pg_cron;

create or replace function public.enqueue_scheduled_jobs(kind text)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if kind = 'analytics_sync' then
    insert into public.jobs (channel_id, stage)
    select c.id, 'analytics_sync' from public.channels c
     where exists (select 1 from public.yt_credentials y where y.channel_id = c.id);
    get diagnostics n = row_count;

  elsif kind in ('report_weekly','report_monthly') then
    insert into public.jobs (channel_id, stage, run_after)
    select c.id, kind, now() + interval '30 minutes' -- setelah analytics_sync
      from public.channels c
     where exists (select 1 from public.yt_credentials y where y.channel_id = c.id);
    get diagnostics n = row_count;

  elsif kind = 'auto_pick' then
    insert into public.jobs (channel_id, stage, payload)
    select c.id, 'auto_pick',
           jsonb_build_object('count', (c.settings->>'daily_auto_produce')::int)
      from public.channels c
     where coalesce((c.settings->>'daily_auto_produce')::int, 0) > 0;
    get diagnostics n = row_count;
  end if;
  return n;
end $$;
revoke all on function public.enqueue_scheduled_jobs(text) from public, anon, authenticated;

-- Waktu dalam UTC. 19:00 UTC = 02:00 WIB.
select cron.schedule('earnyt-analytics-daily', '0 19 * * *',
  $$select public.enqueue_scheduled_jobs('analytics_sync')$$);
select cron.schedule('earnyt-report-weekly', '0 20 * * 0',
  $$select public.enqueue_scheduled_jobs('report_weekly')$$);
select cron.schedule('earnyt-report-monthly', '0 20 1 * *',
  $$select public.enqueue_scheduled_jobs('report_monthly')$$);
select cron.schedule('earnyt-auto-pick', '0 22 * * *',
  $$select public.enqueue_scheduled_jobs('auto_pick')$$);
