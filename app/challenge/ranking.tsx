import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ErrorView from '../../components/ErrorView';
import GalaxyBackground from '../../components/GalaxyBackground';
import ScreenHeader from '../../components/ScreenHeader';
import {
  LeaderboardRow, PRIZE_MEDALS, useCurrentChallenge, useLeaderboard, useMyChallengeStats,
} from '../../lib/challenge';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';

const TOP_COLORS: Record<number, string> = { 1: COLORS.gold, 2: '#C9C3E6', 3: '#E8935A' };

/** Pantalla D: ranking publico, solo @usuario y puntos. */
export default function RankingScreen() {
  const { t } = useI18n();
  const { challenge, loading: chLoading } = useCurrentChallenge();
  const id = challenge?.id ?? null;
  const lb = useLeaderboard(id);
  const { stats } = useMyChallengeStats(id);
  const finished = challenge?.status === 'finished';

  // Si mi fila no esta entre las cargadas, la muestro arriba igual.
  const meLoaded = lb.rows.some(r => r.is_me);

  const renderRow = ({ item }: { item: LeaderboardRow }) => {
    const top = item.rank <= 3;
    return (
      <View style={[styles.row, top && { borderColor: TOP_COLORS[item.rank] + '88' }, item.is_me && styles.rowMe]}>
        <Text style={[styles.rank, top && { fontSize: 20 }]}>
          {top ? PRIZE_MEDALS[item.rank] : `${item.rank}.`}
        </Text>
        <Text style={[styles.handle, top && { color: TOP_COLORS[item.rank] }]} numberOfLines={1}>
          @{item.username ?? t('challengeNoHandle')}
          {item.is_me ? `  · ${t('challengeYou')}` : ''}
        </Text>
        <Text style={styles.points}>{t('challengePcsApproved', { n: String(item.points) })}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScreenHeader title={t('challengeRankingTitle')} fallback="/challenge" />

      {chLoading || lb.loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.purple2} />
      ) : lb.error ? (
        <ErrorView message={lb.error} onRetry={lb.reload} />
      ) : (
        <FlatList
          data={lb.rows}
          keyExtractor={r => String(r.rank)}
          renderItem={renderRow}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={{ gap: 10, marginBottom: 6 }}>
              <View style={styles.notice}>
                <Ionicons name={finished ? 'checkmark-circle-outline' : 'time-outline'} size={14} color={COLORS.purple3} />
                <Text style={styles.noticeText}>
                  {finished ? t('challengeRankingFinal') : t('challengeRankingProvisional')}
                </Text>
              </View>
              {!meLoaded && stats?.rank != null && (
                <View style={[styles.row, styles.rowMe]}>
                  <Text style={styles.rank}>{stats.rank}.</Text>
                  <Text style={styles.handle}>{t('challengeYou')}</Text>
                  <Text style={styles.points}>{t('challengePcsApproved', { n: String(stats.points) })}</Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>{t('challengeRankingEmpty')}</Text>}
          ListFooterComponent={
            lb.hasMore ? (
              <TouchableOpacity style={styles.more} onPress={lb.loadMore} disabled={lb.loadingMore} activeOpacity={0.8}>
                {lb.loadingMore
                  ? <ActivityIndicator size="small" color={COLORS.purple3} />
                  : <Text style={styles.moreText}>{t('challengeLoadMore')}</Text>}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  list: { paddingHorizontal: 16, paddingBottom: 60, gap: 8 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noticeText: { flex: 1, fontSize: 11, color: COLORS.textMuted },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: 'rgba(30,12,60,0.7)', borderWidth: 1, borderColor: COLORS.border,
  },
  rowMe: { borderColor: COLORS.purple2, backgroundColor: 'rgba(168,85,247,0.18)' },
  rank: { width: 32, fontSize: 14, fontWeight: '900', color: COLORS.textSecondary, textAlign: 'center' },
  handle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#fff' },
  points: { fontSize: 12, color: COLORS.textSecondary },
  more: { alignItems: 'center', paddingVertical: 14 },
  moreText: { fontSize: 13, fontWeight: '700', color: COLORS.purple3 },
});
