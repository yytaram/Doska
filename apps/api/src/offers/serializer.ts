import { Prisma } from '@prisma/client';

export const offerSelect = {
  id: true,
  price: true,
  currency: true,
  description: true,
  status: true,
  decidedAt: true,
  withdrawnAt: true,
  createdAt: true,
  updatedAt: true,
  chat: { select: { id: true } },
  sender: { select: { id: true, profile: { select: { nickname: true } } } },
  ad: { select: { id: true, ownerId: true, title: true, status: true } },
} satisfies Prisma.OfferSelect;

export type SelectedOffer = Prisma.OfferGetPayload<{ select: typeof offerSelect }>;

export function serializeOffer(offer: SelectedOffer) {
  return {
    ...offer,
    price: offer.price === null ? null : Number(offer.price),
    status: offer.status.toLowerCase(),
    ad: { ...offer.ad, status: offer.ad.status.toLowerCase() },
  };
}

export const messageSelect = {
  id: true,
  chatId: true,
  senderId: true,
  body: true,
  readAt: true,
  createdAt: true,
  sender: { select: { id: true, profile: { select: { nickname: true } } } },
} satisfies Prisma.MessageSelect;

export type SelectedMessage = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export function serializeMessage(message: SelectedMessage) {
  return message;
}
