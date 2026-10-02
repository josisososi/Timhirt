// Network part of the study-chat function. Runs on Supabase (Deno). The Anthropic key lives only
// in the function's secrets and never reaches the app. Deployed as the single file index.ts.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { BOOK_NAMES } from './books.ts';
import { buildSystemPrompt, effortFor, validateRequest } from './logic.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '60');
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5-5';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  // Who is asking: the signed-in user's own token, checked by Supabase.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'auth' }, 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad-request', detail: 'Body must be JSON.' }, 400);
  }
  const parsed = validateRequest(body);
  if (!parsed.ok) return json({ error: 'bad-request', detail: parsed.error }, 400);
  const { mode, language, messages } = parsed.value;

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not-configured' }, 503);

  // Daily cap per account, enforced in the database.
  const { data: allowed, error: quotaError } = await supabase.rpc('consume_ai_quota', {
    max_per_day: DAILY_LIMIT,
  });
  if (quotaError) return json({ error: 'quota-check-failed' }, 500);
  if (!allowed) return json({ error: 'quota' }, 429);

  const client = new Anthropic({ apiKey });
  const request = {
    model: MODEL,
    max_tokens: 8000,
    system: buildSystemPrompt(mode, language, BOOK_NAMES),
    messages,
    output_config: { effort: effortFor(mode) },
  };

  try {
    // Opt in to server-side refusal fallback; if the API rejects the option, retry plainly.
    let message;
    try {
      // deno-lint-ignore no-explicit-any
      message = await client.beta.messages.create({
        ...request,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        // deno-lint-ignore no-explicit-any
      } as any);
    } catch (e) {
      if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
        // deno-lint-ignore no-explicit-any
        message = await client.messages.create(request as any);
      } else {
        throw e;
      }
    }

    if (message.stop_reason === 'refusal') return json({ refused: true, reply: '' });
    const reply = message.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('\n')
      .trim();
    if (!reply) return json({ error: 'empty' }, 502);
    return json({ reply });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'ai-auth' }, 502);
    if (e instanceof Anthropic.APIError) return json({ error: 'ai-error', status: e.status }, 502);
    return json({ error: 'unknown' }, 500);
  }
});
