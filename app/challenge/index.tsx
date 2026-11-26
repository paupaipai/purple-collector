import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChallengePrizes } from '../../components/ChallengeCard';
import ErrorView from '../../components/ErrorView';
import GalaxyBackground from '../../components/GalaxyBackground';
import GlassCard from '../../components/GlassCard';
import { NewsArt } from '../../components/NewsBanner';
import ScreenHeader from '../../components/ScreenHeader';
import { formatChallengeDate, formatPoints, useCurrentChallenge, useMyChallengeStats } from '../../lib/challenge';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';

/** Pantalla B (concurso) con la C (mi participacion) dentro. */
export default function ChallengeScreen() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { challenge, loading, error, refetch } = useCurrentChallenge();
  const { stats } = useMyChallengeStats(challenge?.id ?? null);

  const statusLabel = !challenge ? '' : {
    draft: '', active: t('challengeStatusActive'),
    reviewing: t('challengeStatusReviewing'), finished: t('challengeStatusFinished'),
  }[challenge.status];

  const closeLabel = !challenge ? ''
    : challenge.closed_at ? formatChallengeDate(challenge.closed_at, lang)
    : challenge.ends_at ? formatChallengeDate(challenge.ends_at, lang)
    : t('challengeCloseWhenComplete');

  const pct = challenge && challenge.eligible_count > 0
    ? Math.min(1, challenge.completed_count / challenge.eligible_count) : 0;

  const motivation = !stats ? ''
    : stats.rank != null && stats.rank <= 3 ? t('challengeMotivationTop')
    : Number(stats.points) > 0 ? t('challengeMotivation')
    : t('challengeMotivationStart');

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScreenHeader title={t('challengeScreenTitle')} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.purple2} />
      ) : error ? (
        <ErrorView message={error} onRetry={refetch} />
      ) : !challenge ? (
        <Text style={styles.empty}>{t('challengeNone')}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Encabezado */}
          <View style={styles.hero}>
            <LinearGradient
              colors={['#4a1f8f', '#2c1060', '#1d0a45']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <NewsArt size={1.2} />
            <Text style={styles.heroTitle}>🏆 {challenge.title}</Text>
            <Text style={styles.heroSub}>{t('challengeHeroSubtitle')}</Text>
            <ChallengePrizes challenge={challenge} center />
            <Text style={styles.heroNote}>{t('challengePrizeNote')}</Text>
          </View>

          {/* Mi participacion */}
          {stats && (
            <GlassCard style={[styles.card, styles.mineCard]}>
              <Text style={styles.cardTitle}>💜 {t('challengeMineTitle')}</Text>
              <View style={styles.statsRow}>
                <Stat value={formatPoints(stats.points, lang)} label={t('challengeMineApproved')} color={COLORS.purple3} />
                <Stat value={stats.rank != null ? `#${stats.rank}` : '—'} label={t('challengeMineRank')} color={COLORS.gold} />
                <Stat value={String(stats.pending_cards)} label={t('challengeMinePending')} color={COLORS.pink} />
              </View>
              {stats.incomplete_cards > 0 && (
                <View style={styles.warn}>
                  <Ionicons name="alert-circle-outline" size={14} color={COLORS.gold} />
                  <Text style={styles.warnText}>
                    {t('challengeMineIncomplete', { n: String(stats.incomplete_cards) })}
                  </Text>
                </View>
              )}
              {challenge.status === 'active' && <Text style={styles.motivation}>{motivation}</Text>}
            </GlassCard>
          )}

          {/* Estado del concurso */}
          <GlassCard style={styles.card}>
            <Row icon="pulse-outline" label={t('challengeInfoStatus')} value={statusLabel} />
            <Row icon="calendar-outline" label={t('challengeInfoClose')} value={closeLabel} />
            <Row
              icon="images-outline"
              label={t('challengeInfoCommunity')}
              value={`${challenge.completed_count} / ${challenge.eligible_count}`}
            />
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.max(pct * 100, pct > 0 ? 1 : 0)}%` }]} />
            </View>
          </GlassCard>

          {challenge.status === 'active' && (
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>{t('challengeHowTitle')}</Text>
              <Text style={styles.paragraph}>{t('challengeHowBody')}</Text>
            </GlassCard>
          )}

          <TouchableOpacity style={styles.primary} activeOpacity={0.85} onPress={() => router.push('/challenge/ranking')}>
            <Ionicons name="trophy-outline" size={16} color="#2E1065" />
            <Text style={styles.primaryText}>{t('challengeSeeRanking')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} activeOpacity={0.85} onPress={() => router.push('/challenge/rules')}>
            <Ionicons name="document-text-outline" size={16} color={COLORS.purple3} />
            <Text style={styles.secondaryText}>{t('challengeSeeRules')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={15} color={COLORS.purple3} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 12 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 60 },

  hero: {
    alignItems: 'center', borderRadius: 20, borderWidth: 1.5,
    borderColor: 'rgba(192,132,252,0.55)', paddingVertical: 20, paddingHorizontal: 16, overflow: 'hidden',
  },
  heroTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 12 },
  heroSub: { fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 },
  heroNote: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 10 },

  card: { padding: 16 },
  mineCard: { borderColor: COLORS.borderActive },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  warnText: { flex: 1, fontSize: 12, color: COLORS.gold },
  motivation: { fontSize: 12, color: COLORS.purple3, textAlign: 'center', marginTop: 12, fontWeight: '700' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  rowLabel: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
  rowValue: { fontSize: 13, fontWeight: '800', color: '#fff', flexShrink: 1, textAlign: 'right' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.purple2 },

  paragraph: { fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },

  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, backgroundColor: '#D8B4FE',
  },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#2E1065' },
  secondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: COLORS.borderActive,
  },
  secondaryText: { fontSize: 14, fontWeight: '700', color: COLORS.purple3 },
});
