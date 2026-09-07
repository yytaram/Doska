import { z } from 'zod';

const cursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export interface AdCursor {
  createdAt: Date;
  id: string;
}

export function encodeAdCursor(ad: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: ad.createdAt.toISOString(), id: ad.id }),
    'utf8',
  ).toString('base64url');
}

export function decodeAdCursor(cursor: string): AdCursor | null {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    );

    if (!parsed.success) return null;
    return { createdAt: new Date(parsed.data.createdAt), id: parsed.data.id };
  } catch {
    return null;
  }
}
