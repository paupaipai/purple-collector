import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GalaxyBackground from '../components/GalaxyBackground';
import GlassCard from '../components/GlassCard';
import { useI18n } from '../lib/I18nContext';
import { COLORS, PREMIUM_ENABLED } from '../lib/constants';
import { usePremium } from '../lib/PremiumContext';
import { TranslationKey } from '../lib/i18n';
import { getOfferings, isPurchasesConfigured, purchasePackage } from '../lib/purchases';

// RevenueCat's default package identifiers for annual/monthly duration packages.
const RC_PACKAGE_ID: Record<string, string> = {
  annual: '$rc_annual',
  monthly: '$rc_monthly',
};

const FEATURES: { icon: string; color: string; key: TranslationKey }[] = [
  { icon: 'bar-chart-outline',  color: COLORS.purple3, key: 'premiumFeatureStats' },
  { icon: 'funnel-outline',     color: COLORS.purple2, key: 'premiumFeatureFilters' },
  { icon: 'people-outline',     color: COLORS.purple4, key: 'premiumFeatureMemberStats' },
];

// lifetime plan removed — only annual and monthly offered
const PLANS: {
  key: string;
  price: string;
  period: TranslationKey;
  savings: string | null;
  highlight: boolean;
  monthlyEquivalent?: string;
  trialKey?: TranslationKey;
}[] = [
  {
    key: 'annual', price: '$19.990 CLP', period: 'premiumPriceAnnual', savings: 'Ahorra 44%', highlight: true,
    monthlyEquivalent: '≈ $1.666/mes',
    trialKey: 'premiumTrialAnnual',
  },
  { key: 'monthly', price: '$2.990 CLP',  period: 'premiumPriceMonthly', savings: null,          highlight: false },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { unlock, isPremium, revoke } = usePremium();
  const { t } = useI18n();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // v1 launch: paywall route is inaccessible while everything is unlocked.
  if (!PREMIUM_ENABLED) {
    return <Redirect href="/" />;
  }

  const handlePurchase = async (plan: string) => {
    if (!isPurchasesConfigured()) {
      // No RevenueCat API key set yet (see lib/purchases.ts) — fall back to the local mock unlock.
      await unlock();
      router.back();
      return;
    }

    setPurchasing(plan);
    try {
      const offering = await getOfferings();
      const pkg = offering?.availablePackages.find(p => p.identifier === RC_PACKAGE_ID[plan]);
      if (!pkg) throw new Error(`No RevenueCat package found for "${plan}" — check offerings/products config`);

      await purchasePackage(pkg);
      router.back();
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert(t('premiumPurchaseErrorTitle'), t('premiumPurchaseErrorBody'));
        console.error('[Purchases] purchase failed:', error);
      }
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />

      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
        <Text style={styles.closeText}>✕</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.gemWrap}>
            <Ionicons name="diamond" size={52} color={COLORS.purple3} />
          </View>
          <Text style={styles.title}>{t('premiumTitle')}</Text>
          <Text style={styles.subtitle}>{t('premiumSubtitle')}</Text>
        </View>

        {/* Features */}
        <GlassCard style={styles.featuresCard}>
          {FEATURES.map(f => (
            <View key={f.key} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={f.icon as any} size={20} color={f.color} />
              </View>
              <Text style={styles.featureText}>{t(f.key)}</Text>
            </View>
          ))}
        </GlassCard>

        {/* Plans */}
        <View style={styles.plans}>
          {PLANS.map(plan => (
            <TouchableOpacity
              key={plan.key}
              activeOpacity={0.8}
              onPress={() => handlePurchase(plan.key)}
              disabled={purchasing !== null}
              style={[styles.planWrap, plan.highlight && styles.planWrapHighlight, purchasing === plan.key && { opacity: 0.6 }]}
            >
              {plan.highlight ? (
                <LinearGradient
                  colors={[COLORS.purple1, COLORS.pink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.planGrad}
                >
                  <PlanContent plan={plan} t={t} />
                </LinearGradient>
              ) : (
                <View style={styles.planFlat}>
                  <PlanContent plan={plan} t={t} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Premium active state */}
        {isPremium && (
          <GlassCard style={styles.activeCard}>
            <Text style={styles.activeText}>{t('premiumBadge')}</Text>
            <TouchableOpacity onPress={revoke} activeOpacity={0.7}>
              <Text style={styles.revokeText}>Revertir (modo test)</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        <Text style={styles.legal}>{t('premiumLegal')}</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

function PlanContent({
  plan, t,
}: {
  plan: typeof PLANS[number];
  t: (key: TranslationKey) => string;
}) {
  return (
    <>
      {plan.savings && (
        <View style={styles.savingsBadge}>
          <Text style={styles.savingsText}>{plan.savings}</Text>
        </View>
      )}
      <View style={styles.planContent}>
        <Text style={styles.planPeriod}>{t(plan.period)}</Text>
        <Text style={styles.planPrice}>{plan.price}</Text>
        {plan.monthlyEquivalent && (
          <Text style={styles.planEquivalent}>{plan.monthlyEquivalent}</Text>
        )}
        {plan.trialKey && (
          <Text style={styles.planTrial}>{t(plan.trialKey)}</Text>
        )}
      </View>
      <Text style={styles.planArrow}>→</Text>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  closeBtn: {
    position: 'absolute',
    top: 56, right: 16, zIndex: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  scroll: { paddingHorizontal: 20, paddingBottom: 50, paddingTop: 8 },

  header: { alignItems: 'center', marginTop: 24, marginBottom: 22 },
  gemWrap: { marginBottom: 10 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, textAlign: 'center' },

  featuresCard: { padding: 20, gap: 14, marginBottom: 20 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIconWrap: { width: 28, alignItems: 'center' },
  featureText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },

  plans: { gap: 10, marginBottom: 20 },
  planWrap: {
    borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  planWrapHighlight: { borderColor: COLORS.purple2 + '66' },
  planGrad: {
    flexDirection: 'row', alignItems: 'center',
    padding: 18, gap: 12,
  },
  planFlat: {
    flexDirection: 'row', alignItems: 'center',
    padding: 18, gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  savingsBadge: {
    position: 'absolute',
    top: 0, right: 48,
    backgroundColor: COLORS.gold,
    paddingHorizontal: 8, paddingVertical: 3,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
  },
  savingsText: { fontSize: 10, fontWeight: '800', color: '#1a0a00' },
  planContent: { flex: 1 },
  planPeriod: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', marginBottom: 3 },
  planPrice: { color: '#fff', fontSize: 20, fontWeight: '900' },
  planEquivalent: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  planTrial: { color: COLORS.gold, fontSize: 11, fontWeight: '700', marginTop: 4 },
  planArrow: { color: 'rgba(255,255,255,0.5)', fontSize: 20 },

  activeCard: { padding: 16, alignItems: 'center', gap: 8, marginBottom: 12 },
  activeText: { color: COLORS.green, fontSize: 14, fontWeight: '700' },
  revokeText: { color: COLORS.textMuted, fontSize: 11 },

  legal: {
    color: COLORS.textMuted, fontSize: 11,
    textAlign: 'center', lineHeight: 16,
  },
});
