import { Redirect } from 'expo-router';

// The gate in _layout.tsx sends signed-out users to /login. Everyone else lands on the tabs.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
