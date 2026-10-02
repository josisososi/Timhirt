import canonJson from '../data/canon.json';

/**
 * Scripture references in AI replies. The model never writes verse text: it writes a tag like
 * [[John 3:16]] or [[Psalms 23]], and the app replaces it with the real text from the local
 * scripture data. Pure logic, no UI, so it can be tested on its own.
 */

type CanonBook = { id: string; tag_name: string; name_en: string; name_alt: string | null };
const books = canonJson as CanonBook[];

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/^\s*iii\s+/, '3 ')
    .replace(/^\s*ii\s+/, '2 ')
    .replace(/^\s*i\s+/, '1 ')
    .replace(/[^a-z0-9]/g, '');

const byName = new Map<string, string>();
for (const b of books) {
  byName.set(norm(b.tag_name), b.id);
  byName.set(norm(b.name_en), b.id);
  if (b.name_alt) byName.set(norm(b.name_alt), b.id);
}
const ALIASES: Record<string, string> = {
  psalm: 'psalms',
  songofsolomon: 'song-of-songs',
  songofsong: 'song-of-songs',
  canticles: 'song-of-songs',
  ecclesiasticus: 'sirach',
  wisdomofsirach: 'sirach',
  '1enoch': 'enoch',
  revelationofjohn: 'revelation',
  revelations: 'revelation',
  apocalypse: 'revelation',
  actsoftheapostles: 'acts',
  '1esdras': '3-ezra',
  ezrakali: '3-ezra',
  '2esdras': '4-ezra',
  ezrasutuel: '4-ezra',
  ezra: '1-ezra',
};

/** Resolve a book name as the model may write it. Proverbs splits into Messale (1-24) and Tagsas (25-31). */
export function resolveBook(name: string, chapter: number): string | null {
  const key = norm(name);
  if (key === 'proverbs') return chapter >= 25 ? 'tagsas' : 'messale';
  return byName.get(key) ?? ALIASES[key] ?? null;
}

export type Segment =
  | { type: 'text'; text: string }
  | { type: 'ref'; raw: string; bookId: string; chapter: number; from: number | null; to: number | null };

const TAG = /\[\[\s*([^\]]+?)\s*\]\]/g;
const REF = /^(.+?)\s+(\d{1,3})(?::\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/;

/** Split a reply into plain text and resolved scripture references. Unknown references stay as text. */
export function parseSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ type: 'text', text: text.slice(last, start) });
    last = start + m[0].length;

    const parsed = REF.exec(m[1]);
    const chapter = parsed ? Number(parsed[2]) : NaN;
    const bookId = parsed ? resolveBook(parsed[1], chapter) : null;
    if (parsed && bookId && chapter >= 1) {
      const from = parsed[3] ? Number(parsed[3]) : null;
      let to = parsed[4] ? Number(parsed[4]) : from;
      if (from !== null && to !== null && to < from) to = from;
      out.push({ type: 'ref', raw: m[1], bookId, chapter, from, to });
    } else {
      out.push({ type: 'text', text: m[1] }); // keep what the model wrote, without the brackets
    }
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out;
}

/** The verses of a chapter covered by from..to (whole chapter when from is null), in order. */
export function verseSlice(
  verses: Record<string, string>,
  from: number | null,
  to: number | null,
  maxVerses = 30,
): { key: string; text: string }[] {
  const picked = Object.keys(verses)
    .filter((k) => k !== '0')
    .map((k) => {
      const [a, b] = k.split('-').map(Number);
      return { key: k, start: a, end: b ?? a };
    })
    .filter((v) => from === null || (v.end >= from && v.start <= (to ?? from)))
    .sort((x, y) => x.start - y.start)
    .slice(0, maxVerses);
  return picked.map((v) => ({ key: v.key, text: verses[v.key] }));
}

/** The names the AI is told to use inside [[...]] tags, in canon order. */
export const tagNames = books.map((b) => b.tag_name);
