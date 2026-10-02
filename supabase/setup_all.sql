create table public.books (
  id               text primary key,
  canon_order      integer not null unique,
  testament        text not null check (testament in ('OT', 'NT')),
  name_en          text not null,
  name_alt         text,
  name_am          text,
  numbering_system text not null default 'eotc'
);
create table public.chapters (
  book_id          text not null references public.books (id) on delete cascade,
  chapter          integer not null check (chapter >= 1),
  numbering_system text not null default 'eotc',
  primary key (book_id, chapter)
);
create table public.verses (
  book_id     text not null,
  chapter     integer not null,
  verse_start integer not null check (verse_start >= 0),
  verse_end   integer not null check (verse_end >= verse_start),
  lang        text not null check (lang in ('en', 'am')),
  text        text not null,
  verified    boolean not null default false,
  primary key (book_id, chapter, verse_start, lang),
  foreign key (book_id, chapter) references public.chapters (book_id, chapter) on delete cascade
);
create index verses_lookup on public.verses (book_id, chapter, lang);
alter table public.books    enable row level security;
alter table public.chapters enable row level security;
alter table public.verses   enable row level security;
create policy "scripture is readable by signed-in users" on public.books
  for select to authenticated using (true);
create policy "scripture is readable by signed-in users" on public.chapters
  for select to authenticated using (true);
create policy "scripture is readable by signed-in users" on public.verses
  for select to authenticated using (true);
create function public.set_server_updated_at() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;
create function public.reject_stale_write() returns trigger
language plpgsql as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end;
$$;
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
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
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
create table public.reading_plans (
  id          text primary key,
  title_en    text not null,
  title_am    text,
  description text,
  days        jsonb not null default '[]'
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
do $$
declare t text;
begin
  foreach t in array array[
    'notes', 'highlights', 'bookmarks', 'chat_threads', 'chat_messages',
    'reading_plan_progress', 'devotion_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
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
    execute format(
      'create index %I on public.%I (user_id, server_updated_at)', t || '_sync', t);
  end loop;
end;
$$;
create index chat_messages_thread on public.chat_messages (thread_id, created_at);
drop policy "own rows: insert" on public.chat_messages;
create policy "own rows: insert" on public.chat_messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.chat_threads t
      where t.id = thread_id and t.user_id = (select auth.uid())
    )
  );
alter table public.reading_plans enable row level security;
create policy "plans are readable by signed-in users" on public.reading_plans
  for select to authenticated using (true);
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create function public.consume_ai_quota(max_per_day integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  used integer;
begin
  if uid is null then
    return false;
  end if;
  insert into public.ai_usage (user_id, day, count)
  values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update
    set count = public.ai_usage.count + 1
    where public.ai_usage.count < max_per_day
  returning count into used;
  return used is not null;
end;
$$;
revoke all on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;
