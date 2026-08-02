import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { COLORS } from '../../lib/constants';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg }}>
      <ActivityIndicator size="large" color={COLORS.purple2} />
    </View>
  );
}
