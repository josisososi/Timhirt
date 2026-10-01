-- Per-user data. Every table is protected by row-level security: a signed-in
-- user can only ever see and change rows where user_id = their own id.
--
-- Sync design (matches src/db):
--   * ids are client-generated UUIDs, so records can be created offline;
--   * created_at / updated_at are the device's epoch milliseconds (kept as bigint
--     so a record round-trips unchanged; last write wins on updated_at);
--   * deleted_at is a soft delete so deletions sync to other devices;
--   * server_updated_at is set by the server on every write and is the cursor
--     devices use to pull "everything changed since I last synced" (immune to
--     device clock skew).

-- ---------------------------------------------------------------- helpers
create function public.set_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- Last write wins: ignore a push that is older than what the server already has.
create function public.reject_stale_write() returns trigger
language plpgsql as $$
begin
  if new.updated_at < old.updated_at then
    return old;  -- keep the newer server copy, silently
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  language          text not null default 'en' check (language in ('en', 'am')),
  server_updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "own profile: select" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "own profile: insert" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "own profile: update" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.set_server_updated_at();

-- Create a profile row automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- synced tables
create table public.notes (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id           text not null,
  chapter           integer not null,
  verse_start       integer not null,
  verse_end         integer not null,
  body              text not null,
  created_at        bigint not null,
  updated_at        bigint not null,
  deleted_at        bigint,
  server_updated_at timestamptz not null default now()
);

create table public.highlights (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id           text not null,
  chapter           integer not null,
  verse_start       integer not null,
  verse_end         integer not null,
  color             text not null,
  created_at        bigint not null,
  updated_at        bigint not null,
  deleted_at        bigint,
  server_updated_at timestamptz not null default now()
);

create table public.bookmarks (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id           text not null,
  chapter           integer not null,
  verse             integer not null,
  label             text,
  created_at        bigint not null,
  updated_at        bigint not null,
  deleted_at        bigint,
  server_updated_at timestamptz not null default now()
);

create table public.chat_threads (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode              text not null check (mode in ('study', 'devotion', 'open')),
  title             text,
  created_at        bigint not null,
  updated_at        bigint not null,
  deleted_at        bigint,
  server_updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  thread_id         uuid not null references public.chat_threads (id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  content           text not null,
  created_at        bigint not null,
  updated_at        bigint not null,
  deleted_at        bigint,
  server_updated_at timestamptz not null default now()
);

-- Reading plans: a shared catalogue (readable by signed-in users) plus each
-- user's own progress.
create table public.reading_plans (
  id          text primary key,                 -- e.g. 'gospels-in-40-days'
  title_en    text not null,
  title_am    text,
  description text,
  days        jsonb not null default '[]'       -- [{ "day": 1, "refs": [{book_id, chapter, ...}] }]
);

create table public.reading_plan_progress (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id           text not null references public.reading_plans (id),
  started_on        date not null,
  completed_days    jsonb not null default '[]',
  created_at        bigint not null,
  updated_at        bigint not null,
  deleted_at        bigint,
  server_updated_at timestamptz not null default now()
);

create table public.devotion_history (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day               date not null,
  book_id           text,
  chapter           integer,
  verse_start       integer,
  verse_end         integer,
  reflection        text,
  prayer            text,
  created_at        bigint not null,
  updated_at        bigint not null,
  deleted_at        bigint,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS + triggers
do $$
declare t text;
begin
  foreach t in array array[
    'notes', 'highlights', 'bookmarks', 'chat_threads', 'chat_messages',
    'reading_plan_progress', 'devotion_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- No DELETE policy on purpose: rows are soft-deleted via deleted_at.
    execute format(
      'create policy "own rows: select" on public.%I for select to authenticated
         using ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: insert" on public.%I for insert to authenticated
         with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create policy "own rows: update" on public.%I for update to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.reject_stale_write()', t || '_stale', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.set_server_updated_at()', t || '_touch', t);
    -- pull cursor: "my rows changed since X"
    execute format(
      'create index %I on public.%I (user_id, server_updated_at)', t || '_sync', t);
  end loop;
end;
$$;

create index chat_messages_thread on public.chat_messages (thread_id, created_at);

-- A message may only be added to a thread the same user owns. (Foreign-key checks
-- bypass row-level security, so without this a user could attach a message to
-- someone else's thread id.)
drop policy "own rows: insert" on public.chat_messages;
create policy "own rows: insert" on public.chat_messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = (select auth.uid())
    )
  );

-- Reading plan catalogue: read-only for signed-in users.
alter table public.reading_plans enable row level security;
create policy "plans are readable by signed-in users" on public.reading_plans
  for select to authenticated using (true);
