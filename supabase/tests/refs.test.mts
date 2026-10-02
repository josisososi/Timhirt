// Tests for turning [[Book C:V]] tags in AI replies into real references. Run: npm run test:refs
import canon from '../../src/data/canon.json' with { type: 'json' };
import { parseSegments, resolveBook, tagNames, verseSlice } from '../../src/scripture/refs';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) failures++;
};
const refs = (s: string) => parseSegments(s).filter((x) => x.type === 'ref');

// every one of the 81 books can be cited by the name we tell the model to use
const unresolved = tagNames.filter((n, i) => resolveBook(n, 1) !== canon[i].id && !['Proverbs'].includes(n));
check('all 81 tag names resolve to their own book', unresolved.length === 0, unresolved.join(', '));
check('81 tag names are unique', new Set(tagNames).size === 81);

// parsing
let seg = parseSegments('He said [[John 3:16]] and also [[Psalms 23]].');
check('splits text and references', seg.length === 5 && seg[0].type === 'text' && seg[1].type === 'ref' && seg[4].type === 'text');
check('verse reference', (refs('[[John 3:16]]')[0] as any).bookId === 'john' && (refs('[[John 3:16]]')[0] as any).from === 16);
check('verse range', (() => { const r: any = refs('[[Romans 8:28-30]]')[0]; return r.from === 28 && r.to === 30; })());
check('whole chapter', (() => { const r: any = refs('[[Psalms 23]]')[0]; return r.from === null && r.chapter === 23; })());
check('numbered books', (refs('[[1 Samuel 17:45]]')[0] as any).bookId === '1-samuel' && (refs('[[2 Corinthians 5:17]]')[0] as any).bookId === '2-corinthians');
check('Ethiopian canon books', (refs('[[1 Meqabyan 2:1]]')[0] as any).bookId === '1-meqabyan' && (refs('[[Enoch 1:9]]')[0] as any).bookId === 'enoch' && (refs('[[Jubilees 2:1]]')[0] as any).bookId === 'jubilees');
check('Proverbs splits into Messale and Tagsas', (refs('[[Proverbs 3:5]]')[0] as any).bookId === 'messale' && (refs('[[Proverbs 26:4]]')[0] as any).bookId === 'tagsas');
check('common alternate names', (refs('[[Psalm 23:1]]')[0] as any).bookId === 'psalms' && (refs('[[Song of Solomon 2:1]]')[0] as any).bookId === 'song-of-songs' && (refs('[[Ecclesiasticus 1:1]]')[0] as any).bookId === 'sirach');
check('roman numeral prefix', (refs('[[II Kings 5:1]]')[0] as any).bookId === '2-kings');
check('case and spacing are forgiven', (refs('[[ john   3:16 ]]')[0] as any)?.bookId === 'john');
check('en dash range', (refs('[[John 3:16–18]]')[0] as any).to === 18);

// bad input never breaks rendering
seg = parseSegments('See [[Hezekiah 4:4]] and [[nonsense]] ok');
check('unknown references stay as plain text', refs('[[Hezekiah 4:4]]').length === 0 && seg.map((s: any) => s.text ?? '').join('').includes('Hezekiah 4:4'));
check('no brackets leak into text', !JSON.stringify(seg).includes('[['));
check('text without tags is untouched', parseSegments('plain words').length === 1);
check('empty string gives no segments', parseSegments('').length === 0);
check('a backwards range is corrected', (() => { const r: any = refs('[[John 3:18-16]]')[0]; return r.to === 18 || r.to === r.from; })());

// slicing real chapter data (English keys, plus Amharic printed ranges)
const ch = { '1': 'a', '2': 'b', '3': 'c', '4': 'd' };
check('slice single verse', verseSlice(ch, 2, 2).map((v) => v.key).join() === '2');
check('slice range', verseSlice(ch, 2, 3).map((v) => v.key).join() === '2,3');
check('slice whole chapter', verseSlice(ch, null, null).length === 4);
const am = { '0': 'title', '1-2': 'ab', '3': 'c', '4-5': 'de' };
check('printed ranges match any verse inside them', verseSlice(am, 2, 2).map((v) => v.key).join() === '1-2' && verseSlice(am, 5, 5).map((v) => v.key).join() === '4-5');
check('psalm title is not a verse', !verseSlice(am, null, null).some((v) => v.key === '0'));
check('very long chapters are capped', verseSlice(Object.fromEntries(Array.from({ length: 200 }, (_, i) => [String(i + 1), 'x'])), null, null).length === 30);

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll reference checks passed');
process.exit(failures ? 1 : 0);
