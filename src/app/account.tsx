import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { sendMagicLink, signOut, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useSync } from '@/sync/SyncProvider';
import { colors, fonts, spacing } from '@/theme';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

export default function AccountScreen() {
  const { t, i18n } = useTranslation();
  const { configured, loading, session } = useAuth();
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [profileOk, setProfileOk] = useState<boolean | null>(null);
  const isAm = i18n.language === 'am';

  // Proves a signed-in user can read their own row through the security rules.
  useEffect(() => {
    if (!supabase || !session) return setProfileOk(null);
    supabase
      .from('profiles')
      .select('id')
      .then(({ data, error }) => setProfileOk(!error && data?.length === 1));
  }, [session]);

  const submit = async () => {
    setStatus({ kind: 'sending' });
    const { error } = await sendMagicLink(email);
    setStatus(error ? { kind: 'error', message: error } : { kind: 'sent' });
  };

  const looksLikeEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={[styles.title, isAm && styles.ethiopic]}>{t('account.title')}</Text>

      {!configured ? (
        <Text style={styles.note}>{t('account.notConfigured')}</Text>
      ) : loading ? null : session ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t('account.signedInAs')}</Text>
          <Text style={styles.email}>{session.user.email}</Text>
          {profileOk !== null && (
            <Text style={styles.small}>
              {profileOk ? t('account.syncReady') : t('account.profileProblem')}
            </Text>
          )}
          <View style={styles.syncBox}>
            <Text style={styles.label}>
              {sync.status === 'syncing'
                ? t('sync.syncing')
                : sync.status === 'ok'
                  ? t('sync.ok')
                  : sync.status === 'offline'
                    ? t('sync.offline')
                    : sync.status === 'other-account'
                      ? t('sync.otherAccount')
                      : ''}
            </Text>
            {sync.lastSyncedAt && sync.status !== 'other-account' ? (
              <Text style={styles.small}>
                {t('sync.lastSynced', { time: new Date(sync.lastSyncedAt).toLocaleTimeString() })}
              </Text>
            ) : null}
            {sync.pending > 0 && (
              <Text style={styles.small}>{t('sync.waiting', { count: sync.pending })}</Text>
            )}
            <Pressable
              style={[styles.secondary, sync.status === 'syncing' && styles.disabled]}
              disabled={sync.status === 'syncing' || sync.status === 'other-account'}
              onPress={() => sync.syncNow()}
              accessibilityRole="button">
              <Text style={styles.secondaryText}>{t('sync.syncNow')}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.secondary} onPress={() => signOut()} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t('account.signOut')}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={[styles.body, isAm && styles.ethiopic]}>{t('account.intro')}</Text>
          <TextInput
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (status.kind !== 'idle') setStatus({ kind: 'idle' });
            }}
            placeholder={t('account.emailPlaceholder')}
            placeholderTextColor={colors.parchmentDim}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={styles.input}
          />
          <Pressable
            style={[styles.primary, (!looksLikeEmail || status.kind === 'sending') && styles.disabled]}
            disabled={!looksLikeEmail || status.kind === 'sending'}
            onPress={submit}
            accessibilityRole="button">
            <Text style={styles.primaryText}>
              {status.kind === 'sending' ? t('account.sending') : t('account.sendLink')}
            </Text>
          </Pressable>
          {status.kind === 'sent' && <Text style={styles.ok}>{t('account.checkEmail')}</Text>}
          {status.kind === 'error' && <Text style={styles.error}>{status.message}</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.gold, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.parchmentWash,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    padding: spacing.lg,
    gap: spacing.md,
  },
  note: { fontFamily: fonts.ui, fontSize: 13, color: colors.mist, padding: spacing.md },
  body: { fontFamily: fonts.scripture, fontSize: 20, lineHeight: 28, color: colors.mist },
  label: { fontFamily: fonts.uiMedium, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.gold },
  email: { fontFamily: fonts.scripture, fontSize: 22, color: colors.mist },
  small: { fontFamily: fonts.ui, fontSize: 12, color: colors.parchmentDim },
  syncBox: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.goldFaint },
  input: {
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 2,
    color: colors.parchment,
    fontFamily: fonts.ui,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  primary: { backgroundColor: colors.deepRed, borderRadius: 2, paddingVertical: 13, alignItems: 'center' },
  primaryText: { fontFamily: fonts.uiMedium, fontSize: 13, letterSpacing: 0.8, color: colors.parchment },
  secondary: { borderWidth: 1, borderColor: colors.goldBorder, borderRadius: 2, paddingVertical: 11, alignItems: 'center' },
  secondaryText: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.gold },
  disabled: { opacity: 0.4 },
  ok: { fontFamily: fonts.ui, fontSize: 13, color: colors.gold },
  error: { fontFamily: fonts.ui, fontSize: 13, color: '#E58A8A' },
  ethiopic: { fontFamily: fonts.ethiopic },
});
