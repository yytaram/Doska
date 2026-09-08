import type { FastifyReply } from 'fastify';
import { z } from 'zod';

export function sendError(reply: FastifyReply, statusCode: number, code: string, message: string) {
  return reply.code(statusCode).send({ error: { code, message }, requestId: reply.request.id });
}

export function parseBody<TSchema extends z.ZodType>(
  schema: TSchema,
  body: unknown,
  reply: FastifyReply,
): z.infer<TSchema> | undefined {
  const result = schema.safeParse(body);

  if (!result.success) {
    sendError(reply, 400, 'VALIDATION_ERROR', 'Проверьте введённые данные.');
    return undefined;
  }

  return result.data;
}
