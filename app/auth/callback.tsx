import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { COLORS } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // En web esta pantalla es el destino real del redirect de Google: la URL
    // trae el token y `detectSessionInUrl` lo procesa de forma asincrona al
    // arrancar el cliente. Navegar de inmediato (como hace la rama nativa)
    // reescribe la URL y se pierde el token antes de que lo lea, asi que aca
    // se espera a que la sesion exista.
    if (Platform.OS === 'web') {
      let done = false;
      const go = () => { if (!done) { done = true; router.replace('/'); } };

      supabase.auth.getSession().then(({ data }) => { if (data.session) go(); });
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => { if (session) go(); }
      );
      // Si el login fallo o el usuario cancelo, no hay sesion que esperar:
      // se vuelve igual para no dejarlo mirando un spinner eterno.
      const timeout = setTimeout(go, 8000);

      return () => { subscription.unsubscribe(); clearTimeout(timeout); };
    }

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
