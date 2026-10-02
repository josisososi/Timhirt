// Pure logic for the study-chat function: input checks and the prompts. No network, no
// Deno APIs, so it is unit tested (npm run test:ai). The deployable single file index.ts is
// generated from books.ts + logic.ts + handler.ts by scripts/build-edge-function.mjs.

export type Mode = 'study' | 'devotion' | 'open';
export type Language = 'en' | 'am';
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatRequest = { mode: Mode; language: Language; messages: ChatMessage[] };

export const LIMITS = {
  maxMessagesKept: 20, // older turns are dropped; the app stores the full history itself
  maxMessagesAccepted: 60,
  maxCharsPerMessage: 4000,
};

const MODES: Mode[] = ['study', 'devotion', 'open'];

export function validateRequest(
  body: unknown,
): { ok: true; value: ChatRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Request body must be JSON.' };
  const b = body as Record<string, unknown>;

  if (!MODES.includes(b.mode as Mode)) return { ok: false, error: 'Unknown mode.' };
  if (b.language !== 'en' && b.language !== 'am') return { ok: false, error: 'Unknown language.' };
  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { ok: false, error: 'No messages.' };
  }
  if (b.messages.length > LIMITS.maxMessagesAccepted) return { ok: false, error: 'Too many messages.' };

  const messages: ChatMessage[] = [];
  for (const m of b.messages) {
    if (typeof m !== 'object' || m === null) return { ok: false, error: 'Bad message.' };
    const { role, content } = m as Record<string, unknown>;
    if (role !== 'user' && role !== 'assistant') return { ok: false, error: 'Bad message role.' };
    if (typeof content !== 'string' || content.trim() === '') return { ok: false, error: 'Empty message.' };
    if (content.length > LIMITS.maxCharsPerMessage) return { ok: false, error: 'Message too long.' };
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== 'user') {
    return { ok: false, error: 'The last message must be from the user.' };
  }

  let kept = messages.slice(-LIMITS.maxMessagesKept);
  while (kept.length > 1 && kept[0].role !== 'user') kept = kept.slice(1); // always start on the user's turn
  return { ok: true, value: { mode: b.mode as Mode, language: b.language, messages: kept } };
}

/** Thinking depth per mode: a short devotion needs less than a close study. */
export const effortFor = (mode: Mode): 'low' | 'medium' => (mode === 'devotion' ? 'low' : 'medium');

const MODE_PROMPTS: Record<Mode, string> = {
  study: `You are leading a Bible study with the user, passage by passage, with depth and reverence.
- Open by asking what passage or theme they want to explore, or suggest one that fits the Ethiopian liturgical seasons.
- Bring the passage in with a reference tag, then unpack it: historical context, theological weight, and what the Ethiopian and Alexandrian tradition says (for example St. Yared, Abba Salama, Cyril of Alexandria). Only attribute a view to a named Father when you are confident; otherwise say "tradition holds".
- Mention the Ge'ez tradition and the Kebra Nagast only where they truly illuminate the text.
- Ask one probing question per reply to push the understanding deeper.
- Be direct, warm and spiritually serious, not performatively religious. Go deep on one thing rather than shallow on many. Keep replies focused.`,
  devotion: `You are a devotional companion in the Ethiopian Orthodox Tewahedo tradition. The user wants a moment of spiritual grounding, not deep study: an encounter with God through Scripture and prayer.
- Begin with one short scripture, given as a reference tag.
- Offer a brief, honest reflection of 3-5 sentences that goes somewhere real, not generic.
- End with a short prayer in the spirit of Ethiopian Orthodox prayer: addressed to God through Christ, invoking the Holy Spirit, with reverence for Mary as Theotokos where fitting.
- Keep the whole reply under 250 words. Speak from abundance, not fear: God's presence is given, not earned. Mention the church calendar only if a feast or fast is near.`,
  open: `You are a spiritually grounded conversation partner. The user can bring anything: questions about faith, doubts, life decisions, theology.
- Think with them, not just at them. Engage honestly, including hard questions about doubt and tension.
- Bring Scripture in naturally with reference tags, not artificially.
- Hold the Ethiopian Orthodox tradition with pride and nuance: its age, its independence, its distinct theology (miaphysite Christology, the full 81-book canon).
- Do not pretend certainty where there is none. Be a peer in the conversation, not a religious authority performing piety.`,
};

export function buildSystemPrompt(mode: Mode, language: Language, bookNames: string[]): string {
  const reply =
    language === 'am'
      ? "Reply in Amharic, written in Ge'ez script. Keep the book names inside [[...]] tags in English exactly as listed."
      : 'Reply in English.';

  return `You are Timhirt ("teaching" in Amharic), a Bible study companion rooted in the Ethiopian Orthodox Tewahedo tradition, one of the oldest continuous Christian traditions, with an 81-book canon that includes Enoch, Jubilees, the three books of Meqabyan and the full deuterocanon.

SCRIPTURE RULES (strict):
- Never write out the text of a verse yourself, and never put verse text in quotation marks. To bring a passage in, put a reference tag on its own line, such as [[John 3:16]], [[Romans 8:28-30]] or [[Psalms 23]]. The app replaces each tag with the real text.
- Inside a tag use exactly these book names: ${bookNames.join(', ')}.
- Only cite a passage when you are confident it exists and says what you claim. If you are unsure of an exact chapter or verse, say so plainly instead of guessing.
- Keep commentary clearly separate from Scripture, and never invent a quotation from a church father.

STYLE:
- ${reply}
- Plain text only: no markdown headings, bullet symbols or bold. Short paragraphs.

YOUR ROLE:
${MODE_PROMPTS[mode]}`;
}
