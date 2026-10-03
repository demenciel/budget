import {
  exportCalendar,
  getMember,
  handleAction,
  HttpError,
  loadNotebook,
  type Database,
  type Identity,
} from './service.ts';
import {
  createApiKey,
  identityFromApiKey,
  listApiKeys,
  revokeApiKey,
} from './api-keys.ts';

const noCache = {
  'Cache-Control': 'private, no-store, max-age=0',
  Vary: 'Authorization, Cookie',
  'X-Content-Type-Options': 'nosniff',
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: noCache });

async function readJson(request: Request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    throw new HttpError('Expected JSON.', 415);
  const text = await request.text();
  if (text.length > 16000) throw new HttpError('Request is too large.', 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new HttpError('Invalid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new HttpError('Invalid request.');
  return body as Record<string, unknown>;
}

function errorResponse(error: unknown, operation: string) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof Error && /UNIQUE constraint/i.test(error.message))
    return json(
      { error: 'This item already exists. Refresh and try again.' },
      409,
    );
  if (error instanceof Error && !/D1_|SQLITE|database|SQL/i.test(error.message))
    return json({ error: error.message }, 400);
  console.error(`${operation} failed`, error);
  return json({ error: 'The request could not be completed.' }, 500);
}

export async function handleKeyManagementRequest(
  request: Request,
  db: Database,
  user: Identity | null,
) {
  if (!user) return json({ error: 'Please sign in.' }, 401);
  try {
    if (request.method === 'GET')
      return json({ keys: await listApiKeys(db, user) });
    if (!['POST', 'DELETE'].includes(request.method))
      return json({ error: 'Method not allowed.' }, 405);
    if (
      request.headers.get('Origin') !== new URL(request.url).origin ||
      request.headers.get('X-Notebook') !== '1'
    )
      throw new HttpError('Request origin could not be verified.', 403);
    const body = await readJson(request);
    if (request.method === 'POST')
      return json(await createApiKey(db, user, body.name), 201);
    return json(await revokeApiKey(db, user, body.id));
  } catch (error) {
    return errorResponse(error, 'API key management');
  }
}

export async function handleApiRequest(request: Request, db: Database) {
  try {
    const user = await identityFromApiKey(
      db,
      request.headers.get('Authorization'),
    );
    if (!user) return json({ error: 'A valid API key is required.' }, 401);
    const member = await getMember(db, user);
    if (!member) return json({ error: 'Member not found.' }, 401);
    if (request.method === 'GET') {
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
            'Content-Disposition':
              'attachment; filename="together-calendar.ics"',
          },
        });
      }
      return json(await loadNotebook(db, member));
    }
    if (request.method !== 'POST')
      return json({ error: 'Method not allowed.' }, 405);
    return json(await handleAction(db, user, await readJson(request)));
  } catch (error) {
    return errorResponse(error, 'API request');
  }
}
