import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';

// Foreground notifications still show a banner/sound — without this handler
// they'd arrive silently while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type NotificationData = {
  kind?: 'new_album' | 'new_set';
  albumId?: string;
  typeId?: string;
};

function navigateFromNotificationData(data: NotificationData) {
  // Card sets have no dedicated screen — they're just a category label
  // filtered inside the album screen — so both kinds land on the album.
  if (data.albumId) {
    router.push(`/album/${data.albumId}`);
  }
}

async function registerPushToken() {
  // Remote push requires a physical device and isn't supported in Expo Go
  // (SDK 53+ dropped Android remote push there) — a development build is
  // required to actually receive anything.
  if (!Device.isDevice || Platform.OS === 'web') return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    // Goes through a SECURITY DEFINER function rather than a direct upsert:
    // RLS on push_tokens is scoped to the row's current owner, which blocks
    // reassigning a device's token when it previously belonged to a
    // different account (see migration 20260810120000).
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS,
    });

    if (error) console.error('[usePushNotifications] token registration failed:', error);
  } catch (err) {
    console.error('[usePushNotifications] token registration failed:', err);
  }
}

export function usePushNotifications(userId: string | null) {
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!userId) return;
    registerPushToken();
  }, [userId]);

  useEffect(() => {
    // Cold start: app opened directly from a tapped notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const data = response?.notification.request.content.data as NotificationData | undefined;
      if (data) navigateFromNotificationData(data);
    });

    // Warm start: app already running/backgrounded when the user taps it.
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as NotificationData;
      navigateFromNotificationData(data);
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);
}
