import { Platform } from 'react-native';

export interface City {
  id: string;
  nameRu: string;
  regionRu: string;
  slug: string;
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
