import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';

import { driver } from '../db/driver';
import { useAuth } from '../lib/auth';
import { SyncError, syncOnce } from './engine';
import { supabaseRemote } from './supabaseRemote';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline' | 'other-account';

type SyncState = {
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Local changes waiting to be uploaded. */
  pending: number;
  syncNow: () => Promise<void>;
};

const SyncContext = createContext<SyncState>({
  status: 'idle',
  lastSyncedAt: null,
  pending: 0,
  syncNow: async () => {},
});

export const useSync = () => useContext(SyncContext);

const SYNC_EVERY_MS = 30_000;
const PENDING_REFRESH_MS = 4_000;

/**
 * Keeps this device in step with the account while signed in: on sign-in, every 30 seconds,
 * when the app comes back to the foreground and when the connection returns. Offline is
 * normal: a failed sync just leaves changes queued and tries again later.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const running = useRef(false);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      setPending(await driver.dirtyCount());
    } catch {
      /* storage not ready yet */
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!userId || running.current) return;
    running.current = true;
    setStatus('syncing');
    try {
      await syncOnce(driver, supabaseRemote, userId);
      setLastSyncedAt(Date.now());
      setStatus('ok');
    } catch (e) {
      setStatus(e instanceof SyncError && e.code === 'other-account' ? 'other-account' : 'offline');
    } finally {
      running.current = false;
      refreshPending();
    }
  }, [userId, refreshPending]);

  useEffect(() => {
    if (!userId) {
      setStatus('idle');
      return;
    }
    syncNow();
    const timer = setInterval(syncNow, SYNC_EVERY_MS);
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && syncNow());
    const onOnline = () => syncNow();
    if (Platform.OS === 'web') window.addEventListener('online', onOnline);
    return () => {
      clearInterval(timer);
      appSub.remove();
      if (Platform.OS === 'web') window.removeEventListener('online', onOnline);
    };
  }, [userId, syncNow]);

  useEffect(() => {
    refreshPending();
    const timer = setInterval(refreshPending, PENDING_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshPending]);

  const value = useMemo(
    () => ({ status, lastSyncedAt, pending, syncNow }),
    [status, lastSyncedAt, pending, syncNow],
  );
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
