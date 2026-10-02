import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { bookmarks } from '@/db';
import { useSync } from '@/sync/SyncProvider';
import {
  availability,
  bookById,
  chapterNumbers,
  loadBook,
  verseKeys,
  type Language,
} from '@/scripture';
import { colors, fonts, spacing } from '@/theme';

export default function BookReader() {
  const { book: bookId } = useLocalSearchParams<{ book: string }>();
  const { t, i18n } = useTranslation();
  const meta = bookById(String(bookId));
  const avail = availability(String(bookId));
  const data = useMemo(() => loadBook(String(bookId)), [bookId]);

  // Start in the app language when that text exists, otherwise in the other one.
  const preferred: Language = i18n.language === 'am' ? 'am' : 'en';
  const [lang, setLang] = useState<Language>(preferred);
  useEffect(() => {
    setLang(preferred === 'am' && avail.am ? 'am' : avail.en ? 'en' : 'am');
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [chapter, setChapter] = useState(1);
  const sync = useSync();

  // verse number -> bookmark id, for the chapter on screen
  const [marks, setMarks] = useState<Record<number, string>>({});
  const loadMarks = useCallback(async () => {
    try {
      const rows = await bookmarks.list({ book_id: String(bookId), chapter });
      setMarks(Object.fromEntries(rows.map((b) => [b.verse, b.id])));
    } catch {
      /* storage not ready */
    }
  }, [bookId, chapter]);
  useEffect(() => {
    loadMarks();
  }, [loadMarks, sync.lastSyncedAt]); // reload after a sync brings in bookmarks from another device

  const toggleMark = async (verse: number) => {
    if (marks[verse]) await bookmarks.remove(marks[verse]);
    else await bookmarks.create({ book_id: String(bookId), chapter, verse, label: null });
    loadMarks();
  };
  const text = data?.[lang] ?? null;
  const chapters = text ? chapterNumbers(text) : [];
  const verses = text?.[String(chapter)] ?? null;
  const isAm = lang === 'am';

  useEffect(() => {
    if (text && !text[String(chapter)] && chapters.length) setChapter(chapters[0]);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!meta) return null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Link href="/read" style={styles.back}>
        ← {t('reader.title')}
      </Link>
      <Text style={styles.title}>{meta.name_en}</Text>
      {meta.name_alt ? <Text style={styles.alt}>{meta.name_alt}</Text> : null}

      <View style={styles.langRow}>
        {(['en', 'am'] as Language[]).map((l) => (
          <Pressable
            key={l}
            disabled={!avail[l]}
            onPress={() => setLang(l)}
            style={[styles.langBtn, lang === l && styles.langBtnOn, !avail[l] && styles.dim]}>
            <Text style={[styles.langText, lang === l && styles.langTextOn]}>
              {l === 'en' ? t('reader.english') : t('reader.amharic')}
            </Text>
          </Pressable>
        ))}
      </View>

      {!text ? (
        <Text style={styles.note}>{t('reader.notAvailable')}</Text>
      ) : (
        <>
          {isAm && <Text style={styles.note}>{t('reader.amharicNote')}</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {chapters.map((c) => (
              <Pressable
                key={c}
                onPress={() => setChapter(c)}
                style={[styles.chip, c === chapter && styles.chipOn]}>
                <Text style={[styles.chipText, c === chapter && styles.chipTextOn]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.chapterTitle}>
            {t('reader.chapter')} {chapter}
          </Text>
          {verses &&
            verseKeys(verses).map((k) => (
              <View key={k} style={styles.verse}>
                {k !== '0' && (
                  <Pressable
                    onPress={() => toggleMark(parseInt(k, 10))}
                    accessibilityRole="button"
                    accessibilityLabel={t('reader.bookmark')}
                    hitSlop={8}
                    style={styles.numBtn}>
                    <Text style={[styles.num, marks[parseInt(k, 10)] ? styles.numMarked : null]}>
                      {marks[parseInt(k, 10)] ? '★ ' : ''}
                      {k}
                    </Text>
                  </Pressable>
                )}
                <Text style={[styles.verseText, isAm && styles.ethiopic, k === '0' && styles.psalmTitle]}>
                  {verses[k]}
                </Text>
              </View>
            ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  content: { padding: spacing.lg, maxWidth: 760, width: '100%', alignSelf: 'center', paddingBottom: 64 },
  back: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.gold, marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.gold },
  alt: { fontFamily: fonts.ui, fontSize: 12, color: colors.parchmentDim, marginBottom: spacing.sm },
  langRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  langBtn: { borderWidth: 1, borderColor: colors.goldBorder, borderRadius: 2, paddingVertical: 5, paddingHorizontal: 12 },
  langBtnOn: { backgroundColor: colors.goldWash, borderColor: colors.gold },
  langText: { fontFamily: fonts.ethiopic, fontSize: 13, color: colors.parchmentDim },
  langTextOn: { color: colors.gold },
  dim: { opacity: 0.3 },
  note: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.mist,
    backgroundColor: colors.parchmentWash,
    borderLeftWidth: 2,
    borderLeftColor: colors.deepRed,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chips: { marginBottom: spacing.md, flexGrow: 0 },
  chip: { minWidth: 38, alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, marginRight: 6, borderWidth: 1, borderColor: colors.goldFaint, borderRadius: 2 },
  chipOn: { backgroundColor: colors.deepRed, borderColor: colors.gold },
  chipText: { fontFamily: fonts.ui, fontSize: 13, color: colors.parchmentDim },
  chipTextOn: { color: colors.parchment },
  chapterTitle: { fontFamily: fonts.display, fontSize: 24, color: colors.gold, marginBottom: spacing.md },
  verse: { flexDirection: 'row', gap: spacing.sm, marginBottom: 10 },
  numBtn: { width: 44, paddingTop: 6 },
  num: { fontFamily: fonts.ui, fontSize: 11, color: colors.gold, textAlign: 'right' },
  numMarked: { fontFamily: fonts.uiMedium, color: colors.parchment },
  verseText: { flex: 1, fontFamily: fonts.scripture, fontSize: 20, lineHeight: 30, color: colors.mist },
  psalmTitle: { fontStyle: 'italic', color: colors.parchmentDim },
  ethiopic: { fontFamily: fonts.ethiopic, fontSize: 18, lineHeight: 30 },
});
