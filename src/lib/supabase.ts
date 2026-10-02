import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False until the project keys are in .env. The app works fully offline without it. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// Static web export renders pages once in Node, where there is no localStorage.
const noBrowserStorage = Platform.OS === 'web' && typeof window === 'undefined';

/**
 * Only the public anon key belongs in the app. Row-level security is what keeps each
 * user's data private. Never put the service-role key in client code or in .env.
 */
export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: noBrowserStorage ? undefined : AsyncStorage,
        persistSession: !noBrowserStorage,
        autoRefreshToken: !noBrowserStorage,
        flowType: 'pkce',
        detectSessionInUrl: Platform.OS === 'web' && !noBrowserStorage, // magic-link redirect on web
      },
    })
  : null;
