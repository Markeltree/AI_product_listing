// Stores the signed session token. SecureStore on phones, localStorage when previewing on the web.
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'velista_session';

export async function loadToken(): Promise<string | null> {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') return globalThis.localStorage?.setItem(KEY, token);
  await SecureStore.setItemAsync(KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(KEY);
  await SecureStore.deleteItemAsync(KEY);
}
