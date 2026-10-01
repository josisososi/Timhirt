import { randomUUID } from 'expo-crypto';

import { driver } from './driver';
import type { Row, SyncedTable, Value } from './types';

export type Base = {
  id: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

/**
 * Generic local-first store for one synced table. Writes go through the
 * platform driver, which also queues the record for sync in the same
 * transaction. `columns` is the whitelist of editable fields.
 */
export function recordStore<T extends Base>(table: SyncedTable, columns: readonly string[]) {
  const pick = (source: Record<string, unknown>): Row => {
    const out: Row = {};
    for (const c of columns) if (c in source) out[c] = (source[c] ?? null) as Value;
    return out;
  };

  return {
    async create(fields: Omit<T, keyof Base>): Promise<T> {
      const now = Date.now();
      const base = { id: randomUUID(), created_at: now, updated_at: now, deleted_at: null };
      const values = pick(fields);
      // Unspecified optional columns are stored as null so rows are uniform.
      for (const c of columns) if (!(c in values)) values[c] = null;
      await driver.insert(table, { ...base, ...values }, now);
      return { ...base, ...values } as unknown as T;
    },

    async update(id: string, fields: Partial<Omit<T, keyof Base>>): Promise<void> {
      const patch = pick(fields);
      if (Object.keys(patch).length === 0) return;
      await driver.update(table, id, patch, Date.now());
    },

    async remove(id: string): Promise<void> {
      await driver.softDelete(table, id, Date.now());
    },

    async get(id: string): Promise<T | null> {
      return (await driver.get(table, id)) as T | null;
    },

    /** Live rows matching simple equality filters. Newest first by default. */
    async list(where: Partial<Omit<T, keyof Base>> = {}, opts: { oldestFirst?: boolean } = {}) {
      return (await driver.list(table, pick(where), !!opts.oldestFirst)) as unknown as T[];
    },
  };
}
