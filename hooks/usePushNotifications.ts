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
  if (!data.albumId) return;
  try {
    router.push(`/album/${data.albumId}`);
  } catch (err) {
    // router.push throws if called before the target route is actually
    // mounted. Callers are expected to gate on `ready`, but this is a
    // last-resort guard so a race never surfaces as an unhandled rejection.
    console.error('[usePushNotifications] navigation failed:', err);
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

// `ready` should reflect whether the authenticated Stack (and therefore the
// `album/[id]` route) is actually mounted — i.e. auth + onboarding have
// resolved. On a cold start from a tapped notification, this hook mounts
// immediately while the app is still on the loading/login/onboarding screen,
// long before that Stack exists. Calling router.push before its target route
// is mounted silently fails (or throws), so the deep link would otherwise be
// lost with no visible symptom other than "notification tap does nothing" —
// and if it happened to fire during the loading screen, it could also throw
// an uncaught error inside a native-event callback. Buffering until `ready`
// flips true fixes both.
export function usePushNotifications(userId: string | null, ready: boolean) {
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const pendingDataRef = useRef<NotificationData | null>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    if (!userId) return;
    registerPushToken();
  }, [userId]);

  useEffect(() => {
    const handleData = (data: NotificationData | undefined) => {
      if (!data) return;
      if (readyRef.current) {
        navigateFromNotificationData(data);
      } else {
        pendingDataRef.current = data;
      }
    };

    // Cold start: app opened directly from a tapped notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      handleData(response?.notification.request.content.data as NotificationData | undefined);
    });

    // Warm start: app already running/backgrounded when the user taps it.
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      handleData(response.notification.request.content.data as NotificationData);
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  // Flush a buffered tap once the Stack actually mounts.
  useEffect(() => {
    if (ready && pendingDataRef.current) {
      const data = pendingDataRef.current;
      pendingDataRef.current = null;
      navigateFromNotificationData(data);
    }
  }, [ready]);
}
