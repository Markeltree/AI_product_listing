import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEV_SERVER_PORT = 3000;

function devServerUrl(): string {
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && host !== '127.0.0.1') return `http://${host}:${DEV_SERVER_PORT}`;
  // The Android emulator reaches the computer at 10.0.2.2.
  if (Platform.OS === 'android') return `http://10.0.2.2:${DEV_SERVER_PORT}`;
  return `http://localhost:${DEV_SERVER_PORT}`;
}

export const DEPLOYED_API_URL = 'https://aiproductlisting-production.up.railway.app';


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
