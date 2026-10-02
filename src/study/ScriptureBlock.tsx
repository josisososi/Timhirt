import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { bookById, chapterNumbers, loadBook, type Language } from '@/scripture';
import { verseSlice, type Segment } from '@/scripture/refs';
import { colors, fonts, spacing } from '@/theme';

type RefSegment = Extract<Segment, { type: 'ref' }>;

/**
 * A scripture quote. The words always come from the local scripture data, never from the AI.
 * If that text is not on this device, it says so instead of showing anything made up.
 */
export function ScriptureBlock({ segment }: { segment: RefSegment }) {
  const { t, i18n } = useTranslation();
  const preferred: Language = i18n.language === 'am' ? 'am' : 'en';
  const book = bookById(segment.bookId);

  const found = useMemo(() => {
    const data = loadBook(segment.bookId);
    if (!data) return null;
    for (const lang of [preferred, preferred === 'am' ? 'en' : 'am'] as Language[]) {
      const chapters = data[lang];
      const verses = chapters?.[String(segment.chapter)];
      if (!verses) continue;
      const slice = verseSlice(verses, segment.from, segment.to);
      if (slice.length) return { lang, slice, hasChapter: chapterNumbers(chapters).length > 0 };
    }
    return null;
  }, [segment, preferred]);

  const label = `${book?.name_en ?? segment.raw} ${segment.chapter}${
    segment.from !== null ? `:${segment.from}${segment.to && segment.to !== segment.from ? `–${segment.to}` : ''}` : ''
  }`;
  const isAm = found?.lang === 'am';

  return (
    <View style={styles.block}>
      <Text style={styles.ref}>{label}</Text>
      {found ? (
        found.slice.map((v) => (
          <Text key={v.key} style={[styles.verse, isAm && styles.ethiopic]}>
            <Text style={styles.num}>{v.key} </Text>
            {v.text}
          </Text>
        ))
      ) : (
        <Text style={styles.missing}>{t('chat.verseUnavailable')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginVertical: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.goldWash,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: 2,
  },
  ref: { fontFamily: fonts.scripture, fontStyle: 'italic', fontSize: 17, color: colors.gold, marginBottom: 6 },
  verse: { fontFamily: fonts.scripture, fontSize: 18, lineHeight: 27, color: colors.mist },
  num: { fontFamily: fonts.ui, fontSize: 10, color: colors.gold },
  missing: { fontFamily: fonts.ui, fontSize: 12, color: colors.parchmentDim },
  ethiopic: { fontFamily: fonts.ethiopic, fontSize: 16, lineHeight: 27 },
});
