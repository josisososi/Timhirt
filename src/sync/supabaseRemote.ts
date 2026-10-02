import type { Row, SyncedTable } from '../db/types';
import { supabase } from '../lib/supabase';
import type { Remote } from './engine';

/** Talks to Supabase as the signed-in user; row-level security scopes every call to their rows. */
export const supabaseRemote: Remote = {
  async upsert(table: SyncedTable, rows: Row[]) {
    if (!supabase) throw new Error('Sync is not configured');
    // user_id is filled in by the database from the signed-in user, never sent by the app.
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  },

  async fetchSince(table: SyncedTable, cursor: string | null, limit: number) {
    if (!supabase) throw new Error('Sync is not configured');
    let query = supabase
      .from(table)
      .select('*')
      .order('server_updated_at', { ascending: true })
      .limit(limit);
    if (cursor) query = query.gte('server_updated_at', cursor);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  },
};
