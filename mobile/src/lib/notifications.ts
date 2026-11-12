import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Expo Go and the web preview cannot receive push notifications, so the module is only loaded elsewhere.
export const pushSupported = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

export type PushStatus =
  | { state: 'unsupported'; message: string }
  | { state: 'denied'; message: string }
  | { state: 'registered'; message: string }
  | { state: 'error'; message: string };

let registeredToken: string | null = null;
let lastStatus: PushStatus | null = null;

export const getPushStatus = () => lastStatus;

export async function registerForPush(): Promise<PushStatus> {
  if (!pushSupported) {
    lastStatus = { state: 'unsupported', message: 'Notifications need the installed Velista app. They do not work in Expo Go or the web preview.' };
    return lastStatus;
  }
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Listings and sales',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
    if (!granted) {
      lastStatus = { state: 'denied', message: 'Notifications are turned off for Velista. Turn them on in your phone settings, then tap Turn on again.' };
      return lastStatus;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/api/notifications/token', { method: 'POST', body: { token, platform: Platform.OS } });
    registeredToken = token;
    lastStatus = { state: 'registered', message: 'This phone gets alerts when a listing is ready or an item sells.' };
  } catch (e) {
    lastStatus = { state: 'error', message: `This phone could not be set up for notifications: ${(e as Error).message}` };
  }
  return lastStatus;
}

// Called before signing out, so the next person on this phone does not get this seller's alerts.
export async function unregisterFromPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api('/api/notifications/token', { method: 'DELETE', body: { token, platform: Platform.OS } }).catch(() => {});
}
