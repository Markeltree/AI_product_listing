import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEV_SERVER_PORT = 3000;

// Local development only (EXPO_PUBLIC_API_URL=local): the app is loaded from Metro on your computer, so Metro's host (hostUri, e.g.
// "192.168.1.20:8081") is also where the Velista server runs. On a phone or emulator, "localhost" is
// the device itself, so it can never reach the server. Tunnel hosts (not an IP) cannot be used.
function devServerUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && host !== '127.0.0.1') return `http://${host}:${DEV_SERVER_PORT}`;
  // The Android emulator reaches the computer at 10.0.2.2.
  if (Platform.OS === 'android') return `http://10.0.2.2:${DEV_SERVER_PORT}`;
  return `http://localhost:${DEV_SERVER_PORT}`;
}

// The deployed Velista API (Railway). The app uses it unless told otherwise, so a phone never ends up
// on a stale server running on someone's computer.
export const DEPLOYED_API_URL = 'https://aiproductlisting-production.up.railway.app';

// Backend URL:
// - EXPO_PUBLIC_API_URL unset           -> the deployed API (default)
// - EXPO_PUBLIC_API_URL=local           -> the Velista server on the computer running Expo (see above)
// - EXPO_PUBLIC_API_URL=https://...     -> that address
// Restart Expo with `npx expo start -c` after changing mobile/.env.
function resolveApiUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  if (!configured) return DEPLOYED_API_URL;
  if (configured.toLowerCase() === 'local') return devServerUrl();
  return configured;
}

export const API_URL = resolveApiUrl().replace(/\/$/, '');
export const USING_LOCAL_SERVER = !API_URL.startsWith('https://');

export const APP_SCHEME = 'velista';
export const SETTINGS_RETURN = `${APP_SCHEME}://settings`;
