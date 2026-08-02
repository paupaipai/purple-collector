import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../lib/I18nContext';
import { COLORS } from '../lib/constants';
import { usePremium } from '../lib/PremiumContext';

interface Props {
  feature?: string;
  children?: React.ReactNode;
  style?: object;
}

export default function PremiumLock({ feature, children, style }: Props) {
  const { isPremium } = usePremium();
  const router = useRouter();
  const { t } = useI18n();

  if (isPremium) return <>{children}</>;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push('/paywall')}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={[COLORS.purple1 + '22', COLORS.pink + '0A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={styles.lockIcon}>
        <Ionicons name="diamond" size={22} color={COLORS.purple3} />
      </View>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{t('premiumLockTitle')}</Text>
        {feature ? <Text style={styles.desc}>{feature}</Text> : null}
      </View>
      <LinearGradient
        colors={[COLORS.purple1, COLORS.pink]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.btn}
      >
        <Text style={styles.btnText}>{t('premiumUnlock')} →</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.purple2 + '44',
    padding: 16,
    gap: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  lockIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: COLORS.purple1 + '33',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.purple2 + '44',
  },
  textGroup: { alignItems: 'center', gap: 3 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  desc: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center' },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 2,
  },
  btnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
