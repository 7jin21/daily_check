-- Google Calendar 連携用: refresh token の保存カラムを追加
-- provider_refresh_token はサインイン直後のセッションにしか含まれないため、
-- auth/callback で受け取って暗号化のうえ profiles に永続化する

alter table public.profiles
  add column if not exists google_refresh_token text;
