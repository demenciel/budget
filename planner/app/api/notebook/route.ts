import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import {
  getMember,
  loadNotebook,
  handleAction,
  exportCalendar,
  HttpError,
  type Database,
} from '@/lib/service';
export const dynamic = 'force-dynamic';
const noCache = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Cookie',
  'X-Content-Type-Options': 'nosniff',
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: noCache });
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user)
      return json(
        { error: 'Please sign in to open your notebook.', needsAuth: true },
        401,
      );
    const db = env.DB as unknown as Database;
    const member = await getMember(db, user);
    if (!member) return json({ needsSetup: true, name: user.fullName ?? '' });
    const url = new URL(request.url);
    if (url.searchParams.get('export') === 'calendar') {
      const content = await exportCalendar(
        db,
        member,
        url.searchParams.get('scope') ?? 'shared',
      );
      return new Response(content, {
        headers: {
          ...noCache,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="together-calendar.ics"',
        },
      });
    }
    return json(await loadNotebook(db, member));
  } catch (error) {
    console.error('Notebook read failed', error);
    return json(
      { error: 'Your notebook could not be loaded. Please try again.' },
      500,
    );
  }
}
export async function POST(request: Request) {
  if (
    request.headers.get('Origin') !== new URL(request.url).origin ||
    request.headers.get('X-Notebook') !== '1'
  )
    return json({ error: 'Request origin could not be verified.' }, 403);
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    return json({ error: 'Expected JSON.' }, 415);
  const user = await getChatGPTUser();
  if (!user) return json({ error: 'Please sign in again.' }, 401);
  try {
    const text = await request.text();
    if (text.length > 16000)
      return json({ error: 'Request is too large.' }, 413);
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      return json({ error: 'Invalid request.' }, 400);
    return json(await handleAction(env.DB as unknown as Database, user, body));
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof Error && /UNIQUE constraint/i.test(error.message))
      return json(
        {
          error:
            'This item already exists, this payment was already recorded, or the household is full. Refresh and try again.',
        },
        409,
      );
    if (
      error instanceof Error &&
      !/D1_|SQLITE|database|SQL/i.test(error.message)
    )
      return json({ error: error.message }, 400);
    console.error('Notebook write failed', error);
    return json(
      { error: 'We could not save that change. Please try again.' },
      500,
    );
  }
}
