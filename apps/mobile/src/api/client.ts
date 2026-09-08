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

export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Offer {
  ad: { id: string; ownerId: string; status: AdStatus; title: string };
  chat: { id: string };
  createdAt: string;
  currency: 'KZT';
  decidedAt: string | null;
  description: string | null;
  id: string;
  price: number | null;
  sender: { id: string; profile: { nickname: string } | null };
  status: OfferStatus;
  updatedAt: string;
  withdrawnAt: string | null;
}

export interface OfferPage {
  items: Offer[];
  nextCursor: string | null;
}

export interface ChatMessage {
  body: string;
  chatId: string;
  createdAt: string;
  id: string;
  readAt: string | null;
  sender: { id: string; profile: { nickname: string } | null };
  senderId: string;
}

export interface MessagePage {
  items: ChatMessage[];
  nextCursor: string | null;
}

export interface ChatSummary {
  counterpart: { id: string; profile: { nickname: string } | null };
  createdAt: string;
  id: string;
  lastMessage: ChatMessage | null;
  lastMessageAt: string | null;
  offer: {
    ad: { id: string; ownerId: string; title: string };
    id: string;
    senderId: string;
    status: OfferStatus;
  };
  unreadCount: number;
  updatedAt: string;
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

export function getApiBaseUrl() {
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
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
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

export function reportAd(
  accessToken: string,
  adId: string,
  input: { reason: string; details?: string },
) {
  return request<{ report: { id: string; status: string } }>(
    '/reports',
    {
      method: 'POST',
      body: JSON.stringify({ targetType: 'ad', targetId: adId, ...input }),
    },
    accessToken,
  ).then(({ report }) => report);
}

export function createOffer(
  accessToken: string,
  adId: string,
  input: { description?: string | null; price?: number | null },
) {
  return request<{ offer: Offer }>(
    `/ads/${adId}/offers`,
    { body: JSON.stringify(input), method: 'POST' },
    accessToken,
  ).then(({ offer }) => offer);
}

export function getSentOffers(accessToken: string) {
  return request<OfferPage>('/account/offers', {}, accessToken);
}

export function getAdOffers(accessToken: string, adId: string) {
  return request<OfferPage>(`/ads/${adId}/offers`, {}, accessToken);
}

function changeOffer(
  accessToken: string,
  offerId: string,
  action: 'accept' | 'reject' | 'withdraw',
) {
  return request<{ offer: Offer }>(
    `/offers/${offerId}/${action}`,
    { method: 'POST' },
    accessToken,
  ).then(({ offer }) => offer);
}

export const acceptOffer = (accessToken: string, offerId: string) =>
  changeOffer(accessToken, offerId, 'accept');
export const rejectOffer = (accessToken: string, offerId: string) =>
  changeOffer(accessToken, offerId, 'reject');
export const withdrawOffer = (accessToken: string, offerId: string) =>
  changeOffer(accessToken, offerId, 'withdraw');

export function getChats(accessToken: string) {
  return request<{ chats: ChatSummary[] }>('/chats', {}, accessToken).then(({ chats }) => chats);
}

export function getChatMessages(accessToken: string, chatId: string, cursor?: string) {
  const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return request<MessagePage>(`/chats/${chatId}/messages${suffix}`, {}, accessToken);
}

export function sendChatMessage(accessToken: string, chatId: string, body: string) {
  return request<{ message: ChatMessage }>(
    `/chats/${chatId}/messages`,
    { body: JSON.stringify({ body }), method: 'POST' },
    accessToken,
  ).then(({ message }) => message);
}

export function markChatRead(accessToken: string, chatId: string) {
  return request<void>(`/chats/${chatId}/read`, { method: 'POST' }, accessToken);
}

export function blockUser(accessToken: string, userId: string) {
  return request<void>(`/account/blocks/${userId}`, { method: 'PUT' }, accessToken);
}

export function unblockUser(accessToken: string, userId: string) {
  return request<void>(`/account/blocks/${userId}`, { method: 'DELETE' }, accessToken);
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
