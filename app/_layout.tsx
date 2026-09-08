import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import GalaxyBackground from '../components/GalaxyBackground';
import LoginScreen from '../components/LoginScreen';
import OnboardingScreen from '../components/OnboardingScreen';
import { useAuth } from '../hooks/useAuth';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { BiasProvider, useBias } from '../lib/BiasContext';
import { I18nProvider } from '../lib/I18nContext';
import { PremiumProvider } from '../lib/PremiumContext';
import { supabase } from '../lib/supabase';
import { BIAS_ENABLED, COLORS } from '../lib/constants';
import { BiasKey } from '../lib/types';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://79032d72ddbccb5ec9ab0e2af2fef252@o4511765866938368.ingest.us.sentry.io/4511765900230656',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

SplashScreen.preventAutoHideAsync();

const onboardedKey = (userId: string) => `@purplecollector/onboarded:${userId}`;

function LoadingScreen() {
  const pulse = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.85, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.loadingWrap}>
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.splashLogo}
          contentFit="contain"
        />
      </Animated.View>
    </View>
  );
}

interface AppShellProps {
  session: Session | null;
  loading: boolean;
  authLoading: 'google' | 'apple' | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
}

function AppShell({ session, loading, authLoading, signInWithGoogle, signInWithApple }: AppShellProps) {
  const { saveBiases } = useBias();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setOnboarded(null);
      return;
    }

    const checkOnboarded = async () => {
      // Fast path: cached locally
      const cached = await AsyncStorage.getItem(onboardedKey(session.user.id));
      if (cached === 'true') {
        setOnboarded(true);
        return;
      }

      // Multi-device: check Supabase for existing profile.
      // `user_profiles` rows are auto-created by the on_auth_user_created
      // trigger for every signup, so row existence alone can't signal
      // "completed onboarding" — onboarding_completed is the real flag.
      try {
        // On Android, the network connection can still be settling right after
        // control returns from the Google Custom Tab, which can leave this
        // request hanging with no error — without a timeout, `onboarded` would
        // never resolve and the app gets stuck on the loading screen until the
        // user force-closes and reopens it.
        const query = supabase
          .from('user_profiles')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .single();
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('onboarding check timed out')), 8000)
        );

        const { data } = await Promise.race([query, timeout]);

        if (data?.onboarding_completed) {
          await AsyncStorage.setItem(onboardedKey(session.user.id), 'true');
          setOnboarded(true);
          return;
        }
      } catch {}

      setOnboarded(false);
    };

    checkOnboarded();
  }, [session?.user?.id]);

  const finishOnboarding = async (biases: BiasKey[]) => {
    await saveBiases(biases);
    if (session?.user?.id) await AsyncStorage.setItem(onboardedKey(session.user.id), 'true');
    setOnboarded(true);
  };

  // El onboarding es solo la eleccion de bias: con BIAS_ENABLED en false no hay
  // nada que preguntar, asi que ni se muestra ni se espera la consulta de
  // onboarding_completed (que ademas tiene su propio timeout de 8s).
  const showOnboarding = BIAS_ENABLED && !!session && !onboarded;
  const isLoading = loading || (BIAS_ENABLED && !!session && onboarded === null);
  // Mirrors the exact condition that renders the authenticated <Stack> below
  // (with the album/[id] route) — anything looser lets navigation fire
  // before that route exists.
  const stackReady = !isLoading && !!session && !showOnboarding;

  usePushNotifications(session?.user?.id ?? null, stackReady);

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <GalaxyBackground />

      {/* En web la app se sirve en una columna centrada del ancho de un
          telefono: el layout esta hecho para ~400px y sin esto se estira a
          todo el navegador (las photocards, que miden 31% del contenedor,
          terminaban mas anchas que el telefono entero). El fondo de galaxia
          queda a sangre completa detras porque es absoluteFill. */}
      <View style={styles.column}>
      {isLoading ? (
        <LoadingScreen />
      ) : !session ? (
        <LoginScreen onGoogleSignIn={signInWithGoogle} onAppleSignIn={signInWithApple} loading={authLoading} />
      ) : showOnboarding ? (
        <OnboardingScreen onFinish={finishOnboarding} />
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="type/[id]" />
          <Stack.Screen name="album/[id]" />
          <Stack.Screen name="auth/callback" />
          <Stack.Screen
            name="paywall"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
        </Stack>
      )}
      </View>
    </View>
  );
}

export default Sentry.wrap(function RootLayout() {
  const { session, loading, authLoading, signInWithGoogle, signInWithApple } = useAuth();
  const userId = session?.user?.id ?? null;

  return (
    <I18nProvider>
      <PremiumProvider userId={userId}>
        <BiasProvider userId={userId}>
          <AppShell
            session={session}
            loading={loading}
            authLoading={authLoading}
            signInWithGoogle={signInWithGoogle}
            signInWithApple={signInWithApple}
          />
        </BiasProvider>
      </PremiumProvider>
    </I18nProvider>
  );
});

// Ancho de la columna en web. Un poco mas que un telefono grande (430pt del
// iPhone Pro Max) para que respire, sin llegar a romper las proporciones.
const WEB_COLUMN_MAX_WIDTH = 480;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
    ...(Platform.OS === 'web' ? { alignItems: 'center' as const } : null),
  },
  column: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web'
      ? {
          maxWidth: WEB_COLUMN_MAX_WIDTH,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderColor: 'rgba(168,85,247,0.14)',
        }
      : null),
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 213,
    height: 92,
  },
});
