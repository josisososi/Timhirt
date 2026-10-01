import canonJson from '../data/canon.json';

export type Testament = 'OT' | 'NT';
export type BookMeta = {
  id: string;
  canon_order: number;
  testament: Testament;
  name_en: string;
  name_alt: string | null;
  name_am: string | null;
};
export type Language = 'en' | 'am';
/** chapter -> verse key -> text. A verse key can be a range ("3-4"); "0" is a psalm title. */
export type Chapters = Record<string, Record<string, string>>;
export type BookText = { id: string; en: Chapters | null; am: Chapters | null };

/** The 81-book Ethiopian Orthodox Tewahedo canon, in canonical order. */
export const books = canonJson as BookMeta[];

type Generated = {
  loaders: Record<string, () => unknown>;
  availability: Record<string, { en: boolean; am: boolean }>;
};

// The text files are generated locally (scripts/export_scripture.py) and are not in git,
// so this must keep working when they are missing.
let generated: Generated | null = null;
try {
  generated = require('./generated') as Generated;
} catch {
  generated = null;
}

export const hasScriptureData = generated !== null;

export function availability(id: string): { en: boolean; am: boolean } {
  return generated?.availability[id] ?? { en: false, am: false };
}

export function loadBook(id: string): BookText | null {
  const loader = generated?.loaders[id];
  return loader ? (loader() as BookText) : null;
}

export const bookById = (id: string) => books.find((b) => b.id === id);

export const chapterNumbers = (chapters: Chapters) =>
  Object.keys(chapters)
    .map(Number)
    .sort((a, b) => a - b);

/** Verse keys of a chapter in reading order (the psalm title, "0", first). */
export const verseKeys = (verses: Record<string, string>) =>
  Object.keys(verses).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
