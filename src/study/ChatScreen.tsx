import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { chatMessages, chatThreads, type ChatMessage } from '@/db';
import { useAuth } from '@/lib/auth';
import { parseSegments } from '@/scripture/refs';
import { useSync } from '@/sync/SyncProvider';
import { colors, fonts, spacing } from '@/theme';
import { ask, AskError, type AskErrorCode, type Mode } from './api';
import { ScriptureBlock } from './ScriptureBlock';

type Problem = AskErrorCode | 'refused' | null;

function AssistantText({ text }: { text: string }) {
  const { i18n } = useTranslation();
  const isAm = i18n.language === 'am';
  const segments = useMemo(() => parseSegments(text), [text]);
  return (
    <View>
      {segments.map((s, i) =>
        s.type === 'ref' ? (
          <ScriptureBlock key={i} segment={s} />
        ) : (
          s.text
            .split(/\n+/)
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p, j) => (
              <Text key={`${i}-${j}`} style={[styles.assistantText, isAm && styles.ethiopic]}>
                {p}
              </Text>
            ))
        ),
      )}
    </View>
  );
}

export function ChatScreen({ mode }: { mode: Mode }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { configured, loading, session } = useAuth();
  const { lastSyncedAt } = useSync();
  const language: 'en' | 'am' = i18n.language === 'am' ? 'am' : 'en';
  const isAm = language === 'am';

  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const scroller = useRef<ScrollView>(null);
  const busy = useRef(false);

  const loadThread = useCallback(async (id: string | null) => {
    if (!id) return setMessages([]);
    setMessages(await chatMessages.list({ thread_id: id }, { oldestFirst: true }));
  }, []);

  // Continue the latest conversation for this mode (newest first), if there is one.
  useEffect(() => {
    let active = true;
    (async () => {
      const threads = await chatThreads.list({ mode });
      if (!active) return;
      const id = threads[0]?.id ?? null;
      setThreadId(id);
      loadThread(id);
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [mode, loadThread]);

  // A sync can bring in messages from another device.
  useEffect(() => {
    if (!busy.current) loadThread(threadId).catch(() => {});
  }, [lastSyncedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length, sending]);

  const turns = (list: ChatMessage[]) => list.map((m) => ({ role: m.role, content: m.content }));

  /** Ask for a reply to the conversation as it stands (the last message is the user's). */
  const reply = async (id: string, history: ChatMessage[]) => {
    setSending(true);
    setProblem(null);
    try {
      const result = await ask(mode, language, turns(history));
      if (result.refused || !result.reply) {
        setProblem('refused');
      } else {
        await chatMessages.create({ thread_id: id, role: 'assistant', content: result.reply });
        await loadThread(id);
      }
    } catch (e) {
      setProblem(e instanceof AskError ? e.code : 'failed');
    } finally {
      setSending(false);
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy.current || !session) return;
    busy.current = true;
    try {
      const id = threadId ?? (await chatThreads.create({ mode, title: content.slice(0, 48) })).id;
      setThreadId(id);
      setInput('');
      await chatMessages.create({ thread_id: id, role: 'user', content });
      const history = await chatMessages.list({ thread_id: id }, { oldestFirst: true });
      setMessages(history);
      await reply(id, history);
    } finally {
      busy.current = false;
    }
  };

  const retry = async () => {
    if (!threadId || busy.current) return;
    busy.current = true;
    try {
      await reply(threadId, await chatMessages.list({ thread_id: threadId }, { oldestFirst: true }));
    } finally {
      busy.current = false;
    }
  };

  const startNew = () => {
    setThreadId(null);
    setMessages([]);
    setProblem(null);
  };

  // ---- not ready to chat yet
  if (!configured || (!loading && !session)) {
    return (
      <View style={styles.root}>
        <View style={styles.column}>
        <View style={styles.card}>
          <Text style={[styles.title, isAm && styles.ethiopic]}>{t(`screens.${mode}.title`)}</Text>
          <Text style={[styles.intro, isAm && styles.ethiopic]}>{t(`screens.${mode}.intro`)}</Text>
          <Text style={styles.small}>{configured ? t('chat.signInNeeded') : t('chat.notConfigured')}</Text>
          {configured && (
            <Pressable style={styles.primary} onPress={() => router.push('/account')} accessibilityRole="button">
              <Text style={styles.primaryText}>{t('chat.goToAccount')}</Text>
            </Pressable>
          )}
        </View>
        </View>
      </View>
    );
  }

  const empty = messages.length === 0;
  const lastIsUser = messages[messages.length - 1]?.role === 'user';

  return (
    <View style={styles.root}>
      <View style={styles.column}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, isAm && styles.ethiopic]}>{t(`screens.${mode}.title`)}</Text>
        {!empty && (
          <Pressable onPress={startNew} accessibilityRole="button" style={styles.ghost}>
            <Text style={styles.ghostText}>{t('chat.newChat')}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView ref={scroller} style={styles.scroll} contentContainerStyle={styles.thread}>
        {empty && (
          <View style={styles.card}>
            <Text style={[styles.intro, isAm && styles.ethiopic]}>{t(`screens.${mode}.intro`)}</Text>
            {mode === 'devotion' && (
              <Pressable
                style={styles.primary}
                onPress={() => send(t('chat.devotionPrompt'))}
                disabled={sending}
                accessibilityRole="button">
                <Text style={styles.primaryText}>{t('chat.beginDevotion')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={styles.userBubble}>
              <Text style={[styles.userText, isAm && styles.ethiopic]}>{m.content}</Text>
            </View>
          ) : (
            <View key={m.id} style={styles.assistantBubble}>
              <Text style={styles.label}>{t('app.name')}</Text>
              <AssistantText text={m.content} />
            </View>
          ),
        )}

        {sending && (
          <View style={styles.assistantBubble}>
            <ActivityIndicator color={colors.gold} />
          </View>
        )}

        {problem && (
          <View style={styles.problem}>
            <Text style={styles.problemText}>{t(`chat.errors.${problem}`)}</Text>
            {lastIsUser && problem !== 'quota' && problem !== 'not-configured' && (
              <Pressable onPress={retry} accessibilityRole="button" style={styles.ghost}>
                <Text style={styles.ghostText}>{t('chat.retry')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('chat.placeholder')}
          placeholderTextColor={colors.parchmentDim}
          multiline
          style={[styles.input, isAm && styles.ethiopic]}
          editable={!sending}
          onKeyPress={(e) => {
            const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
            if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
              (e as unknown as { preventDefault?: () => void }).preventDefault?.();
              send(input);
            }
          }}
        />
        <Pressable
          style={[styles.send, (!input.trim() || sending) && styles.disabled]}
          disabled={!input.trim() || sending}
          onPress={() => send(input)}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}>
          <Text style={styles.sendText}>{t('chat.send')}</Text>
        </Pressable>
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  column: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.gold },
  scroll: { flex: 1 },
  thread: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.parchmentWash, borderLeftWidth: 2, borderLeftColor: colors.gold, padding: spacing.lg, gap: spacing.md, margin: spacing.lg },
  intro: { fontFamily: fonts.scripture, fontSize: 20, lineHeight: 28, color: colors.mist },
  small: { fontFamily: fonts.ui, fontSize: 13, color: colors.parchmentDim },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: 'rgba(123,31,31,0.35)', borderWidth: 1, borderColor: 'rgba(139,58,58,0.4)', paddingVertical: 12, paddingHorizontal: 16, borderTopLeftRadius: 3, borderTopRightRadius: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 0 },
  userText: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 22, color: colors.parchment },
  assistantBubble: { alignSelf: 'flex-start', width: '100%', backgroundColor: colors.parchmentWash, borderLeftWidth: 2, borderLeftColor: colors.gold, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  label: { fontFamily: fonts.uiMedium, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.gold, opacity: 0.8, marginBottom: spacing.sm },
  assistantText: { fontFamily: fonts.ui, fontSize: 15, lineHeight: 24, color: 'rgba(245,237,216,0.9)', marginBottom: spacing.sm },
  problem: { backgroundColor: 'rgba(123,31,31,0.25)', borderLeftWidth: 2, borderLeftColor: colors.deepRed, padding: spacing.md, gap: spacing.sm },
  problemText: { fontFamily: fonts.ui, fontSize: 13, color: colors.mist },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.goldFaint },
  input: { flex: 1, minHeight: 46, maxHeight: 140, borderWidth: 1, borderColor: colors.goldBorder, borderRadius: 3, color: colors.parchment, fontFamily: fonts.ui, fontSize: 15, paddingVertical: 12, paddingHorizontal: 14 },
  send: { backgroundColor: colors.deepRed, borderRadius: 3, minHeight: 46, paddingHorizontal: spacing.md, justifyContent: 'center' },
  sendText: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.parchment },
  primary: { backgroundColor: colors.deepRed, borderRadius: 2, paddingVertical: 13, alignItems: 'center' },
  primaryText: { fontFamily: fonts.uiMedium, fontSize: 13, letterSpacing: 0.8, color: colors.parchment },
  ghost: { borderWidth: 1, borderColor: colors.goldBorder, borderRadius: 2, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-start' },
  ghostText: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.gold },
  disabled: { opacity: 0.4 },
  ethiopic: { fontFamily: fonts.ethiopic },
});
