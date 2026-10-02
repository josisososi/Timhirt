// Web storage backend: IndexedDB. Works in every browser with no special
// headers (expo-sqlite on web needs SharedArrayBuffer, which Safari/hosting make painful).
// Native builds use driver.ts (SQLite). Both implement the same Driver interface.
import type { Driver, Row, SyncedTable } from './types';

const DB_NAME = 'timhirt';
const DB_VERSION = 1;
const SYNCED: SyncedTable[] = ['notes', 'highlights', 'bookmarks', 'chat_threads', 'chat_messages'];

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const t of SYNCED) db.createObjectStore(t, { keyPath: 'id' });
        db.createObjectStore('settings', { keyPath: 'key' });
        db.createObjectStore('outbox', { keyPath: ['table_name', 'row_id'] });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }).catch((err) => {
      dbPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return dbPromise;
}

const wrap = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Runs `fn` in one transaction and resolves when it has committed. */
async function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => Promise<T>,
): Promise<T> {
  const db = await getDb();
  const t = db.transaction(stores, mode);
  const done = new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
  const result = await fn(t);
  await done;
  return result;
}

// queued_at must strictly increase per record, so two quick edits never look like one.
const markDirty = async (t: IDBTransaction, table: SyncedTable, id: string, now: number) => {
  const store = t.objectStore('outbox');
  const prev = (await wrap(store.get([table, id]))) as { queued_at: number } | undefined;
  await wrap(store.put({ table_name: table, row_id: id, queued_at: Math.max(now, (prev?.queued_at ?? 0) + 1) }));
};

export const driver: Driver = {
  insert: (table, row, now) =>
    tx([table, 'outbox'], 'readwrite', async (t) => {
      await wrap(t.objectStore(table).add(row));
      await markDirty(t, table, String(row.id), now);
    }),

  update: (table, id, patch, now) =>
    tx([table, 'outbox'], 'readwrite', async (t) => {
      const store = t.objectStore(table);
      const row = (await wrap(store.get(id))) as Row | undefined;
      if (!row || row.deleted_at != null) return;
      await wrap(store.put({ ...row, ...patch, updated_at: now }));
      await markDirty(t, table, id, now);
    }),

  softDelete: (table, id, now) =>
    tx([table, 'outbox'], 'readwrite', async (t) => {
      const store = t.objectStore(table);
      const row = (await wrap(store.get(id))) as Row | undefined;
      if (!row || row.deleted_at != null) return;
      await wrap(store.put({ ...row, deleted_at: now, updated_at: now }));
      await markDirty(t, table, id, now);
    }),

  get: (table, id) =>
    tx([table], 'readonly', async (t) => {
      const row = (await wrap(t.objectStore(table).get(id))) as Row | undefined;
      return row && row.deleted_at == null ? row : null;
    }),

  list: (table, where, oldestFirst) =>
    tx([table], 'readonly', async (t) => {
      const all = (await wrap(t.objectStore(table).getAll())) as Row[];
      const keys = Object.keys(where);
      const rows = all.filter(
        (r) => r.deleted_at == null && keys.every((k) => r[k] === where[k]),
      );
      rows.sort((a, b) => Number(a.created_at) - Number(b.created_at));
      return oldestFirst ? rows : rows.reverse();
    }),

  dirtyCount: () => tx(['outbox'], 'readonly', (t) => wrap(t.objectStore('outbox').count())),

  dirty: () =>
    tx(['outbox'], 'readonly', async (t) => {
      const all = (await wrap(t.objectStore('outbox').getAll())) as {
        table_name: SyncedTable;
        row_id: string;
        queued_at: number;
      }[];
      return all
        .sort((a, b) => a.queued_at - b.queued_at)
        .map((r) => ({ table: r.table_name, id: r.row_id, queuedAt: r.queued_at }));
    }),

  getAny: (table, id) =>
    tx([table], 'readonly', async (t) => {
      const row = (await wrap(t.objectStore(table).get(id))) as Row | undefined;
      return row ?? null;
    }),

  clearDirty: (table, id, queuedAt) =>
    tx(['outbox'], 'readwrite', async (t) => {
      const store = t.objectStore('outbox');
      const entry = (await wrap(store.get([table, id]))) as { queued_at: number } | undefined;
      if (entry && entry.queued_at === queuedAt) await wrap(store.delete([table, id]));
    }),

  upsertRemote: (table, row) =>
    tx([table], 'readwrite', async (t) => {
      await wrap(t.objectStore(table).put(row));
    }),

  getSetting: (key) =>
    tx(['settings'], 'readonly', async (t) => {
      const row = (await wrap(t.objectStore('settings').get(key))) as
        | { key: string; value: string }
        | undefined;
      return row?.value ?? null;
    }),

  setSetting: (key, value) =>
    tx(['settings'], 'readwrite', async (t) => {
      await wrap(t.objectStore('settings').put({ key, value }));
    }),
};
