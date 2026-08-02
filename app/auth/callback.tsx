import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { COLORS } from '../../lib/constants';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();

    // On Android, the OAuth redirect intent can land here as a real navigation
    // (on top of resolving the WebBrowser promise that already completed the
    // sign-in in useAuth) — this screen has no other job, so without this it's
    // a dead end: the user is left staring at a spinner forever even though
    // sign-in already succeeded, until they force-close and reopen the app.
    router.replace('/');
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
      <ActivityIndicator size="large" color={COLORS.purple2} />
    </View>
  );
}
