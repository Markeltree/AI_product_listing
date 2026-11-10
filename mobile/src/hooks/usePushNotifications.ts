import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { pushSupported, registerForPush } from '@/lib/notifications';

// Once signed in: registers this phone, and opens the listing when a notification is tapped.
export function usePushNotifications(signedIn: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!signedIn || !pushSupported) return;
    let cancelled = false;
    let stop: (() => void) | undefined;

    (async () => {
      registerForPush();
      const Notifications = await import('expo-notifications');
      if (cancelled) return;

      const open = (data: Record<string, unknown> | undefined) => {
        if (typeof data?.listingId === 'string') router.push({ pathname: '/listing/[id]', params: { id: data.listingId } });
      };
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        open(response.notification.request.content.data);
      });
      stop = () => subscription.remove();

      // The app was closed and was opened by tapping the notification.
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last && !cancelled) {
        open(last.notification.request.content.data);
        await Notifications.clearLastNotificationResponseAsync();
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, [signedIn, router]);
}
