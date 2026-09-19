import { Image } from 'expo-image';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useWishlist } from '../../hooks/useWishlist';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, MEMBERS, STATUS_CONFIG, STATUS_LABEL_KEY } from '../../lib/constants';
import { getPhotocardUrl } from '../../lib/supabase';
import { CardWithStatus, CardStatus } from '../../lib/types';
import FilterBottomSheet, { FilterSection } from '../../components/FilterBottomSheet';
import GlassCard from '../../components/GlassCard';
import CardStatusModal from '../../components/CardStatusModal';
import StatusHelpModal from '../../components/StatusHelpModal';
import GalaxyBackground from '../../components/GalaxyBackground';
import ErrorView from '../../components/ErrorView';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../lib/I18nContext';

// ─── Status pill ────────────────────────────────────────────────────────────
const STATUS_ORDER: CardStatus[] = ['want', 'otw'];

// ─── Wishlist grid card ──────────────────────────────────────────────────────
function WishGridCard({
  card, onPress,
}: {
  card: CardWithStatus;
  onPress: () => void;
}) {
  const status = card.status as CardStatus;
  const borderColor = STATUS_CONFIG[status]?.color + '55' || card.album_color + '55';
  return (
    <View style={styles.gridItem}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.gridCard, { borderColor }]}
      >
        {card.image_path ? (
          <Image
            source={{ uri: getPhotocardUrl(card.image_path!) }}
            style={styles.gridImage}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.gridPlaceholder, { backgroundColor: card.album_color + '33' }]}>
            <Text style={styles.memberInitial}>{card.member?.charAt(0) || '?'}</Text>
          </View>
        )}

      </TouchableOpacity>

      <View style={styles.gridInfo}>
        {status === 'want' ? (
          <Ionicons name="heart" size={16} color={STATUS_CONFIG.want.color} />
        ) : status === 'otw' ? (
          <Ionicons name="cart" size={16} color={STATUS_CONFIG.otw.color} />
        ) : null}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function WishlistScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { cards, loading, error, setCardStatus, refetch, silentRefetch } = useWishlist(userId);
  const { t } = useI18n();

  const [statusFilter, setStatusFilter] = useState<'All' | CardStatus>('All');
  const [memberFilter, setMemberFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showStatusHelp, setShowStatusHelp] = useState(false);
  const [activeCard, setActiveCard] = useState<CardWithStatus | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useFocusEffect(useCallback(() => { silentRefetch(); }, [silentRefetch]));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  // Stats
  const counts = useMemo(() => {
    const c: Record<string, number> = { want: 0, otw: 0 };
    cards.forEach(card => {
      if (card.status && card.status in c) c[card.status]++;
    });
    return c;
  }, [cards]);

  const filtered = useMemo(() => {
    let result = cards;
    if (statusFilter !== 'All') result = result.filter(c => c.status === statusFilter);
    if (memberFilter !== 'All') {
      if (memberFilter === 'Group') result = result.filter(c => c.is_group);
      else result = result.filter(c => c.member === memberFilter);
    }
    return result;
  }, [cards, statusFilter, memberFilter]);

  const activeFilterCount = (statusFilter !== 'All' ? 1 : 0) + (memberFilter !== 'All' ? 1 : 0);

  const filterSections = useMemo<FilterSection[]>(() => [
    {
      key: 'status',
      label: 'Estado',
      options: [
        { value: 'All', label: t('filterAll') },
        ...STATUS_ORDER.map(s => ({
          value: s,
          label: `${STATUS_CONFIG[s].icon} ${t(STATUS_LABEL_KEY[s] as any)}`,
        })),
      ],
      value: statusFilter,
      onChange: (v) => setStatusFilter(v as 'All' | CardStatus),
      onHelp: () => {
        setShowFilters(false);
        setTimeout(() => setShowStatusHelp(true), 300);
      },
    },
    {
      key: 'member',
      label: 'Miembro',
      options: [
        { value: 'All', label: t('filterAll') },
        ...MEMBERS.map(m => ({ value: m.name, label: m.name })),
        { value: 'Group', label: t('filterGroup') },
      ],
      value: memberFilter,
      onChange: setMemberFilter,
    },
  ], [statusFilter, memberFilter, t]);

  const handleSetStatus = (status: CardStatus) => {
    if (!activeCard) return;
    setCardStatus(activeCard.id, status);
    setActiveCard(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={[COLORS.pink + '22', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>{t('wishlist')}</Text>
              <Text style={styles.headerSub}>
                {t('photocardsTracked', { n: cards.length })}
              </Text>
            </View>
            <View style={[styles.totalBadge, { borderColor: COLORS.pink + '44' }]}>
              <Text
                style={[styles.totalNum, { color: COLORS.pink }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {cards.length}
              </Text>
              <Text style={styles.totalLabel}>{t('labelTotal')}</Text>
            </View>
          </View>

          {/* Status breakdown */}
          <View style={styles.statsRow}>
            {STATUS_ORDER.map((s, i) => {
              const cfg = STATUS_CONFIG[s];
              return (
                <View key={s} style={[styles.statItem, i < STATUS_ORDER.length - 1 && styles.statItemBorder]}>
                  <Text style={[styles.statValue, { color: cfg.color }]}>{counts[s]}</Text>
                  <Text style={styles.statLabel}>{cfg.icon} {t(STATUS_LABEL_KEY[s] as any)}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Filter bar */}
        {!loading && cards.length > 0 && (
          <View style={styles.filterBarWrap}>
            <View style={styles.filterBar}>
              <TouchableOpacity
                onPress={() => setShowFilters(true)}
                activeOpacity={0.7}
                style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
              >
                <Ionicons
                  name="options-outline"
                  size={15}
                  color={activeFilterCount > 0 ? COLORS.pink : COLORS.textSecondary}
                />
                <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
                  {t('filtersLabel')}
                </Text>
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.filterResultCount}>
                {filtered.length} {t(filtered.length === 1 ? 'cardWordSingular' : 'cardWordPlural')}
              </Text>
            </View>

            {activeFilterCount > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                {statusFilter !== 'All' && (
                  <TouchableOpacity onPress={() => setStatusFilter('All')} activeOpacity={0.7} style={styles.activeChip}>
                    <Text style={styles.activeChipText}>
                      {STATUS_CONFIG[statusFilter].icon} {t(STATUS_LABEL_KEY[statusFilter] as any)}
                    </Text>
                    <Ionicons name="close" size={11} color={COLORS.pink} />
                  </TouchableOpacity>
                )}
                {memberFilter !== 'All' && (
                  <TouchableOpacity onPress={() => setMemberFilter('All')} activeOpacity={0.7} style={styles.activeChip}>
                    <Text style={styles.activeChipText}>{memberFilter}</Text>
                    <Ionicons name="close" size={11} color={COLORS.pink} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.pink} />
            <Text style={styles.loadingText}>{t('loadingWishlist')}</Text>
          </View>
        ) : error ? (
          <ErrorView message={error} onRetry={refetch} />
        ) : cards.length === 0 ? (
          <View style={styles.emptyWrap}>
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="heart-outline" size={52} color={COLORS.purple2} style={{ marginBottom: 14 }} />
              <Text style={styles.emptyTitle}>{t('wishlistEmpty')}</Text>
              <Text style={styles.emptyText}>{t('wishlistEmptyDesc')}</Text>
              <TouchableOpacity
                onPress={() => router.push('/')}
                activeOpacity={0.8}
                style={styles.browseBtn}
              >
                <LinearGradient
                  colors={[COLORS.pink, COLORS.purple1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.browseBtnGrad}
                >
                  <Text style={styles.browseBtnText}>{t('browseAlbums')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </GlassCard>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="search" size={32} color={COLORS.textMuted} />
            <Text style={[styles.emptyText, { marginTop: 10 }]}>{t('noCardsFilter')}</Text>
          </View>
        ) : (
          <View style={styles.flatSection}>
            <View style={styles.pcGrid}>
              {filtered.map(card => (
                <WishGridCard
                  key={card.id}
                  card={card}
                  onPress={() => setActiveCard(card)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <FilterBottomSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        sections={filterSections}
        accentColor={COLORS.pink}
        onReset={() => { setStatusFilter('All'); setMemberFilter('All'); }}
        resultCount={filtered.length}
      />

      <CardStatusModal
        card={activeCard}
        onClose={() => setActiveCard(null)}
        onSetStatus={handleSetStatus}
      />

      <StatusHelpModal visible={showStatusHelp} onClose={() => setShowStatusHelp(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 120 },

  header: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceGlass,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  totalBadge: {
    minWidth: 60, height: 60, borderRadius: 16, paddingHorizontal: 10,
    backgroundColor: COLORS.pink + '22',
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  totalNum: { fontSize: 22, fontWeight: '900' },
  totalLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', marginTop: -2 },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    paddingVertical: 10,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statItemBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginTop: 1 },

  filterBarWrap: { paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(224,64,160,0.12)',
    borderColor: 'rgba(224,64,160,0.35)',
  },
  filterBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  filterBtnTextActive: { color: COLORS.pink },
  filterBadge: {
    backgroundColor: COLORS.pink, borderRadius: 10,
    minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  filterResultCount: {
    flex: 1, textAlign: 'right',
    color: COLORS.textMuted, fontSize: 12, fontWeight: '600',
  },
  chipsRow: { flexDirection: 'row', gap: 6 },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(224,64,160,0.15)',
    borderWidth: 1, borderColor: 'rgba(224,64,160,0.35)',
  },
  activeChipText: { color: COLORS.pink, fontSize: 11, fontWeight: '700' },

  loadingWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  loadingText: { color: COLORS.textMuted, fontSize: 13 },

  emptyWrap: { alignItems: 'center', marginTop: 40, paddingHorizontal: 32 },
  emptyCard: { alignItems: 'center', padding: 32, width: '100%' },
  emptyEmoji: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  emptyText: { color: COLORS.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
  browseBtn: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
  browseBtnGrad: { paddingHorizontal: 24, paddingVertical: 12 },
  browseBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  flatSection: { paddingHorizontal: 16, marginTop: 10 },

  pcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },

  gridItem: {
    width: '31%',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  gridCard: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
  },
  gridImage: { width: '100%', height: '100%' },
  gridPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  memberInitial: { fontSize: 28, fontWeight: '900', color: '#fff' },
  gridInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, width: '100%', minHeight: 18,
  },

});
