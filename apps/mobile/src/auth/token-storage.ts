import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { TokenPair } from '../api/client';

const storageKey = 'doska.session.v1';

function browserStorage() {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

export async function loadTokenPair(): Promise<TokenPair | null> {
  const value =
    Platform.OS === 'web'
      ? (browserStorage()?.getItem(storageKey) ?? null)
      : await SecureStore.getItemAsync(storageKey);

  if (!value) return null;

  try {
    return JSON.parse(value) as TokenPair;
  } catch {
    await clearTokenPair();
    return null;
  }
}

export async function saveTokenPair(tokens: TokenPair) {
  const value = JSON.stringify(tokens);
  if (Platform.OS === 'web') {
    browserStorage()?.setItem(storageKey, value);
    return;
  }

  await SecureStore.setItemAsync(storageKey, value);
}

export async function clearTokenPair() {
  if (Platform.OS === 'web') {
    browserStorage()?.removeItem(storageKey);
    return;
  }

  await SecureStore.deleteItemAsync(storageKey);
}
