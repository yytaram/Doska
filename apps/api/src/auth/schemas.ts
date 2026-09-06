import { z } from 'zod';

const email = z.string().trim().toLowerCase().email().max(320);
const password = z.string().min(12).max(128);
const nickname = z.string().trim().min(2).max(40);
const cityId = z.string().uuid();
const language = z.literal('ru').default('ru');

export const registerSchema = z.object({
  email,
  password,
  nickname,
  cityId,
  language,
  acceptedMinimumAge: z.literal(true),
});

export const loginSchema = z.object({ email, password });

export const refreshSchema = z.object({
  refreshToken: z.string().min(80).max(200),
});

export const profileSchema = z.object({ nickname, cityId, language });

export const changePasswordSchema = z.object({
  currentPassword: password,
  newPassword: password,
});

export const deleteAccountSchema = z.object({
  currentPassword: password,
});
