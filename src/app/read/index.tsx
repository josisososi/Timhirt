import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { availability, books, hasScriptureData, type BookMeta } from '@/scripture';
import { colors, fonts, spacing } from '@/theme';

function BookRow({ book }: { book: BookMeta }) {
  const { i18n } = useTranslation();
  const isAm = i18n.language === 'am';
  const a = availability(book.id);
  const name = (isAm && book.name_am) || book.name_en;
  const ready = a.en || a.am;

  return (
    <Link href={{ pathname: '/read/[book]', params: { book: book.id } }} asChild>
      <Pressable
        style={StyleSheet.flatten([styles.row, !ready && styles.rowDim])}
        accessibilityRole="button">
        <Text style={styles.order}>{book.canon_order}</Text>
        <View style={styles.rowText}>
          <Text style={styles.name}>{name}</Text>
          {book.name_alt ? <Text style={styles.alt}>{book.name_alt}</Text> : null}
        </View>
        <View style={styles.badges}>
          <Text style={[styles.badge, a.en ? styles.badgeOn : styles.badgeOff]}>EN</Text>
          <Text style={[styles.badge, a.am ? styles.badgeOn : styles.badgeOff]}>አማ</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function BookList() {
  const { t, i18n } = useTranslation();
  const isAm = i18n.language === 'am';
  const ot = books.filter((b) => b.testament === 'OT');
  const nt = books.filter((b) => b.testament === 'NT');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={[styles.title, isAm && styles.ethiopic]}>{t('reader.title')}</Text>
      {!hasScriptureData && <Text style={styles.warning}>{t('reader.noData')}</Text>}

      <Text style={[styles.section, isAm && styles.ethiopic]}>
        {t('reader.oldTestament')} · {ot.length}
      </Text>
      {ot.map((b) => (
        <BookRow key={b.id} book={b} />
      ))}

      <Text style={[styles.section, isAm && styles.ethiopic]}>
        {t('reader.newTestament')} · {nt.length}
      </Text>
      {nt.map((b) => (
        <BookRow key={b.id} book={b} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 32, color: colors.gold, marginBottom: spacing.md },
  warning: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.mist,
    backgroundColor: colors.parchmentWash,
    borderLeftWidth: 2,
    borderLeftColor: colors.deepRed,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  section: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.gold,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.goldFaint,
  },
  rowDim: { opacity: 0.45 },
  order: { width: 26, fontFamily: fonts.ui, fontSize: 12, color: colors.parchmentDim },
  rowText: { flex: 1 },
  name: { fontFamily: fonts.scripture, fontSize: 20, color: colors.mist },
  alt: { fontFamily: fonts.ui, fontSize: 11, color: colors.parchmentDim },
  badges: { flexDirection: 'row', gap: 6 },
  badge: {
    fontFamily: fonts.ethiopic,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 2,
  },
  badgeOn: { color: colors.gold, borderColor: colors.goldBorder },
  badgeOff: { color: colors.parchmentDim, borderColor: 'transparent', opacity: 0.4 },
  ethiopic: { fontFamily: fonts.ethiopic, letterSpacing: 0, textTransform: 'none' },
});
