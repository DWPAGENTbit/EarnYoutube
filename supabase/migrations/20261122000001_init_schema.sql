-- =====================================================================
-- EarnYoutube — skema awal
-- Jalankan sekali di Supabase SQL Editor (atau `supabase db push`).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: updated_at otomatis
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- channels
-- ---------------------------------------------------------------------
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  niche text,
  audience text,
  competitors text,
  resources text,
  goals text,
  language text not null default 'id',
  positioning text,
  plan_json jsonb,          -- output Modul 1
  niche_json jsonb,         -- output Modul 2 (tanpa daftar ide)
  growth_json jsonb,        -- output Modul 4
  monetization_json jsonb,  -- output Modul 6
  production_json jsonb,    -- output Modul 5 (playbook produksi)
  settings jsonb not null default jsonb_build_object(
    'auto_publish', false,
    'daily_auto_produce', 0,
    'default_format', 'long',
    'target_duration_sec', 480,
    'default_privacy', 'private',
    'tts_provider', 'openai',
    'tts_voice', 'alloy',
    'visual_style', 'clean, modern, high-contrast',
    'stock_provider', 'pexels',
    'upload_daily_limit', 3
  ),
  yt_channel_id text,
  yt_channel_title text,
  yt_thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists channels_user_idx on public.channels(user_id);
create trigger channels_updated before update on public.channels
  for each row execute function public.set_updated_at();

-- Fungsi kepemilikan (dipakai di semua policy RLS)
create or replace function public.owns_channel(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.channels c where c.id = cid and c.user_id = auth.uid());
$$;
revoke all on function public.owns_channel(uuid) from public;
grant execute on function public.owns_channel(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- yt_credentials — HANYA service role. Token terenkripsi AES-256-GCM
-- di sisi server sebelum disimpan.
-- ---------------------------------------------------------------------
create table if not exists public.yt_credentials (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  refresh_token_enc text not null,
  access_token_enc text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
create trigger yt_credentials_updated before update on public.yt_credentials
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- user_secrets — API key milik user (Anthropic, TTS, Pexels, dst.),
-- terenkripsi, HANYA service role.
-- ---------------------------------------------------------------------
create table if not exists public.user_secrets (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  value_enc text not null,
  last4 text,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

-- ---------------------------------------------------------------------
-- prompt_templates — template global (user_id null) + versi milik user
-- ---------------------------------------------------------------------
create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  module smallint not null check (module between 1 and 7),
  version int not null default 1,
  name text not null,
  template text not null,
  output_schema jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists prompt_templates_module_idx on public.prompt_templates(module, is_active);

-- ---------------------------------------------------------------------
-- ideas
-- ---------------------------------------------------------------------
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  title text not null,
  angle text,
  score numeric not null default 0,
  reason text,
  category text,
  source text not null default 'm2' check (source in ('m2','m7','manual')),
  status text not null default 'backlog'
    check (status in ('backlog','picked','produced','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists ideas_channel_idx on public.ideas(channel_id, status, score desc);

-- ---------------------------------------------------------------------
-- scripts
-- ---------------------------------------------------------------------
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  idea_id uuid references public.ideas(id) on delete set null,
  json jsonb not null,
  model text,
  version int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists scripts_idea_idx on public.scripts(idea_id);

-- ---------------------------------------------------------------------
-- assets — setiap aset WAJIB punya license_source
-- ---------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  script_id uuid references public.scripts(id) on delete cascade,
  video_id uuid,
  scene_index int,
  type text not null check (type in ('voice','image','video','music','subtitle')),
  url text not null,               -- path di Storage
  license_source text,             -- mis. "Pexels License — https://pexels.com/photo/123"
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists assets_video_idx on public.assets(video_id, scene_index);

-- ---------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  idea_id uuid references public.ideas(id) on delete set null,
  script_id uuid references public.scripts(id) on delete set null,
  parent_video_id uuid references public.videos(id) on delete set null, -- Shorts hasil repurpose
  format text not null default 'long' check (format in ('long','short')),
  target_duration_sec int not null default 480,
  duration_sec numeric,
  render_url text,
  thumbnail_url text,
  srt_url text,
  voice_url text,
  metadata_json jsonb,
  qc_json jsonb,
  contains_synthetic_media boolean not null default true,
  review_notes text,
  status text not null default 'queued' check (status in (
    'queued','scripting','voicing','assets','rendering','qc','review',
    'approved','uploading','uploaded','scheduled','published','rejected','failed'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.assets
  add constraint assets_video_fk foreign key (video_id) references public.videos(id) on delete cascade;
create index if not exists videos_channel_idx on public.videos(channel_id, status);
create trigger videos_updated before update on public.videos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- jobs — antrean kerja worker (satu baris per eksekusi tahap)
-- ---------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  stage text not null check (stage in (
    'scripting','voicing','assets','rendering','qc','uploading',
    'analytics_sync','report_weekly','report_monthly','auto_pick','module'
  )),
  status text not null default 'queued' check (status in ('queued','running','done','failed','cancelled')),
  payload jsonb not null default '{}',
  attempts int not null default 0,
  max_attempts int not null default 3,
  error text,
  logs jsonb not null default '[]',
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_queue_idx on public.jobs(status, run_after);
create index if not exists jobs_video_idx on public.jobs(video_id, created_at desc);
create trigger jobs_updated before update on public.jobs
  for each row execute function public.set_updated_at();

-- Worker mengambil 1 job secara atomik (FOR UPDATE SKIP LOCKED).
-- Job yang macet > 30 menit dalam status running dianggap mati & diambil ulang.
create or replace function public.claim_next_job(worker_id text, stages text[] default null)
returns setof public.jobs language plpgsql security definer set search_path = public as $$
declare j public.jobs;
begin
  select * into j from public.jobs
   where ((status = 'queued' and run_after <= now())
          or (status = 'running' and locked_at < now() - interval '30 minutes'))
     and (stages is null or stage = any(stages))
   order by run_after asc
   limit 1
   for update skip locked;
  if not found then return; end if;
  update public.jobs
     set status = 'running', locked_at = now(), locked_by = worker_id, attempts = attempts + 1
   where id = j.id
   returning * into j;
  return next j;
end $$;
revoke all on function public.claim_next_job(text, text[]) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- uploads
-- ---------------------------------------------------------------------
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  yt_video_id text,
  privacy text not null default 'private' check (privacy in ('private','unlisted','public')),
  publish_at timestamptz,
  status text not null default 'queued' check (status in ('queued','uploading','uploaded','scheduled','published','failed')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists uploads_channel_idx on public.uploads(channel_id, created_at desc);
create trigger uploads_updated before update on public.uploads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- analytics_daily
-- ---------------------------------------------------------------------
create table if not exists public.analytics_daily (
  channel_id uuid not null references public.channels(id) on delete cascade,
  yt_video_id text not null,   -- '__channel__' untuk agregat kanal
  date date not null,
  impressions bigint,
  ctr numeric,
  views bigint,
  watch_time_minutes numeric,
  avg_view_duration numeric,
  avg_view_percentage numeric,
  retention_json jsonb,
  traffic_sources jsonb,
  subs_gained int,
  subs_lost int,
  revenue numeric,
  primary key (channel_id, yt_video_id, date)
);

-- ---------------------------------------------------------------------
-- reports — output Modul 7
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  period text not null check (period in ('weekly','monthly')),
  period_start date,
  period_end date,
  json jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists reports_channel_idx on public.reports(channel_id, created_at desc);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.channels         enable row level security;
alter table public.yt_credentials   enable row level security;
alter table public.user_secrets     enable row level security;
alter table public.prompt_templates enable row level security;
alter table public.ideas            enable row level security;
alter table public.scripts          enable row level security;
alter table public.assets           enable row level security;
alter table public.videos           enable row level security;
alter table public.jobs             enable row level security;
alter table public.uploads          enable row level security;
alter table public.analytics_daily  enable row level security;
alter table public.reports          enable row level security;

-- yt_credentials & user_secrets: tanpa policy = tertutup untuk anon/authenticated.
revoke all on public.yt_credentials from anon, authenticated;
revoke all on public.user_secrets   from anon, authenticated;

create policy channels_owner on public.channels
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy prompt_templates_read on public.prompt_templates
  for select to authenticated using (user_id is null or user_id = auth.uid());
create policy prompt_templates_write on public.prompt_templates
  for insert to authenticated with check (user_id = auth.uid());
create policy prompt_templates_update on public.prompt_templates
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['ideas','scripts','assets','videos','jobs','uploads','analytics_daily','reports'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.owns_channel(channel_id)) with check (public.owns_channel(channel_id))',
      t || '_owner', t);
  end loop;
end $$;

-- =====================================================================
-- Storage: bucket privat
-- Path file: <channel_id>/<video_id>/<nama-file>
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('renders','renders',false), ('thumbnails','thumbnails',false),
       ('voices','voices',false), ('assets','assets',false)
on conflict (id) do nothing;

create policy storage_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id in ('renders','thumbnails','voices','assets')
    and public.owns_channel(((storage.foldername(name))[1])::uuid)
  );
