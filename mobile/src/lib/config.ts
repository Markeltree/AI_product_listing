import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEV_SERVER_PORT = 3000;

// In development the app is loaded from Metro on your computer, so Metro's host (hostUri, e.g.
// "192.168.1.20:8081") is also where the Velista server runs. On a phone or emulator, "localhost" is
// the device itself, so it can never reach the server. Tunnel hosts (not an IP) cannot be used.
function devServerUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && host !== '127.0.0.1') return `http://${host}:${DEV_SERVER_PORT}`;
  // The Android emulator reaches the computer at 10.0.2.2.
  if (Platform.OS === 'android') return `http://10.0.2.2:${DEV_SERVER_PORT}`;
  return `http://localhost:${DEV_SERVER_PORT}`;
}

// Backend URL. EXPO_PUBLIC_API_URL in mobile/.env always wins (required for production builds);
// otherwise it is worked out from the development machine as above.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || devServerUrl()).replace(/\/$/, '');

export const APP_SCHEME = 'velista';
export const SETTINGS_RETURN = `${APP_SCHEME}://settings`;
