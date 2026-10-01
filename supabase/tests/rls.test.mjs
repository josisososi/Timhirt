// Verifies the database schema and row-level security rules against an in-memory
// Postgres (PGlite), using two fake users. Run: npm run test:db
//
// It stubs the small part of Supabase this schema relies on (the auth schema,
// auth.uid() and the anon/authenticated roles), then applies the real migrations.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');
const db = new PGlite();

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failures++;
};

// ---- minimal Supabase stand-in -------------------------------------------------
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
`);

for (const file of readdirSync(migrationsDir).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  console.log(`applied ${file}`);
}

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);

/** Run SQL as a given signed-in user (or anonymous) the way the API would. */
async function as(user, sql, params = []) {
  await db.exec(`set role ${user ? 'authenticated' : 'anon'}`);
  await db.exec(`select set_config('request.jwt.claim.sub', '${user ?? ''}', false)`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
const fails = async (user, sql, params) => {
  try {
    await as(user, sql, params);
    return false;
  } catch {
    return true;
  }
};

const note = (id, body, updated = 1000) => [
  `insert into notes (id, book_id, chapter, verse_start, verse_end, body, created_at, updated_at)
   values ($1, 'genesis', 1, 1, 1, $2, 1000, $3)`,
  [id, body, updated],
];
const N1 = 'aaaaaaaa-0000-0000-0000-000000000001';

// ---- tests ---------------------------------------------------------------------
check('signing up creates a profile', (await db.query(`select count(*)::int n from profiles`)).rows[0].n === 2);

await as(A, ...note(N1, 'A private note'));
check('user_id defaults to the signed-in user',
  (await db.query(`select user_id from notes where id = '${N1}'`)).rows[0].user_id === A);
check('owner can read their note', (await as(A, `select * from notes`)).rows.length === 1);
check("another user cannot read it", (await as(B, `select * from notes`)).rows.length === 0);
check('anonymous cannot read it', await fails(null, `select * from notes`) || (await as(null, `select * from notes`)).rows.length === 0);

check("another user cannot update it",
  (await as(B, `update notes set body = 'hacked' where id = '${N1}'`)).affectedRows === 0);
check("another user cannot soft-delete it",
  (await as(B, `update notes set deleted_at = 5 where id = '${N1}'`)).affectedRows === 0);
check("another user cannot hard-delete it",
  (await as(B, `delete from notes where id = '${N1}'`)).affectedRows === 0);
check("owner cannot hard-delete either (no delete policy)",
  (await as(A, `delete from notes where id = '${N1}'`)).affectedRows === 0);
check('cannot insert a row owned by someone else',
  await fails(B, `insert into notes (id, user_id, book_id, chapter, verse_start, verse_end, body, created_at, updated_at)
                  values (gen_random_uuid(), '${A}', 'genesis', 1, 1, 1, 'x', 1, 1)`));
check('cannot reassign a row to someone else',
  await fails(A, `update notes set user_id = '${B}' where id = '${N1}'`));
check('upserting over another user\'s id is rejected',
  await fails(B, `insert into notes (id, book_id, chapter, verse_start, verse_end, body, created_at, updated_at)
                  values ('${N1}', 'genesis', 1, 1, 1, 'takeover', 1, 9999)
                  on conflict (id) do update set body = excluded.body`));

// last-write-wins + soft delete + server cursor
await as(A, `update notes set body = 'newer', updated_at = 2000 where id = '${N1}'`);
await as(A, `update notes set body = 'stale push', updated_at = 1500 where id = '${N1}'`);
check('a stale (older) write is ignored',
  (await db.query(`select body from notes where id = '${N1}'`)).rows[0].body === 'newer');
const before = (await db.query(`select server_updated_at t from notes where id = '${N1}'`)).rows[0].t;
await new Promise((r) => setTimeout(r, 20));
await as(A, `update notes set deleted_at = 3000, updated_at = 3000 where id = '${N1}'`);
const after = (await db.query(`select server_updated_at t, deleted_at from notes where id = '${N1}'`)).rows[0];
check('soft delete is stored and the server cursor advances',
  after.deleted_at == 3000 && new Date(after.t) > new Date(before));

// chat: messages only into your own thread
const T = 'bbbbbbbb-0000-0000-0000-000000000001';
await as(A, `insert into chat_threads (id, mode, created_at, updated_at) values ('${T}', 'study', 1, 1)`);
check('owner can add a message to their thread',
  !(await fails(A, `insert into chat_messages (id, thread_id, role, content, created_at, updated_at)
                    values (gen_random_uuid(), '${T}', 'user', 'hi', 1, 1)`)));
check("cannot add a message to someone else's thread",
  await fails(B, `insert into chat_messages (id, thread_id, role, content, created_at, updated_at)
                  values (gen_random_uuid(), '${T}', 'user', 'intruder', 1, 1)`));
check("other users cannot read the thread's messages",
  (await as(B, `select * from chat_messages`)).rows.length === 0);
check('invalid mode is rejected',
  await fails(A, `insert into chat_threads (id, mode, created_at, updated_at) values (gen_random_uuid(), 'bogus', 1, 1)`));

// profiles
check('user reads only their own profile', (await as(A, `select id from profiles`)).rows.length === 1);
check("user cannot edit someone else's profile",
  (await as(A, `update profiles set display_name = 'x' where id = '${B}'`)).affectedRows === 0);

// scripture: signed-in read only, nobody writes through the API
await db.exec(`
  insert into books (id, canon_order, testament, name_en) values ('genesis', 1, 'OT', 'Genesis');
  insert into chapters (book_id, chapter) values ('genesis', 1);
  insert into verses (book_id, chapter, verse_start, verse_end, lang, text) values ('genesis', 1, 1, 1, 'en', 'In the beginning');
`);
check('signed-in users can read scripture', (await as(A, `select * from verses`)).rows.length === 1);
check('anonymous users cannot read scripture', (await as(null, `select * from verses`)).rows.length === 0);
check('users cannot write scripture',
  (await fails(A, `insert into verses (book_id, chapter, verse_start, verse_end, lang, text) values ('genesis', 1, 2, 2, 'en', 'x')`)) &&
  (await as(A, `update verses set text = 'x'`)).affectedRows === 0 &&
  (await as(A, `delete from verses`)).affectedRows === 0);

// every user-data table has RLS switched on
const noRls = (await db.query(`
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`)).rows;
check('row-level security is enabled on every public table', noRls.length === 0, JSON.stringify(noRls));

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
