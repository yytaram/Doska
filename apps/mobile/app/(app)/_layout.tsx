import { Redirect, Stack } from 'expo-router';

import { useAuthStore } from '../../src/auth/store';

export default function AppLayout() {
  const status = useAuthStore((state) => state.status);

  if (status !== 'signedIn') return <Redirect href="/welcome" />;

  return <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: '#172033' }} />;
}
