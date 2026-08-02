import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
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

        {/* Apple Sign In Button — required by Apple guideline 4.8 alongside Google,
            must use the official component/style, same width/height/radius as Google's. */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={[styles.appleBtn, loading === 'google' && styles.btnDimmed]}
            onPress={() => { if (!loading) onAppleSignIn(); }}
          />
        )}

        {/* Google Sign In Button */}
        <TouchableOpacity
          style={[styles.googleBtn, loading === 'apple' && styles.btnDimmed]}
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

      {/* Bottom quote */}
      <View style={styles.quoteRow}>
        <Ionicons name="heart" size={11} color={COLORS.purple3} style={{ opacity: 0.7 }} />
        <Text style={styles.quote}>{t('loginQuote')}</Text>
        <Ionicons name="heart" size={11} color={COLORS.purple3} style={{ opacity: 0.7 }} />
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
  appleBtn: {
    width: '100%',
    height: 50,
    marginBottom: 12,
  },
  btnDimmed: {
    opacity: 0.5,
  },
  googleBtn: {
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
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 40,
  },
  quote: {
    color: COLORS.purple3,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.7,
  },
});
