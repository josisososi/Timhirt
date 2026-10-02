import { supabase } from '../lib/supabase';

export type Mode = 'study' | 'devotion' | 'open';
export type Turn = { role: 'user' | 'assistant'; content: string };

export type AskErrorCode =
  | 'not-configured' // the app has no Supabase keys, or the function has no Anthropic key yet
  | 'auth' // not signed in
  | 'quota' // today's limit reached
  | 'busy' // the AI service is rate limiting
  | 'offline' // cannot reach the server
  | 'failed'; // anything else

export class AskError extends Error {
  constructor(public code: AskErrorCode) {
    super(code);
  }
}

/** Ask the study-chat function (which holds the Anthropic key) for the next reply. */
export async function ask(
  mode: Mode,
  language: 'en' | 'am',
  messages: Turn[],
): Promise<{ reply: string; refused: boolean }> {
  if (!supabase) throw new AskError('not-configured');

  const { data, error } = await supabase.functions.invoke('study-chat', {
    body: { mode, language, messages },
  });

  if (error) {
    // supabase-js puts the function's JSON error body on error.context (a Response).
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === 'function') {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (body.error === 'quota') throw new AskError('quota');
      if (body.error === 'auth') throw new AskError('auth');
      if (body.error === 'busy') throw new AskError('busy');
      if (body.error === 'not-configured') throw new AskError('not-configured');
      throw new AskError('failed');
    }
    throw new AskError('offline'); // the request never got an answer
  }

  const result = data as { reply?: string; refused?: boolean };
  return { reply: result.reply ?? '', refused: Boolean(result.refused) };
}
