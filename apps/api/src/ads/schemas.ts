import { z } from 'zod';

export const publicAdStatuses = ['active'] as const;
export const adStatuses = [
  'draft',
  'moderation',
  'active',
  'paused',
  'closed',
  'rejected',
  'expired',
] as const;
export const itemConditions = ['any', 'new', 'like_new', 'good', 'fair', 'for_parts'] as const;

const title = z.string().trim().min(5).max(120);
const description = z.string().trim().min(20).max(5000);
const budget = z.number().int().min(0).max(999_999_999_999).nullable();
const condition = z.enum(itemConditions);
const categoryId = z.string().uuid();
const cityId = z.string().uuid();

const editableAdFields = {
  title,
  description,
  budget,
  condition,
  categoryId,
  cityId,
};

export const createAdSchema = z.object({
  ...editableAdFields,
  status: z.enum(['draft', 'moderation']).default('draft'),
});

export const updateAdSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    budget: budget.optional(),
    condition: condition.optional(),
    categoryId: categoryId.optional(),
    cityId: cityId.optional(),
    status: z.enum(['draft', 'moderation']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

const paginationFields = {
  cursor: z.string().max(300).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
};

export const publicAdsQuerySchema = z
  .object({
    ...paginationFields,
    search: z.string().trim().min(2).max(100).optional(),
    categoryId: categoryId.optional(),
    cityId: cityId.optional(),
    condition: condition.optional(),
    budgetMin: z.coerce.number().int().min(0).max(999_999_999_999).optional(),
    budgetMax: z.coerce.number().int().min(0).max(999_999_999_999).optional(),
    publishedAfter: z.coerce.date().optional(),
    publishedBefore: z.coerce.date().optional(),
  })
  .refine(
    ({ budgetMax, budgetMin }) =>
      budgetMax === undefined || budgetMin === undefined || budgetMin <= budgetMax,
    { message: 'minimum budget must not exceed maximum budget' },
  )
  .refine(
    ({ publishedAfter, publishedBefore }) =>
      publishedAfter === undefined ||
      publishedBefore === undefined ||
      publishedAfter <= publishedBefore,
    { message: 'start date must not exceed end date' },
  );

export const myAdsQuerySchema = z.object({
  ...paginationFields,
  status: z.enum(adStatuses).optional(),
});

export const adParamsSchema = z.object({ id: z.string().uuid() });

export type AdStatusInput = (typeof adStatuses)[number];
export type ItemConditionInput = (typeof itemConditions)[number];
