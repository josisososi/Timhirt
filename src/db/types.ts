export type SyncedTable =
  | 'notes'
  | 'highlights'
  | 'bookmarks'
  | 'chat_threads'
  | 'chat_messages';

export type Value = string | number | null;
export type Row = Record<string, Value>;
export type DirtyEntry = { table: SyncedTable; id: string; queuedAt: number };

/** Tables that sync, in an order that satisfies server foreign keys (threads before messages). */
export const SYNC_ORDER: SyncedTable[] = [
  'notes',
  'highlights',
  'bookmarks',
  'chat_threads',
  'chat_messages',
];

/** Columns stored on the device and on the server for each synced table. */
export const TABLE_COLUMNS: Record<SyncedTable, string[]> = {
  notes: ['id', 'book_id', 'chapter', 'verse_start', 'verse_end', 'body', 'created_at', 'updated_at', 'deleted_at'],
  highlights: ['id', 'book_id', 'chapter', 'verse_start', 'verse_end', 'color', 'created_at', 'updated_at', 'deleted_at'],
  bookmarks: ['id', 'book_id', 'chapter', 'verse', 'label', 'created_at', 'updated_at', 'deleted_at'],
  chat_threads: ['id', 'mode', 'title', 'created_at', 'updated_at', 'deleted_at'],
  chat_messages: ['id', 'thread_id', 'role', 'content', 'created_at', 'updated_at', 'deleted_at'],
};

/**
 * Storage backend. SQLite on phones (driver.ts), IndexedDB on web
 * (driver.web.ts). Every write must also mark the record dirty in the same
 * transaction, so nothing is lost if the app closes while offline.
 * Table and column names come from our own code only, never user input.
 */
export interface Driver {
  insert(table: SyncedTable, row: Row, now: number): Promise<void>;
  /** Patch a live (non-deleted) row. */
  update(table: SyncedTable, id: string, patch: Row, now: number): Promise<void>;
  /** Soft delete, so the deletion can sync to other devices. */
  softDelete(table: SyncedTable, id: string, now: number): Promise<void>;
  get(table: SyncedTable, id: string): Promise<Row | null>;
  /** Live rows matching equality filters, ordered by created_at. */
  list(table: SyncedTable, where: Row, oldestFirst: boolean): Promise<Row[]>;
  dirtyCount(): Promise<number>;

  // ---- used by the sync engine -------------------------------------------------
  /** Records changed locally and not yet pushed, oldest first. */
  dirty(): Promise<DirtyEntry[]>;
  /** A row including soft-deleted ones (get() hides those). */
  getAny(table: SyncedTable, id: string): Promise<Row | null>;
  /** Mark a record as pushed, but only if it has not been edited again since `queuedAt`. */
  clearDirty(table: SyncedTable, id: string, queuedAt: number): Promise<void>;
  /** Store a row that came from the server. Does NOT mark it for pushing. */
  upsertRemote(table: SyncedTable, row: Row): Promise<void>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}
