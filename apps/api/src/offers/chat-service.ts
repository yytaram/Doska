import { PrismaClient } from '@prisma/client';

import { messageSelect, serializeMessage } from './serializer.js';

export async function findChatForUser(prisma: PrismaClient, chatId: string, userId: string) {
  return prisma.chat.findFirst({
    where: {
      id: chatId,
      OR: [{ offer: { senderId: userId } }, { offer: { ad: { ownerId: userId } } }],
    },
    select: {
      id: true,
      offer: { select: { senderId: true, ad: { select: { ownerId: true } } } },
    },
  });
}

export async function usersAreBlocked(prisma: PrismaClient, firstId: string, secondId: string) {
  return Boolean(
    await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: firstId, blockedId: secondId },
          { blockerId: secondId, blockedId: firstId },
        ],
      },
      select: { id: true },
    }),
  );
}

export async function createChatMessage(
  prisma: PrismaClient,
  chatId: string,
  userId: string,
  body: string,
) {
  const chat = await findChatForUser(prisma, chatId, userId);
  if (!chat) return { error: 'not_found' as const };

  const otherId = chat.offer.senderId === userId ? chat.offer.ad.ownerId : chat.offer.senderId;
  if (await usersAreBlocked(prisma, userId, otherId)) return { error: 'blocked' as const };

  const message = await prisma.$transaction(async (transaction) => {
    const created = await transaction.message.create({
      data: { body, chatId, senderId: userId },
      select: messageSelect,
    });
    await transaction.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: created.createdAt },
    });
    return created;
  });
  return { message: serializeMessage(message) };
}
