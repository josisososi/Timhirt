import { SYNC_ORDER, TABLE_COLUMNS, type Driver, type Row, type SyncedTable } from '../db/types';

/**
 * The server side of sync, kept abstract so the engine can be tested without a network.
 * The real implementation (supabaseRemote.ts) talks to Supabase; rows there are protected
 * by row-level security, so a signed-in user only ever pushes and pulls their own data.
 */
export interface Remote {
  /** Insert or update rows by id. The server ignores a write older than what it already has. */
  upsert(table: SyncedTable, rows: Row[]): Promise<void>;
  /** Rows with server_updated_at >= cursor (all rows if null), oldest first, at most `limit`. */
  fetchSince(table: SyncedTable, cursor: string | null, limit: number): Promise<Row[]>;
}

export class SyncError extends Error {
  constructor(
    public code: 'other-account',
    message: string,
  ) {
    super(message);
  }
}

export type SyncResult = { pushed: number; pulled: number };

const PUSH_BATCH = 100;
const PULL_PAGE = 500;
const NUMERIC = new Set([
  'created_at', 'updated_at', 'deleted_at', 'chapter', 'verse_start', 'verse_end', 'verse',
]);

/** Only the known columns, with numbers as numbers (the server may send bigints as strings). */
function normalise(table: SyncedTable, row: Row): Row {
  const out: Row = {};
  for (const col of TABLE_COLUMNS[table]) {
    const v = row[col] ?? null;
    out[col] = v !== null && NUMERIC.has(col) ? Number(v) : v;
  }
  return out;
}

async function push(driver: Driver, remote: Remote): Promise<number> {
  const entries = await driver.dirty();
  let pushed = 0;

  for (const table of SYNC_ORDER) {
    const mine = entries.filter((e) => e.table === table);
    for (let i = 0; i < mine.length; i += PUSH_BATCH) {
      const rows: Row[] = [];
      const sent = [];
      for (const entry of mine.slice(i, i + PUSH_BATCH)) {
        const row = await driver.getAny(table, entry.id);
        if (!row) {
          await driver.clearDirty(table, entry.id, entry.queuedAt); // nothing left to send
          continue;
        }
        rows.push(normalise(table, row));
        sent.push(entry);
      }
      if (rows.length) await remote.upsert(table, rows);
      // Only clears a record that was not edited again while we were pushing.
      for (const entry of sent) await driver.clearDirty(table, entry.id, entry.queuedAt);
      pushed += sent.length;
    }
  }
  return pushed;
}

/** Last write wins: keep the local copy if it is at least as new as the server's. */
async function applyRemote(driver: Driver, table: SyncedTable, remoteRow: Row): Promise<boolean> {
  const row = normalise(table, remoteRow);
  const local = await driver.getAny(table, String(row.id));
  if (local && Number(local.updated_at) >= Number(row.updated_at)) return false;
  await driver.upsertRemote(table, row);
  return true;
}

async function pull(driver: Driver, remote: Remote): Promise<number> {
  let pulled = 0;

  for (const table of SYNC_ORDER) {
    const key = `sync_cursor_${table}`;
    let cursor = await driver.getSetting(key);
    for (;;) {
      const rows = await remote.fetchSince(table, cursor, PULL_PAGE);
      for (const r of rows) if (await applyRemote(driver, table, r)) pulled++;
      if (!rows.length) break;

      const last = String(rows[rows.length - 1].server_updated_at);
      await driver.setSetting(key, last);
      // A short page means we are caught up. A full page whose last timestamp did not move
      // would loop forever, so stop (the next sync continues from the saved cursor).
      if (rows.length < PULL_PAGE || last === cursor) break;
      cursor = last;
    }
  }
  return pulled;
}

/**
 * One full sync: push local changes, then pull everyone else's. Safe to run any time and as
 * often as you like; if the network fails midway, nothing is lost and the next run resumes.
 */
export async function syncOnce(driver: Driver, remote: Remote, userId: string): Promise<SyncResult> {
  // A device that has synced as one account must not push its data into another account.
  const previous = await driver.getSetting('sync_user_id');
  if (previous && previous !== userId) {
    throw new SyncError('other-account', 'This device holds data from a different account.');
  }
  if (!previous) await driver.setSetting('sync_user_id', userId);

  const pushed = await push(driver, remote);
  const pulled = await pull(driver, remote);
  return { pushed, pulled };
}
