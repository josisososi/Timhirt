import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, fonts, spacing } from '@/theme';
import { CrossIcon } from './CrossIcon';

type Props = { mode: 'study' | 'devotion' | 'open' };

// Placeholder body for each mode until chat/reader features land.
export function ModeScreen({ mode }: Props) {
  const { t, i18n } = useTranslation();
  const isAmharic = i18n.language === 'am';

  return (
    <View style={styles.root}>
      <View style={styles.watermark} pointerEvents="none">
        <CrossIcon size={160} color={colors.parchment} opacity={0.04} />
      </View>
      <View style={styles.card}>
        <Text style={[styles.label, isAmharic && styles.ethiopic]}>{t('app.name')}</Text>
        <Text style={[styles.title, isAmharic && styles.ethiopic]}>
          {t(`screens.${mode}.title`)}
        </Text>
        <Text style={[styles.body, isAmharic && styles.ethiopic]}>
          {t(`screens.${mode}.intro`)}
        </Text>
        <Text style={styles.soon}>{t('status.comingSoon')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, padding: spacing.lg },
  watermark: { position: 'absolute', right: spacing.lg, bottom: spacing.xl },
  card: {
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: colors.parchmentWash,
    borderLeftWidth: 2,
    borderLeftColor: colors.gold,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.gold,
    opacity: 0.8,
  },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.gold },
  body: { fontFamily: fonts.scripture, fontSize: 20, lineHeight: 30, color: colors.mist },
  soon: { fontFamily: fonts.ui, fontSize: 12, color: colors.parchmentDim, marginTop: spacing.sm },
  ethiopic: { fontFamily: fonts.ethiopic, letterSpacing: 0, textTransform: 'none' },
});
