-- Velista Listing AI: Supabase schema.
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- The server uses the service role key, which bypasses row level security.
-- RLS is enabled with no public policies, so the anon key cannot read or write these tables.

create table if not exists public.users (
  id            uuid primary key,
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.listings (
  id          uuid primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  status      text not null check (status in ('generating', 'draft', 'published', 'ended', 'failed')),
  title       text not null default '',
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists listings_user_updated_idx on public.listings (user_id, updated_at desc);

create table if not exists public.etsy_connections (
  user_id        uuid primary key references public.users (id) on delete cascade,
  access_token   text not null,
  refresh_token  text not null,
  expires_at     bigint not null,
  etsy_user_id   bigint,
  shop_id        bigint,
  shop_name      text,
  updated_at     timestamptz not null default now()
);

create table if not exists public.ebay_connections (
  user_id             uuid primary key references public.users (id) on delete cascade,
  access_token        text not null,
  refresh_token       text not null,
  expires_at          bigint not null,
  refresh_expires_at  bigint,
  ebay_user_id        text,
  username            text,
  prefs               jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now()
);

create table if not exists public.oauth_states (
  state       text primary key,
  user_id     uuid not null references public.users (id) on delete cascade,
  verifier    text not null,
  created_at  timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.etsy_connections enable row level security;
alter table public.ebay_connections enable row level security;
alter table public.oauth_states enable row level security;

-- Upgrading an existing database: allow the 'ended' status (safe to run again).
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('generating', 'draft', 'published', 'ended', 'failed'));

-- Make the API (PostgREST) see new tables right away.
notify pgrst, 'reload schema';
