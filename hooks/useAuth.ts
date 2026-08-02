import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

// Supabase's `app_metadata.provider` is fixed at signup and `identities[].last_sign_in_at`
// turned out not to update reliably across our sign-in flows either — the only trustworthy
// signal is the one we record ourselves at the exact moment sign-in succeeds.
const authProviderKey = (uid: string) => `@purplecollector/authProvider:${uid}`;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState<'google' | 'apple' | null>(null);
  const [authProvider, setAuthProvider] = useState<'google' | 'apple' | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setAuthProvider(null); return; }

    AsyncStorage.getItem(authProviderKey(uid)).then(stored => {
      if (stored === 'apple' || stored === 'google') {
        setAuthProvider(stored);
      } else {
        // Session predates this fix, so we never recorded it locally — best-effort
        // fallback until the user signs in again, at which point it self-corrects.
        setAuthProvider(session?.user?.app_metadata?.provider === 'apple' ? 'apple' : 'google');
      }
    });
  }, [session?.user?.id]);

  const signInWithGoogle = async () => {
    setAuthLoading('google');
    try {
      const redirectTo = Linking.createURL('auth/callback');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          // Forces Google's account chooser instead of silently reusing
          // whichever Google session is already active in the browser.
          queryParams: { prompt: 'select_account' },
        },
      });

      if (error) { console.error('[Auth] signInWithOAuth error:', error); throw error; }
      if (!data.url) throw new Error('No OAuth URL returned — check Google provider in Supabase dashboard');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const url = result.url;
        let uid: string | undefined;
        // Implicit flow devuelve tokens en el fragmento (#access_token=...)
        if (url.includes('#')) {
          const params = new URLSearchParams(url.split('#')[1]);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          if (access_token && refresh_token) {
            const { data: sessionData } = await supabase.auth.setSession({ access_token, refresh_token });
            uid = sessionData.session?.user?.id;
          }
        } else {
          // PKCE flow devuelve ?code=...
          const { data: sessionData } = await supabase.auth.exchangeCodeForSession(url);
          uid = sessionData.session?.user?.id;
        }
        if (uid) {
          await AsyncStorage.setItem(authProviderKey(uid), 'google');
          setAuthProvider('google');
        }
      }
    } catch (error) {
      console.error('Google sign in error:', error);
    } finally {
      setAuthLoading(null);
    }
  };

  const signInWithApple = async () => {
    setAuthLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token returned by Apple');

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) { console.error('[Auth] signInWithIdToken error:', error); throw error; }

      if (data.user) {
        await AsyncStorage.setItem(authProviderKey(data.user.id), 'apple');
        setAuthProvider('apple');
      }

      // Apple only sends fullName on the very first sign-in ever for this app+user.
      // user_profiles already has a row (created by the on_auth_user_created trigger),
      // so this is an update, not an insert.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ');
      if (fullName && data.user) {
        await supabase.from('user_profiles').update({ display_name: fullName }).eq('id', data.user.id);
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User dismissed the Apple sheet — not worth surfacing as an error.
      } else {
        console.error('Apple sign in error:', error);
      }
    } finally {
      setAuthLoading(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const deleteAccount = async (): Promise<{ error?: string }> => {
    const uid = session?.user?.id;
    if (!uid) return { error: 'No active session' };

    // Apple guideline 5.1.1(v): accounts created via Sign in with Apple must have
    // their Apple token revoked on deletion, or the account isn't really gone from
    // Apple's perspective. The authorizationCode from the original sign-in is long
    // expired (~5 min TTL), so we ask Apple for a fresh one right now — this also
    // means the user re-authenticates with Face/Touch ID immediately before a
    // destructive action, which is a good thing to have anyway.
    const isAppleUser = authProvider === 'apple';

    let appleAuthorizationCode: string | undefined;

    if (isAppleUser) {
      try {
        const credential = await AppleAuthentication.signInAsync();
        if (!credential.authorizationCode) {
          return { error: 'Apple did not return an authorization code — try again' };
        }
        appleAuthorizationCode = credential.authorizationCode;
      } catch (error: any) {
        // Same "fail closed" rule as the rest of this flow: if we can't get a
        // fresh Apple grant, we don't touch the account at all.
        if (error.code === 'ERR_REQUEST_CANCELED') {
          return { error: 'Account deletion cancelled' };
        }
        console.error('[Auth] Apple re-auth for deletion failed:', error);
        return { error: 'Could not verify your Apple ID — try again' };
      }
    }

    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: appleAuthorizationCode ? { appleAuthorizationCode } : undefined,
    });

    if (error) {
      console.error('[Auth] deleteAccount invoke error:', error);
      return { error: error.message || 'Could not delete account' };
    }
    if (!data?.success) {
      console.error('[Auth] deleteAccount function error:', data?.error);
      return { error: data?.error || 'Could not delete account' };
    }

    // Only clear local state once the account is confirmed gone server-side.
    await AsyncStorage.multiRemove([
      `@purplecollector/onboarded:${uid}`,
      `@purplecollector/biases:${uid}`,
      `@purplecollector/premium:${uid}`,
      authProviderKey(uid),
    ]);
    await supabase.auth.signOut();
    setSession(null);
    return {};
  };

  return {
    session,
    user: session?.user ?? null,
    userId: session?.user?.id ?? null,
    userName: session?.user?.user_metadata?.full_name || session?.user?.email || null,
    userAvatar: session?.user?.user_metadata?.avatar_url || null,
    loading,
    authLoading,
    authProvider,
    signInWithGoogle,
    signInWithApple,
    signOut,
    deleteAccount,
  };
}
