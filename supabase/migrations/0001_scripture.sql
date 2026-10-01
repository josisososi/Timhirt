-- Scripture catalogue: the 81-book Ethiopian Orthodox Tewahedo canon.
-- Shared reference data, readable by signed-in users only and writable by nobody
-- through the API (load it with the service role or the SQL editor).
--
-- Rights note: the English/Amharic text we have comes from sources whose
-- redistribution rights are not verified. Read access is therefore limited to
-- authenticated users (not the anonymous key) and the table stays empty until
-- the owner decides to load it.

create table public.books (
  id               text primary key,                    -- stable slug, e.g. 'genesis', '1-meqabyan'
  canon_order      integer not null unique,             -- 1..81 in Ethiopian canonical order
  testament        text not null check (testament in ('OT', 'NT')),
  name_en          text not null,
  name_alt         text,                                -- Ge'ez / traditional name
  name_am          text,
  numbering_system text not null default 'eotc'         -- Ethiopian numbering can differ from Western
);

create table public.chapters (
  book_id          text not null references public.books (id) on delete cascade,
  chapter          integer not null check (chapter >= 1),
  numbering_system text not null default 'eotc',
  primary key (book_id, chapter)
);

-- One row per verse (or per printed verse range, e.g. Amharic "3-4") per language.
-- verse_start = 0 holds a psalm title.
create table public.verses (
  book_id     text not null,
  chapter     integer not null,
  verse_start integer not null check (verse_start >= 0),
  verse_end   integer not null check (verse_end >= verse_start),
  lang        text not null check (lang in ('en', 'am')),
  text        text not null,
  verified    boolean not null default false,           -- false for OCR / unreviewed text
  primary key (book_id, chapter, verse_start, lang),
  foreign key (book_id, chapter) references public.chapters (book_id, chapter) on delete cascade
);

create index verses_lookup on public.verses (book_id, chapter, lang);

-- Row-level security: read-only for signed-in users, no write policies at all.
alter table public.books    enable row level security;
alter table public.chapters enable row level security;
alter table public.verses   enable row level security;

create policy "scripture is readable by signed-in users" on public.books
  for select to authenticated using (true);
create policy "scripture is readable by signed-in users" on public.chapters
  for select to authenticated using (true);
create policy "scripture is readable by signed-in users" on public.verses
  for select to authenticated using (true);
