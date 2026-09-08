type Cursor = { createdAt: Date; id: string };

export function encodeCursor(value: Cursor) {
  return Buffer.from(
    JSON.stringify({ createdAt: value.createdAt.toISOString(), id: value.id }),
  ).toString('base64url');
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') return null;
    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: parsed.id };
  } catch {
    return null;
  }
}
