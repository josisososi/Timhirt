export type SyncedTable =
  | 'notes'
  | 'highlights'
  | 'bookmarks'
  | 'chat_threads'
  | 'chat_messages';

export type Value = string | number | null;
export type Row = Record<string, Value>;

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
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}
