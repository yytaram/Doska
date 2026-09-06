import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const REFRESH_SECRET_BYTES = 32;

export interface RefreshTokenMaterial {
  expiresAt: Date;
  hash: string;
  id: string;
  token: string;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createRefreshToken(ttlDays: number): RefreshTokenMaterial {
  const id = randomUUID();
  const secret = randomBytes(REFRESH_SECRET_BYTES).toString('base64url');
  const token = `${id}.${secret}`;

  return {
    id,
    token,
    hash: hashRefreshToken(token),
    expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
  };
}

export function getRefreshTokenId(token: string): string | null {
  const [id, secret, extra] = token.split('.');
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!id || !secret || extra || !uuidPattern.test(id) || secret.length < 40) {
    return null;
  }

  return id;
}

export function refreshTokenMatches(storedHash: string, token: string): boolean {
  const providedHash = hashRefreshToken(token);
  const stored = Buffer.from(storedHash, 'hex');
  const provided = Buffer.from(providedHash, 'hex');

  return stored.length === provided.length && timingSafeEqual(stored, provided);
}
