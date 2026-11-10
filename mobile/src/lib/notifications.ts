import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

// Expo Go and the web preview cannot receive push notifications, so the module is only loaded elsewhere.
export const pushSupported = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let registeredToken: string | null = null;

// Asks permission and tells the server where to reach this phone. The app works normally without it,
// for example when the seller says no, so problems are only logged.
export async function registerForPush(): Promise<void> {
  if (!pushSupported) return;
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
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/api/notifications/token', { method: 'POST', body: { token, platform: Platform.OS } });
    registeredToken = token;
  } catch (e) {
    console.warn('Push notifications are not available:', (e as Error).message);
  }
}

// Called before signing out, so the next person on this phone does not get this seller's alerts.
export async function unregisterFromPush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api('/api/notifications/token', { method: 'DELETE', body: { token, platform: Platform.OS } }).catch(() => {});
}
