import * as SQLite from 'expo-sqlite';

import { migrations } from './schema';

const DB_NAME = 'timhirt.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let v = current; v < migrations.length; v++) {
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(migrations[v]);
      await tx.execAsync(`PRAGMA user_version = ${v + 1}`);
    });
  }
}

/** Opens the local database once and brings its schema up to date. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await migrate(db);
      return db;
    })().catch((err) => {
      dbPromise = null; // allow a retry on the next call
      throw err;
    });
  }
  return dbPromise;
}
