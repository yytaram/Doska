import { create } from 'zustand';

import {
  getCurrentUser,
  login,
  refreshSession,
  register,
  updateProfile,
  type TokenPair,
  type User,
} from '../api/client';
import { clearTokenPair, loadTokenPair, saveTokenPair } from './token-storage';
import { unregisterPushNotifications } from '../notifications/registration';

type SessionStatus = 'loading' | 'signedIn' | 'signedOut';

interface AuthState {
  accessToken: string | null;
  initialize: () => Promise<void>;
  register: (input: {
    acceptedMinimumAge: true;
    cityId: string;
    email: string;
    language: 'ru';
    nickname: string;
    password: string;
  }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  status: SessionStatus;
  updateProfile: (input: { cityId: string; language: 'ru'; nickname: string }) => Promise<void>;
  user: User | null;
}

async function saveSession(tokens: TokenPair, set: (state: Partial<AuthState>) => void) {
  await saveTokenPair(tokens);
  set({ accessToken: tokens.accessToken, status: 'signedIn', user: tokens.user });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  status: 'loading',
  user: null,

  initialize: async () => {
    const stored = await loadTokenPair();
    if (!stored) {
      set({ accessToken: null, status: 'signedOut', user: null });
      return;
    }

    try {
      const user = await getCurrentUser(stored.accessToken);
      set({ accessToken: stored.accessToken, status: 'signedIn', user });
    } catch {
      try {
        const refreshed = await refreshSession(stored.refreshToken);
        await saveSession(refreshed, set);
      } catch {
        await clearTokenPair();
        set({ accessToken: null, status: 'signedOut', user: null });
      }
    }
  },

  signIn: async (input) => {
    await saveSession(await login(input), set);
  },

  register: async (input) => {
    await saveSession(await register(input), set);
  },

  updateProfile: async (input) => {
    const accessToken = get().accessToken;
    if (!accessToken) throw new Error('Сессия закончилась. Войдите снова.');

    const user = await updateProfile(accessToken, input);
    const stored = await loadTokenPair();
    if (stored) {
      await saveTokenPair({ ...stored, user });
    }
    set({ user });
  },

  signOut: async () => {
    const accessToken = get().accessToken;
    if (accessToken) await unregisterPushNotifications(accessToken).catch(() => undefined);
    await clearTokenPair();
    set({ accessToken: null, status: 'signedOut', user: null });
  },
}));
