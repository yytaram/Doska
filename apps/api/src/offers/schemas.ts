import { z } from 'zod';

const uuid = z.string().uuid();
const pagination = {
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const idParamsSchema = z.object({ id: uuid });
export const userParamsSchema = z.object({ userId: uuid });
export const createOfferSchema = z.object({
  description: z.string().trim().min(5).max(1000).nullable().optional(),
  price: z.number().int().min(0).max(999_999_999_999).nullable().optional(),
});
export const offersQuerySchema = z.object({ ...pagination });
export const messagesQuerySchema = z.object({ ...pagination });
export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

export type MessageInput = z.infer<typeof messageSchema>;
