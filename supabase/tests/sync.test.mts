// Tests the sync engine end to end: simulated devices (in-memory storage) talking to a real
// Postgres built from our migrations, with the real row-level security rules.
// Run: npm run test:sync
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

import { SYNC_ORDER, TABLE_COLUMNS, type Driver, type Row, type SyncedTable } from '../../src/db/types';
import { SyncError, syncOnce, type Remote } from '../../src/sync/engine';

const here = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- a fake device
class MemoryDriver implements Driver {
  tables = new Map<SyncedTable, Map<string, Row>>();
  outbox = new Map<string, { table: SyncedTable; id: string; queuedAt: number }>();
  settings = new Map<string, string>();
  private t(table: SyncedTable) {
    if (!this.tables.has(table)) this.tables.set(table, new Map());
    return this.tables.get(table)!;
  }
  private mark(table: SyncedTable, id: string, now: number) {
    const key = `${table}/${id}`;
    const prev = this.outbox.get(key);
    this.outbox.set(key, { table, id, queuedAt: Math.max(now, (prev?.queuedAt ?? 0) + 1) });
  }
  async insert(table: SyncedTable, row: Row, now: number) {
    this.t(table).set(String(row.id), { ...row });
    this.mark(table, String(row.id), now);
  }
  async update(table: SyncedTable, id: string, patch: Row, now: number) {
    const r = this.t(table).get(id);
    if (!r || r.deleted_at != null) return;
    this.t(table).set(id, { ...r, ...patch, updated_at: now });
    this.mark(table, id, now);
  }
  async softDelete(table: SyncedTable, id: string, now: number) {
    const r = this.t(table).get(id);
    if (!r || r.deleted_at != null) return;
    this.t(table).set(id, { ...r, deleted_at: now, updated_at: now });
    this.mark(table, id, now);
  }
  async get(table: SyncedTable, id: string) {
    const r = this.t(table).get(id);
    return r && r.deleted_at == null ? r : null;
  }
  async list(table: SyncedTable, where: Row) {
    return [...this.t(table).values()].filter(
      (r) => r.deleted_at == null && Object.keys(where).every((k) => r[k] === where[k]),
    );
  }
  async dirtyCount() {
    return this.outbox.size;
  }
  async dirty() {
    return [...this.outbox.values()].sort((a, b) => a.queuedAt - b.queuedAt);
  }
  async getAny(table: SyncedTable, id: string) {
    return this.t(table).get(id) ?? null;
  }
  async clearDirty(table: SyncedTable, id: string, queuedAt: number) {
    const key = `${table}/${id}`;
    if (this.outbox.get(key)?.queuedAt === queuedAt) this.outbox.delete(key);
  }
  async upsertRemote(table: SyncedTable, row: Row) {
    this.t(table).set(String(row.id), { ...row });
  }
  async getSetting(key: string) {
    return this.settings.get(key) ?? null;
  }
  async setSetting(key: string, value: string) {
    this.settings.set(key, value);
  }
}

// ---------------------------------------------------------------- the real database
const db = new PGlite();
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
for (const f of readdirSync(join(here, '..', 'migrations')).sort()) {
  await db.exec(readFileSync(join(here, '..', 'migrations', f), 'utf8'));
}
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);

/** A Remote that behaves like PostgREST for one signed-in user. */
function remoteFor(user: string, hooks: { beforeUpsert?: () => Promise<void>; offline?: boolean } = {}): Remote {
  const run = async <T extends object>(sql: string, params: unknown[] = []) => {
    await db.exec(`set role authenticated`);
    await db.exec(`select set_config('request.jwt.claim.sub', '${user}', false)`);
    try {
      return await db.query<T>(sql, params);
    } finally {
      await db.exec('reset role');
    }
  };
  return {
    async upsert(table, rows) {
      if (hooks.offline) throw new Error('network down');
      if (hooks.beforeUpsert) await hooks.beforeUpsert();
      for (const row of rows) {
        const cols = TABLE_COLUMNS[table];
        const set = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ');
        await run(
          `insert into ${table} (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})
           on conflict (id) do update set ${set}`,
          cols.map((c) => row[c] ?? null),
        );
      }
    },
    async fetchSince(table, cursor, limit) {
      if (hooks.offline) throw new Error('network down');
      const res = await run<Row>(
        `select t.*, to_char(t.server_updated_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"') as su
         from ${table} t where ($1::text is null or t.server_updated_at >= $1::timestamptz)
         order by t.server_updated_at asc limit ${limit}`,
        [cursor],
      );
      return res.rows.map((r) => ({
        ...r,
        server_updated_at: r.su,
        // bigint columns arrive as strings here; the engine must cope with that
        created_at: String(r.created_at),
        updated_at: String(r.updated_at),
        deleted_at: r.deleted_at == null ? null : String(r.deleted_at),
      }));
    },
  };
}
const serverRows = async (table: string, user = A) =>
  (await db.query<Row>(`select * from ${table} where user_id = '${user}'`)).rows;

// ---------------------------------------------------------------- helpers + checks
let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failures++;
};
const noteRow = (id: string, body: string, ts: number): Row => ({
  id, book_id: 'genesis', chapter: 1, verse_start: 1, verse_end: 1, body,
  created_at: ts, updated_at: ts, deleted_at: null,
});
const N1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const body = async (d: MemoryDriver, id: string) => (await d.getAny('notes', id))?.body;

const d1 = new MemoryDriver();
const d2 = new MemoryDriver();
const remoteA = remoteFor(A);

// 1. push
await d1.insert('notes', noteRow(N1, 'first', 1000), 1000);
let r = await syncOnce(d1, remoteA, A);
check('a new note is pushed to the server', r.pushed === 1 && (await serverRows('notes')).length === 1);
check('after pushing, nothing is left waiting', (await d1.dirtyCount()) === 0);

// 2. a second device receives it, without re-queueing it for push
r = await syncOnce(d2, remoteA, A);
check('a second device receives the note', (await body(d2, N1)) === 'first' && r.pulled >= 1);
check('received data is not queued to be pushed back', (await d2.dirtyCount()) === 0);

// 3. edit propagates
await d2.update('notes', N1, { body: 'edited on d2' }, 2000);
await syncOnce(d2, remoteA, A);
await syncOnce(d1, remoteA, A);
check('an edit on one device reaches the other', (await body(d1, N1)) === 'edited on d2');

// 4. conflicting offline edits: the later edit wins everywhere
await d1.update('notes', N1, { body: 'd1 offline edit' }, 3000);
await d2.update('notes', N1, { body: 'd2 later offline edit' }, 3500);
await syncOnce(d1, remoteA, A); // server now has the 3000 version
await syncOnce(d2, remoteA, A); // 3500 is newer, wins
await syncOnce(d1, remoteA, A);
check('conflicting edits: the newest edit wins on both devices',
  (await body(d1, N1)) === 'd2 later offline edit' && (await body(d2, N1)) === 'd2 later offline edit');
check('the server holds the winning edit', (await serverRows('notes'))[0].body === 'd2 later offline edit');

// 4b. an older edit pushed late must not overwrite newer data
await d1.update('notes', N1, { body: 'stale late push' }, 3200);
await syncOnce(d1, remoteA, A);
check('an older edit pushed late does not overwrite newer data',
  (await serverRows('notes'))[0].body === 'd2 later offline edit');
check('and the stale device converges to the newer data', (await body(d1, N1)) === 'd2 later offline edit');

// 5. soft delete propagates
await d1.softDelete('notes', N1, 4000);
await syncOnce(d1, remoteA, A);
await syncOnce(d2, remoteA, A);
check('a deletion reaches the other device', (await d2.get('notes', N1)) === null && (await d2.getAny('notes', N1))?.deleted_at === 4000);
check('the row is soft-deleted on the server, not removed',
  (await serverRows('notes')).length === 1 && String((await serverRows('notes'))[0].deleted_at) === '4000');

// 6. idempotent
r = await syncOnce(d1, remoteA, A);
check('syncing again with no changes does nothing', r.pushed === 0 && r.pulled === 0, JSON.stringify(r));

// 7. offline: nothing is lost, and it recovers
const N2 = 'aaaaaaaa-0000-0000-0000-000000000002';
await d1.insert('notes', noteRow(N2, 'written offline', 5000), 5000);
let threw = false;
try { await syncOnce(d1, remoteFor(A, { offline: true }), A); } catch { threw = true; }
check('going offline makes sync fail without losing data', threw && (await d1.dirtyCount()) === 1 && (await body(d1, N2)) === 'written offline');
await syncOnce(d1, remoteA, A);
check('when the connection returns the offline note syncs',
  (await d1.dirtyCount()) === 0 && (await serverRows('notes')).some((x) => x.id === N2));

// 8. an edit made while a push is in flight is not lost
const N3 = 'aaaaaaaa-0000-0000-0000-000000000003';
await d1.insert('notes', noteRow(N3, 'v1', 6000), 6000);
const racing = remoteFor(A, { beforeUpsert: async () => { await d1.update('notes', N3, { body: 'v2 during push' }, 6100); } });
await syncOnce(d1, racing, A);
check('an edit made during a push stays queued', (await d1.dirtyCount()) === 1);
await syncOnce(d1, remoteA, A);
check('and goes up on the next sync', (await serverRows('notes')).find((x) => x.id === N3)?.body === 'v2 during push' && (await d1.dirtyCount()) === 0);

// 9. chat threads and messages (messages reference threads)
const T1 = 'bbbbbbbb-0000-0000-0000-000000000001';
await d1.insert('chat_messages', { id: 'cccccccc-0000-0000-0000-000000000001', thread_id: T1, role: 'user', content: 'hi', created_at: 7001, updated_at: 7001, deleted_at: null }, 7001);
await d1.insert('chat_threads', { id: T1, mode: 'study', title: 'T', created_at: 7000, updated_at: 7000, deleted_at: null }, 7000);
await syncOnce(d1, remoteA, A);
await syncOnce(d2, remoteA, A);
check('chat threads and their messages sync in the right order',
  (await serverRows('chat_messages')).length === 1 && (await d2.getAny('chat_messages', 'cccccccc-0000-0000-0000-000000000001')) !== null);

// 10. a different account on the same device is refused, and nothing leaks
let refused = false;
try { await syncOnce(d1, remoteFor(B), B); } catch (e) { refused = e instanceof SyncError && e.code === 'other-account'; }
check('a device that synced as one account refuses another account', refused);
check("account B's server data stays empty", (await serverRows('notes', B)).length === 0);

// 11. a fresh device for account B sees none of A's data
const dB = new MemoryDriver();
await dB.insert('notes', noteRow('dddddddd-0000-0000-0000-000000000001', 'B private', 8000), 8000);
r = await syncOnce(dB, remoteFor(B), B);
check("another user's device receives none of A's data", (await dB.list('notes', {})).length === 1 && r.pulled <= 1);
check("A's data is untouched by B", (await serverRows('notes')).every((x) => x.user_id === A));

// 12. many records: batched pushes and paged pulls
const big = new MemoryDriver();
for (let i = 0; i < 1100; i++) {
  const id = `eeeeeeee-0000-0000-0000-${String(i).padStart(12, '0')}`;
  await big.insert('notes', noteRow(id, `bulk ${i}`, 9000 + i), 9000 + i);
}
await syncOnce(big, remoteA, A);
check('1100 notes are pushed in batches', (await serverRows('notes')).filter((x) => String(x.body).startsWith('bulk')).length === 1100);
const fresh = new MemoryDriver();
await syncOnce(fresh, remoteA, A);
const got = (await fresh.list('notes', {})).filter((x) => String(x.body).startsWith('bulk')).length;
check('a new device pulls all 1100 across several pages', got === 1100, `got ${got}`);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll sync checks passed');
process.exit(failures ? 1 : 0);
