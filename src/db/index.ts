import { driver } from './driver';
import { recordStore, type Base } from './records';

type Ref = { book_id: string; chapter: number; verse_start: number; verse_end: number };

export type Note = Base & Ref & { body: string };
export type Highlight = Base & Ref & { color: string };
export type Bookmark = Base & {
  book_id: string;
  chapter: number;
  verse: number;
  label: string | null;
};
export type ChatMode = 'study' | 'devotion' | 'open';
export type ChatThread = Base & { mode: ChatMode; title: string | null };
export type ChatMessage = Base & {
  thread_id: string;
  role: 'user' | 'assistant';
  content: string;
};

const refCols = ['book_id', 'chapter', 'verse_start', 'verse_end'] as const;

export const notes = recordStore<Note>('notes', [...refCols, 'body']);
export const highlights = recordStore<Highlight>('highlights', [...refCols, 'color']);
export const bookmarks = recordStore<Bookmark>('bookmarks', [
  'book_id',
  'chapter',
  'verse',
  'label',
]);
export const chatThreads = recordStore<ChatThread>('chat_threads', ['mode', 'title']);
export const chatMessages = recordStore<ChatMessage>('chat_messages', [
  'thread_id',
  'role',
  'content',
]);

/** Device-local preferences (language, last mode, ...). Not synced. */
export const settings = {
  get: (key: string) => driver.getSetting(key),
  set: (key: string, value: string) => driver.setSetting(key, value),
};

/** Records waiting to be pushed to Supabase (used by the sync phase). */
export const pendingSyncCount = () => driver.dirtyCount();

// Dev-only handle so the data layer can be poked from the browser console.
if (__DEV__) {
  (globalThis as Record<string, unknown>).__timhirt = {
    notes,
    highlights,
    bookmarks,
    chatThreads,
    chatMessages,
    settings,
    pendingSyncCount,
  };
}