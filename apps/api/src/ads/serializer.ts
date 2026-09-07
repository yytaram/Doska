import { Prisma } from '@prisma/client';

export const adSelect = {
  id: true,
  title: true,
  description: true,
  budget: true,
  currency: true,
  condition: true,
  status: true,
  publishedAt: true,
  expiresAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, slug: true, nameRu: true } },
  city: { select: { id: true, slug: true, nameRu: true, regionRu: true } },
  owner: {
    select: {
      id: true,
      profile: { select: { nickname: true } },
    },
  },
} satisfies Prisma.AdSelect;

type SelectedAd = Prisma.AdGetPayload<{ select: typeof adSelect }>;

export function serializeAd(ad: SelectedAd) {
  return {
    ...ad,
    budget: ad.budget === null ? null : Number(ad.budget),
    condition: ad.condition.toLowerCase(),
    status: ad.status.toLowerCase(),
  };
}
