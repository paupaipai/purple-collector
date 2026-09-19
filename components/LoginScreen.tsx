import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';

interface LoginScreenProps {
  onGoogleSignIn: () => void;
  onAppleSignIn: () => void;
  loading: 'google' | 'apple' | null;
}

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; color: string; key: 'loginFeature1' | 'loginFeature2' | 'loginFeature3' }[] = [
  { icon: 'phone-portrait-outline', color: COLORS.purple3,  key: 'loginFeature1' },
  { icon: 'heart-outline',          color: COLORS.pink,     key: 'loginFeature2' },
  { icon: 'bar-chart-outline',      color: COLORS.gold,     key: 'loginFeature3' },
];

export default function LoginScreen({ onGoogleSignIn, onAppleSignIn, loading }: LoginScreenProps) {
  const { t } = useI18n();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <Image
          source={require('../assets/images/adaptive-icon.png')}
          style={styles.logo}
          contentFit="contain"
        />

        <Text style={styles.brand}>PURPLE COLLECTOR</Text>
        <Text style={styles.subtitle}>{t('loginTagline')}</Text>

        <View style={styles.tagline}>
          <Text style={styles.taglineText}>{t('loginDescription')}</Text>
        </View>

        {/* Apple Sign In Button — required by Apple guideline 4.8 alongside Google.
            Custom button instead of AppleAuthentication.AppleAuthenticationButton:
            the native one is localized by the *device* language and ignores the
            in-app ES/EN toggle, so it read "Iniciar sesion con Apple" inside an
            otherwise English app. Apple allows a custom button as long as it keeps
            their logo, one of their approved titles (see loginButtonApple) and a
            black-on-white scheme — here at the same size/radius as Google's. */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[styles.authBtn, styles.appleBtn, loading === 'google' && styles.btnDimmed]}
            onPress={() => { if (!loading) onAppleSignIn(); }}
            activeOpacity={0.8}
            disabled={!!loading}
          >
            <Ionicons name="logo-apple" size={22} color="#000" style={styles.appleLogo} />
            {loading === 'apple' ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.appleBtnText}>{t('loginButtonApple')}</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Google Sign In Button */}
        <TouchableOpacity
          style={[styles.authBtn, loading === 'apple' && styles.btnDimmed]}
          onPress={onGoogleSignIn}
          activeOpacity={0.8}
          disabled={!!loading}
        >
          <View style={styles.googleIconWrap}>
            <Text style={styles.googleIcon}>G</Text>
          </View>
          {loading === 'google' ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <Text style={styles.googleBtnText}>{t('loginButton')}</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('loginDivider')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Features */}
        <View style={styles.features}>
          {FEATURES.map(f => (
            <View key={f.key} style={styles.featureItem}>
              <View style={[styles.featureIconWrap, { backgroundColor: f.color + '22', borderColor: f.color + '44' }]}>
                <Ionicons name={f.icon} size={18} color={f.color} />
              </View>
              <Text style={styles.featureText}>{t(f.key)}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 8,
  },
  brand: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.purple3,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 24,
    marginBottom: 36,
  },
  taglineText: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Shared by both providers so they stay identical in size and radius, which
  // is what Apple's guideline asks for when their button sits next to others.
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  appleBtn: {
    marginBottom: 12,
  },
  // The glyph box leaves more air under the mark than over it, so it reads low
  // against the text without this nudge.
  appleLogo: {
    marginTop: -3,
  },
  appleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  btnDimmed: {
    opacity: 0.5,
  },
  googleIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
    width: '100%',
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  features: {
    gap: 12,
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 12, 60, 0.5)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.1)',
  },
  featureIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  featureText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
