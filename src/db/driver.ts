// Native (iOS/Android) storage backend: SQLite. The web build uses driver.web.ts.
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDb } from './client';
import type { Driver, Row, SyncedTable } from './types';

async function markDirty(
  db: SQLiteDatabase,
  table: SyncedTable,
  id: string,
  now: number,
) {
  await db.runAsync(
    `INSERT INTO outbox (table_name, row_id, queued_at) VALUES (?, ?, ?)
     ON CONFLICT (table_name, row_id) DO UPDATE SET queued_at = excluded.queued_at`,
    [table, id, now],
  );
}

export const driver: Driver = {
  async insert(table, row, now) {
    const db = await getDb();
    const keys = Object.keys(row);
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
        keys.map((k) => row[k]),
      );
      await markDirty(tx, table, String(row.id), now);
    });
  },

  async update(table, id, patch, now) {
    const db = await getDb();
    const keys = Object.keys(patch);
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [...keys.map((k) => patch[k]), now, id],
      );
      await markDirty(tx, table, id, now);
    });
  },

  async softDelete(table, id, now) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.runAsync(
        `UPDATE ${table} SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        [now, now, id],
      );
      await markDirty(tx, table, id, now);
    });
  },

  async get(table, id) {
    const db = await getDb();
    return db.getFirstAsync<Row>(`SELECT * FROM ${table} WHERE id = ? AND deleted_at IS NULL`, [id]);
  },

  async list(table, where, oldestFirst) {
    const db = await getDb();
    const keys = Object.keys(where);
    const clause = ['deleted_at IS NULL', ...keys.map((k) => `${k} = ?`)].join(' AND ');
    return db.getAllAsync<Row>(
      `SELECT * FROM ${table} WHERE ${clause} ORDER BY created_at ${oldestFirst ? 'ASC' : 'DESC'}`,
      keys.map((k) => where[k]),
    );
  },

  async dirtyCount() {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
    return row?.n ?? 0;
  },

  async getSetting(key) {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return row?.value ?? null;
  },

  async setSetting(key, value) {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  },
};
