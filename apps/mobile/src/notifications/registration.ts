import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { registerDeviceToken, removeDeviceToken } from '../api/client';

const deviceTokenIdKey = 'doska.device-token-id';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(accessToken: string) {
  if (Platform.OS === 'web') return;
  const configuredProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  const easProjectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const projectId = configuredProjectId || easProjectId || Constants.easConfig?.projectId;
  if (!projectId) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Doska',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const permission =
    current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;

  const expoToken = await Notifications.getExpoPushTokenAsync({ projectId });
  const deviceToken = await registerDeviceToken(accessToken, {
    token: expoToken.data,
    platform: Platform.OS as 'android' | 'ios',
  });
  await SecureStore.setItemAsync(deviceTokenIdKey, deviceToken.id);
}

export async function unregisterPushNotifications(accessToken: string) {
  if (Platform.OS === 'web') return;
  const id = await SecureStore.getItemAsync(deviceTokenIdKey);
  if (!id) return;
  try {
    await removeDeviceToken(accessToken, id);
  } finally {
    await SecureStore.deleteItemAsync(deviceTokenIdKey);
  }
}
