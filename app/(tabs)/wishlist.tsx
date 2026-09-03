import { Image } from 'expo-image';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Animated, Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useWishlist } from '../../hooks/useWishlist';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, MEMBERS, STATUS_CONFIG, STATUS_LABEL_KEY } from '../../lib/constants';
import { getPhotocardUrl } from '../../lib/supabase';
import { PROMO_MODE, getPromoCardImage } from '../../lib/promoMode';
import { CardWithStatus, CardStatus } from '../../lib/types';
import FilterBottomSheet, { FilterSection } from '../../components/FilterBottomSheet';
import GlassCard from '../../components/GlassCard';
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
  const promoImage = PROMO_MODE
    ? getPromoCardImage({ seed: card.id, categoryShort: card.category_short, isWishlist: true })
    : null;

  return (
    <View style={styles.gridItem}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[styles.gridCard, { borderColor }]}
      >
        {promoImage || card.image_path ? (
          <Image
            source={promoImage ?? { uri: getPhotocardUrl(card.image_path!) }}
            style={styles.gridImage}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.gridPlaceholder, { backgroundColor: card.album_color + '33' }]}>
            <Text style={styles.memberInitial}>{card.member?.charAt(0) || '?'}</Text>
          </View>
        )}

        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.bottomGrad} />

        <View style={styles.statusCorner}>
          {status === 'want' ? (
            <Ionicons name="heart" size={17} color={STATUS_CONFIG.want.color} />
          ) : status === 'otw' ? (
            <Ionicons name="cart" size={17} color={STATUS_CONFIG.otw.color} />
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.gridInfo}>
        {card.version_short && (
          <Text style={styles.versionTag}>Ver. {card.version_short}</Text>
        )}
        {card.card_name ? (
          <Text style={styles.gridName} numberOfLines={2}>{card.card_name.toUpperCase()}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Status action popup ─────────────────────────────────────────────────────
function StatusActionModal({
  card, onClose, onSetStatus,
}: {
  card: CardWithStatus | null;
  onClose: () => void;
  onSetStatus: (status: CardStatus) => void;
}) {
  const { t } = useI18n();
  const visible = !!card;
  const status = card?.status as CardStatus | undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.popupBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.popupCard}>
          {card && (
            <>
              {(() => {
                const promoImage = PROMO_MODE
                  ? getPromoCardImage({ seed: card.id, categoryShort: card.category_short, isWishlist: true })
                  : null;
                return (
                  <View style={styles.popupThumbWrap}>
                    {promoImage || card.image_path ? (
                      <Image
                        source={promoImage ?? { uri: getPhotocardUrl(card.image_path!) }}
                        style={styles.popupThumb}
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View style={[styles.popupThumb, styles.gridPlaceholder, { backgroundColor: card.album_color + '33' }]}>
                        <Text style={styles.memberInitial}>{card.member?.charAt(0) || '?'}</Text>
                      </View>
                    )}
                  </View>
                );
              })()}

              <Text style={styles.popupTitle} numberOfLines={1}>{card.card_name}</Text>
              <Text style={styles.popupSub} numberOfLines={1}>{card.member} · {card.album_short}</Text>

              <View style={styles.popupActions}>
                <TouchableOpacity
                  onPress={() => onSetStatus('have')}
                  activeOpacity={0.7}
                  style={[styles.popupBtn, { backgroundColor: 'rgba(74,222,128,0.14)', borderColor: 'rgba(74,222,128,0.4)' }]}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                  <Text style={[styles.popupBtnText, { color: '#4ADE80' }]}>{t(STATUS_LABEL_KEY.have)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSetStatus('want')}
                  activeOpacity={0.7}
                  style={[
                    styles.popupBtn,
                    { backgroundColor: STATUS_CONFIG.want.color + (status === 'want' ? '33' : '14'), borderColor: STATUS_CONFIG.want.color + '55' },
                  ]}
                >
                  <Ionicons name="heart" size={20} color={STATUS_CONFIG.want.color} />
                  <Text style={[styles.popupBtnText, { color: STATUS_CONFIG.want.color }]}>{t(STATUS_LABEL_KEY.want)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSetStatus('otw')}
                  activeOpacity={0.7}
                  style={[
                    styles.popupBtn,
                    { backgroundColor: STATUS_CONFIG.otw.color + (status === 'otw' ? '33' : '14'), borderColor: STATUS_CONFIG.otw.color + '55' },
                  ]}
                >
                  <Ionicons name="cart" size={20} color={STATUS_CONFIG.otw.color} />
                  <Text style={[styles.popupBtnText, { color: STATUS_CONFIG.otw.color }]}>{t(STATUS_LABEL_KEY.otw)}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.popupCloseBtn}>
                <Text style={styles.popupCloseText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
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

  // Group by album
  const grouped = useMemo(() => {
    const groups: Record<string, { color: string; albumId: number; cards: CardWithStatus[] }> = {};
    filtered.forEach(c => {
      if (!groups[c.album_name]) groups[c.album_name] = { color: c.album_color, albumId: c.album_id, cards: [] };
      groups[c.album_name].cards.push(c);
    });
    return groups;
  }, [filtered]);

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
              <View style={styles.pcGrid}>
                {group.cards.map(card => (
                  <WishGridCard
                    key={card.id}
                    card={card}
                    onPress={() => setActiveCard(card)}
                  />
                ))}
              </View>
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

      <StatusActionModal
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
  bottomGrad: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 35,
  },
  statusCorner: {
    position: 'absolute', bottom: 6, right: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  gridInfo: {
    flexDirection: 'column', alignItems: 'center', gap: 3, width: '100%',
  },
  versionTag: {
    fontSize: 10, fontWeight: '800', color: COLORS.purple3, letterSpacing: 0.5,
  },
  gridName: {
    fontSize: 9, fontWeight: '600', color: COLORS.textMuted,
    letterSpacing: 0.3, textAlign: 'center',
  },

  popupBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  popupCard: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#160A30',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  popupThumbWrap: {
    width: 96, height: 144, borderRadius: 12,
    overflow: 'hidden', marginBottom: 14,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
  },
  popupThumb: { width: '100%', height: '100%' },
  popupTitle: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  popupSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 3, marginBottom: 16, textAlign: 'center' },
  popupActions: {
    flexDirection: 'row', gap: 8, width: '100%',
  },
  popupBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
  },
  popupBtnText: { fontSize: 11, fontWeight: '800' },
  popupCloseBtn: { marginTop: 16, paddingVertical: 6, paddingHorizontal: 12 },
  popupCloseText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
});
