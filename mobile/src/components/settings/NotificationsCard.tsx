import React, { useState } from 'react';
import { View } from 'react-native';
import { api } from '@/lib/api';
import { getPushStatus, registerForPush, type PushStatus } from '@/lib/notifications';
import {
  Banner, Button, Card, CardHeader, Pill, type Tone,
} from '@/components/ui';
import { space } from '@/theme';

const LABEL: Record<PushStatus['state'], { text: string; tone: Tone }> = {
  registered: { text: 'On', tone: 'success' },
  denied: { text: 'Off', tone: 'warning' },
  unsupported: { text: 'Not available', tone: 'neutral' },
  error: { text: 'Problem', tone: 'danger' },
};

// Shows whether this phone gets notifications, and sends a test one without publishing anything.
export function NotificationsCard() {
  const [status, setStatus] = useState<PushStatus | null>(getPushStatus);
  const [busy, setBusy] = useState<'setup' | 'test' | null>(null);
  const [result, setResult] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const setup = async () => {
    setBusy('setup');
    setResult(null);
    setStatus(await registerForPush());
    setBusy(null);
  };

  const sendTest = async () => {
    setBusy('test');
    setResult(null);
    try {
      await api('/api/notifications/test', { method: 'POST' });
      setResult({ tone: 'success', text: 'Sent. It should arrive in a few seconds, even if you close the app.' });
    } catch (e) {
      setResult({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        icon="notifications-outline"
        title="Notifications"
        subtitle="Alerts when a listing is ready or an item sells."
        right={status ? <Pill label={LABEL[status.state].text} tone={LABEL[status.state].tone} /> : null}
      />
      {status && status.state !== 'registered' ? <Banner tone={status.state === 'error' ? 'error' : 'warn'} text={status.message} /> : null}
      {result ? <Banner tone={result.tone} text={result.text} /> : null}
      <View style={{ gap: space.sm }}>
        {status?.state !== 'registered' ? (
          <Button title="Turn on notifications" icon="notifications" onPress={setup} loading={busy === 'setup'} full />
        ) : null}
        <Button title="Send test notification" variant="secondary" icon="paper-plane-outline" onPress={sendTest} loading={busy === 'test'} disabled={busy !== null} full />
      </View>
    </Card>
  );
}
