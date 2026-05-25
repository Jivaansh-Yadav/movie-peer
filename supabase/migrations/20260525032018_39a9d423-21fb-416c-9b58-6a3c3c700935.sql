
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  host_id text not null,
  tmdb_id integer not null,
  media_type text not null default 'movie',
  title text,
  poster_path text,
  backdrop_path text,
  season integer,
  episode integer,
  playback_time numeric default 0,
  playback_state text default 'paused',
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  user_id text not null,
  username text not null,
  is_host boolean default false,
  joined_at timestamptz default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  user_id text,
  username text,
  message text not null,
  kind text default 'chat',
  created_at timestamptz default now()
);

create index sessions_room_code_idx on public.sessions(room_code);
create index participants_session_idx on public.participants(session_id);
create index messages_session_idx on public.messages(session_id, created_at);

alter table public.sessions enable row level security;
alter table public.participants enable row level security;
alter table public.messages enable row level security;

-- Public room-code based app, no auth: permissive policies.
create policy "sessions readable by all" on public.sessions for select using (true);
create policy "sessions insertable by all" on public.sessions for insert with check (true);
create policy "sessions updatable by all" on public.sessions for update using (true) with check (true);

create policy "participants readable by all" on public.participants for select using (true);
create policy "participants insertable by all" on public.participants for insert with check (true);
create policy "participants updatable by all" on public.participants for update using (true) with check (true);
create policy "participants deletable by all" on public.participants for delete using (true);

create policy "messages readable by all" on public.messages for select using (true);
create policy "messages insertable by all" on public.messages for insert with check (true);

alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.participants;
alter publication supabase_realtime add table public.messages;

alter table public.sessions replica identity full;
alter table public.participants replica identity full;
alter table public.messages replica identity full;
