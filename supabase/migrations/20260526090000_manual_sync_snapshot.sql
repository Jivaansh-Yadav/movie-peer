alter table public.sessions
  add column if not exists sync_version integer not null default 0,
  add column if not exists sync_progress numeric,
  add column if not exists sync_paused boolean,
  add column if not exists sync_updated_at timestamptz,
  add column if not exists sync_request_nonce bigint;
