-- Web Push 通知の購読情報（端末ごとに1行）
-- 設定画面で「毎日のリマインダー」を ON にすると保存され、
-- Vercel Cron (/api/cron/reminder) が今日未記録のユーザーへ通知を送る

create table if not exists public.push_subscriptions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: own rows only"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
