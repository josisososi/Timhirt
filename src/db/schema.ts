// Ordered migrations. Index + 1 is the schema version stored in PRAGMA user_version.
// Never edit a shipped migration: add a new one.
//
// Synced tables share: id (client-generated UUID), created_at, updated_at
// (epoch ms), deleted_at (soft delete, so deletions can sync). Scripture is
// referenced by book_id (stable slug from the canon list) + chapter + verse.
export const migrations: string[] = [
  `
  CREATE TABLE notes (
    id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER NOT NULL,
    verse_end INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX notes_ref ON notes (book_id, chapter);

  CREATE TABLE highlights (
    id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse_start INTEGER NOT NULL,
    verse_end INTEGER NOT NULL,
    color TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX highlights_ref ON highlights (book_id, chapter);

  CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY NOT NULL,
    book_id TEXT NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    label TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE chat_threads (
    id TEXT PRIMARY KEY NOT NULL,
    mode TEXT NOT NULL,
    title TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );

  CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY NOT NULL,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    deleted_at INTEGER
  );
  CREATE INDEX chat_messages_thread ON chat_messages (thread_id, created_at);

  -- Device-local preferences. Not synced.
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  -- Dirty set: one row per record that changed locally and still has to be
  -- pushed. Sync reads the current row state, so repeated edits collapse.
  CREATE TABLE outbox (
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    queued_at INTEGER NOT NULL,
    PRIMARY KEY (table_name, row_id)
  );
  `,
];
