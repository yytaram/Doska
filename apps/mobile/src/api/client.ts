import { Platform } from 'react-native';

export interface City {
  id: string;
  nameRu: string;
  regionRu: string;
  slug: string;
}

export interface Category {
  id: string;
  nameRu: string;
  slug: string;
}

export type ItemCondition = 'any' | 'new' | 'like_new' | 'good' | 'fair' | 'for_parts';
export type AdStatus =
  'draft' | 'moderation' | 'active' | 'paused' | 'closed' | 'rejected' | 'expired';

export interface Ad {
  budget: number | null;
  category: Category;
  city: City;
  closedAt: string | null;
  condition: ItemCondition;
  createdAt: string;
  currency: 'KZT';
  description: string;
  expiresAt: string | null;
  id: string;
  owner: { id: string; profile: { nickname: string } | null };
  publishedAt: string | null;
  status: AdStatus;
  title: string;
  updatedAt: string;
}

export interface AdPage {
  items: Ad[];
  nextCursor: string | null;
}

export interface AdInput {
  budget: number | null;
  categoryId: string;
  cityId: string;
  condition: ItemCondition;
  description: string;
  status: 'draft' | 'moderation';
  title: string;
}

export interface UserProfile {
  city: City;
  language: 'ru';
  nickname: string;
}

export interface User {
  email: string;
  id: string;
  profile: UserProfile | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}

export interface TokenPair {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  tokenType: 'Bearer';
  user: User;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
      throw new ApiError(
        payload.error?.message ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.',
        payload.error?.code,
        response.status,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      'Не удалось подключиться к Doska. Проверьте адрес API и подключение к сети.',
    );
  }
}

export function getCities() {
  return request<{ cities: City[] }>('/reference/cities').then(({ cities }) => cities);
}

export function getCategories() {
  return request<{ categories: Category[] }>('/reference/categories').then(
    ({ categories }) => categories,
  );
}

export function getAds(
  filters: {
    budgetMax?: number;
    budgetMin?: number;
    categoryId?: string;
    cityId?: string;
    condition?: ItemCondition;
    cursor?: string;
    publishedAfter?: string;
    search?: string;
  } = {},
) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const suffix = query.size > 0 ? `?${query.toString()}` : '';
  return request<AdPage>(`/ads${suffix}`);
}

export function getAd(id: string) {
  return request<{ ad: Ad }>(`/ads/${id}`).then(({ ad }) => ad);
}

export function getMyAds(accessToken: string, status?: AdStatus) {
  const suffix = status ? `?status=${status}` : '';
  return request<AdPage>(`/account/ads${suffix}`, {}, accessToken);
}

export function getMyAd(accessToken: string, id: string) {
  return request<{ ad: Ad }>(`/account/ads/${id}`, {}, accessToken).then(({ ad }) => ad);
}

export function createAd(accessToken: string, input: AdInput) {
  return request<{ ad: Ad }>(
    '/ads',
    { body: JSON.stringify(input), method: 'POST' },
    accessToken,
  ).then(({ ad }) => ad);
}

export function updateAd(accessToken: string, id: string, input: Partial<AdInput>) {
  return request<{ ad: Ad }>(
    `/ads/${id}`,
    { body: JSON.stringify(input), method: 'PATCH' },
    accessToken,
  ).then(({ ad }) => ad);
}

export function closeAd(accessToken: string, id: string) {
  return request<{ ad: Ad }>(`/ads/${id}/close`, { method: 'POST' }, accessToken).then(
    ({ ad }) => ad,
  );
}

export function login(input: { email: string; password: string }) {
  return request<TokenPair>('/auth/login', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function register(input: {
  acceptedMinimumAge: true;
  cityId: string;
  email: string;
  language: 'ru';
  nickname: string;
  password: string;
}) {
  return request<TokenPair>('/auth/register', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function refreshSession(refreshToken: string) {
  return request<TokenPair>('/auth/refresh', {
    body: JSON.stringify({ refreshToken }),
    method: 'POST',
  });
}

export function getCurrentUser(accessToken: string) {
  return request<{ user: User }>('/auth/me', {}, accessToken).then(({ user }) => user);
}

export function updateProfile(
  accessToken: string,
  input: { cityId: string; language: 'ru'; nickname: string },
) {
  return request<{ user: User }>(
    '/account/profile',
    { body: JSON.stringify(input), method: 'PUT' },
    accessToken,
  ).then(({ user }) => user);
}
