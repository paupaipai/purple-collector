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
import GalaxyBackground from '../../components/GalaxyBackground';
import ErrorView from '../../components/ErrorView';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../lib/I18nContext';

// ─── Status pill ────────────────────────────────────────────────────────────
const STATUS_ORDER: CardStatus[] = ['want', 'otw'];

function StatusChip({ status }: { status: CardStatus }) {
  const cfg = STATUS_CONFIG[status];
  const { t } = useI18n();
  return (
    <View style={[styles.statusChip, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
      <Text style={[styles.statusChipText, { color: cfg.color }]}>{cfg.icon} {t(STATUS_LABEL_KEY[status] as any)}</Text>
    </View>
  );
}

// ─── Wishlist card row ───────────────────────────────────────────────────────
function WishCard({
  card, onStatusPress, onMarkHave,
}: {
  card: CardWithStatus;
  onStatusPress: (card: CardWithStatus) => void;
  onMarkHave: (card: CardWithStatus) => void;
}) {
  return (
    <View style={styles.wishRow}>
      {/* Color stripe */}
      <View style={[styles.stripe, { backgroundColor: card.album_color }]} />

      <View style={styles.wishContent}>
        <View style={styles.wishMain}>
          <View style={[styles.cardThumb, { borderColor: card.album_color + '55' }]}>
            {card.image_path ? (
              <Image
                source={{ uri: getPhotocardUrl(card.image_path) }}
                style={styles.cardThumbImg}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.cardThumbPlaceholder, { backgroundColor: card.album_color + '33' }]}>
                <Text style={styles.memberInitial}>{card.member?.charAt(0) || '?'}</Text>
              </View>
            )}
          </View>

          <View style={styles.wishInfo}>
            <Text style={styles.wishMember} numberOfLines={1}>{card.member}</Text>
            <Text style={styles.wishName} numberOfLines={1}>{card.card_name}</Text>
            <Text style={styles.wishAlbum} numberOfLines={1}>
              {card.album_short} · {card.category_short}
            </Text>
          </View>
        </View>

        <View style={styles.rowActions}>
          {/* Mark as have */}
          <TouchableOpacity onPress={() => onMarkHave(card)} activeOpacity={0.7} style={styles.gotItBtn}>
            <Text style={styles.gotItText}>+ Tengo</Text>
          </TouchableOpacity>

          {/* Tap to cycle status */}
          <TouchableOpacity onPress={() => onStatusPress(card)} activeOpacity={0.7}>
            <StatusChip status={card.status!} />
          </TouchableOpacity>
        </View>
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

  // Group by album
  const grouped = useMemo(() => {
    const groups: Record<string, { color: string; albumId: number; cards: CardWithStatus[] }> = {};
    filtered.forEach(c => {
      if (!groups[c.album_name]) groups[c.album_name] = { color: c.album_color, albumId: c.album_id, cards: [] };
      groups[c.album_name].cards.push(c);
    });
    return groups;
  }, [filtered]);

  const handleStatusPress = (card: CardWithStatus) => {
    const idx = STATUS_ORDER.indexOf(card.status as CardStatus);
    const next = STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
    setCardStatus(card.id, next);
  };

  const handleMarkHave = (card: CardWithStatus) => {
    setCardStatus(card.id, 'have');
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
              <Text style={[styles.totalNum, { color: COLORS.pink }]}>{cards.length}</Text>
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
                  <Text style={styles.statLabel}>{cfg.icon} {cfg.label}</Text>
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
                  Filtros
                </Text>
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.filterResultCount}>
                {filtered.length} {filtered.length === 1 ? 'carta' : 'cartas'}
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
          Object.entries(grouped).map(([albumName, group]) => (
            <View key={albumName} style={styles.albumSection}>
              {/* Album header */}
              <TouchableOpacity
                onPress={() => router.push(`/album/${group.albumId}`)}
                activeOpacity={0.7}
                style={styles.albumGroupHeader}
              >
                <View style={[styles.albumColorDot, { backgroundColor: group.color }]} />
                <Text style={styles.albumGroupName} numberOfLines={1}>{albumName}</Text>
                <View style={[styles.albumCountBadge, { borderColor: group.color + '44' }]}>
                  <Text style={[styles.albumGroupCount, { color: group.color }]}>{group.cards.length}</Text>
                </View>
                <Text style={styles.albumArrow}>›</Text>
              </TouchableOpacity>

              {/* Cards */}
              <GlassCard style={styles.cardList}>
                {group.cards.map((card, i) => (
                  <View key={card.id}>
                    <WishCard card={card} onStatusPress={handleStatusPress} onMarkHave={handleMarkHave} />
                    {i < group.cards.length - 1 && <View style={styles.rowDivider} />}
                  </View>
                ))}
              </GlassCard>
            </View>
          ))
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
    width: 60, height: 60, borderRadius: 16,
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

  albumSection: { paddingHorizontal: 16, marginTop: 18 },
  albumGroupHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8, marginBottom: 8,
  },
  albumColorDot: { width: 8, height: 8, borderRadius: 4 },
  albumGroupName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '800' },
  albumCountBadge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  albumGroupCount: { fontSize: 11, fontWeight: '800' },
  albumArrow: { color: COLORS.textMuted, fontSize: 18 },

  cardList: { padding: 0, overflow: 'hidden' },
  rowDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginLeft: 56 },

  wishRow: { flexDirection: 'row', alignItems: 'center' },
  stripe: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginRight: 0 },
  wishContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wishMain: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  cardThumb: {
    width: 40, height: 60, borderRadius: 6,
    overflow: 'hidden', borderWidth: 1.5,
  },
  cardThumbImg: { width: '100%', height: '100%' },
  cardThumbPlaceholder: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },
  memberInitial: { fontSize: 16, fontWeight: '900', color: '#fff' },
  wishInfo: { flex: 1 },
  wishMember: { fontSize: 13, fontWeight: '800', color: '#fff' },
  wishName: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  wishAlbum: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },

  statusChip: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 7, borderWidth: 1,
  },
  statusChipText: { fontSize: 10, fontWeight: '800' },

  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gotItBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(74, 222, 128, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gotItText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '800',
  },
});
