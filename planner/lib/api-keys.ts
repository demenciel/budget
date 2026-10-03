import {
  getMember,
  HttpError,
  type Database,
  type Identity,
} from './service.ts';

const KEY_PATTERN = /^tb_[a-f0-9]{64}$/;
const keyId = () => crypto.randomUUID();

async function sha256(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export type ApiKeyInfo = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export async function listApiKeys(db: Database, user: Identity) {
  const member = await getMember(db, user);
  if (!member) throw new HttpError('Set up your household first.', 403);
  return (
    await db
      .prepare(
        'SELECT id,name,prefix,created_at,last_used_at FROM api_keys WHERE member_id=? ORDER BY created_at DESC',
      )
      .bind(member.id)
      .all<ApiKeyInfo>()
  ).results;
}

export async function createApiKey(
  db: Database,
  user: Identity,
  nameValue: unknown,
) {
  const member = await getMember(db, user);
  if (!member) throw new HttpError('Set up your household first.', 403);
  const name = typeof nameValue === 'string' ? nameValue.trim() : '';
  if (!name || name.length > 60)
    throw new HttpError('Use a key name of 1–60 characters.');
  const random = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const key = `tb_${random}`;
  const info: ApiKeyInfo = {
    id: keyId(),
    name,
    prefix: key.slice(0, 11),
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  await db
    .prepare(
      'INSERT INTO api_keys (id,member_id,name,key_hash,prefix,created_at) VALUES (?,?,?,?,?,?)',
    )
    .bind(
      info.id,
      member.id,
      name,
      await sha256(key),
      info.prefix,
      info.created_at,
    )
    .run();
  return { ...info, key };
}

export async function revokeApiKey(db: Database, user: Identity, id: unknown) {
  const member = await getMember(db, user);
  if (!member) throw new HttpError('Set up your household first.', 403);
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id))
    throw new HttpError('Key not found.', 404);
  const existing = await db
    .prepare('SELECT id FROM api_keys WHERE id=? AND member_id=?')
    .bind(id, member.id)
    .first<{ id: string }>();
  if (!existing) throw new HttpError('Key not found.', 404);
  await db
    .prepare('DELETE FROM api_keys WHERE id=? AND member_id=?')
    .bind(id, member.id)
    .run();
  return { ok: true };
}

export async function identityFromApiKey(
  db: Database,
  authorization: string | null,
): Promise<Identity | null> {
  const match = /^Bearer (\S+)$/.exec(authorization ?? '');
  if (!match || !KEY_PATTERN.test(match[1])) return null;
  const row = await db
    .prepare(
      'SELECT k.id, m.user_id, m.name FROM api_keys k JOIN members m ON m.id=k.member_id WHERE k.key_hash=?',
    )
    .bind(await sha256(match[1]))
    .first<{ id: string; user_id: string; name: string }>();
  if (!row) return null;
  await db
    .prepare('UPDATE api_keys SET last_used_at=? WHERE id=?')
    .bind(new Date().toISOString(), row.id)
    .run();
  return { userId: row.user_id, displayName: row.name };
}
