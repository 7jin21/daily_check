-- Inner Mirror Database Schema
-- Run this migration in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_url text,
  notion_token text,          -- 暗号化して保存する場合はVault使用を推奨
  notion_database_id text,
  google_calendar_enabled boolean default false,
  notification_time time,     -- 通知時刻 (HH:MM)
  timezone text default 'Asia/Tokyo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- DIARY ENTRIES TABLE
-- ============================================================
create table if not exists public.diary_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  entry_date date not null,
  mood int2 check (mood between 1 and 5),
  energy int2 check (energy between 1 and 5),
  events text,
  challenges text,
  gratitude text,
  freeform text,
  ai_draft text,
  edited_draft text,
  tags text[] default '{}',
  summary text,
  dominant_emotion text,
  notion_page_id text,        -- Notion同期後にページIDを保存
  notion_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, entry_date)
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists diary_entries_user_id_idx on public.diary_entries(user_id);
create index if not exists diary_entries_entry_date_idx on public.diary_entries(user_id, entry_date desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- profiles
alter table public.profiles enable row level security;

create policy "profiles: own row only"
  on public.profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- diary_entries
alter table public.diary_entries enable row level security;

create policy "entries: own rows only"
  on public.diary_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- updated_at を自動更新するトリガー関数
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger diary_entries_updated_at
  before update on public.diary_entries
  for each row execute function public.handle_updated_at();

-- 新規ユーザー作成時にprofileを自動作成
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
