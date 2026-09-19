import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ErrorView from '../../components/ErrorView';
import FilterBottomSheet, { FilterSection } from '../../components/FilterBottomSheet';
import GalaxyBackground from '../../components/GalaxyBackground';
import GlassCard from '../../components/GlassCard';
import Photocard from '../../components/Photocard';
import PremiumLock from '../../components/PremiumLock';
import { useAuth } from '../../hooks/useAuth';
import { useCollection } from '../../hooks/useCollection';
import { COLORS, MEMBERS, RARITIES, RARITY_LABEL_KEY } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { usePremium } from '../../lib/PremiumContext';

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.statBadge}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function CollectionScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { cards, loading, error, refetch, silentRefetch } = useCollection(userId);
  const { t } = useI18n();
  const { isPremium } = usePremium();

  const [albumFilter, setAlbumFilter] = useState('All');
  const [memberFilter, setMemberFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useFocusEffect(useCallback(() => { silentRefetch(); }, [silentRefetch]));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const albums = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; short: string; color: string; cover: string | null }>();
    cards.forEach(c => {
      if (!seen.has(c.album_id)) {
        seen.set(c.album_id, { id: c.album_id, name: c.album_name, short: c.album_short, color: c.album_color, cover: c.album_cover });
      }
    });
    return Array.from(seen.values());
  }, [cards]);

  const filtered = useMemo(() => {
    let result = cards;
    if (albumFilter !== 'All') result = result.filter(c => c.album_name === albumFilter);
    if (memberFilter !== 'All') {
      if (memberFilter === 'Group') result = result.filter(c => c.is_group);
      else result = result.filter(c => c.member === memberFilter);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(c =>
        c.card_name.toLowerCase().includes(query) ||
        c.member.toLowerCase().includes(query) ||
        c.album_name.toLowerCase().includes(query)
      );
    }
    return result;
  }, [cards, albumFilter, memberFilter, searchQuery]);

  const rarityCount = useMemo(() => {
    const counts: Record<string, number> = { Common: 0, Rare: 0, 'Ultra Rare': 0, Limited: 0 };
    cards.forEach(c => { counts[c.rarity] = (counts[c.rarity] || 0) + 1; });
    return counts;
  }, [cards]);

  const uniqueMembers = useMemo(() => {
    const seen = new Set<string>();
    cards.forEach(c => { if (!c.is_group) seen.add(c.member); });
    return seen.size;
  }, [cards]);

  const activeFilterCount = (albumFilter !== 'All' ? 1 : 0) + (memberFilter !== 'All' ? 1 : 0);

  const filterSections = useMemo<FilterSection[]>(() => [
    {
      key: 'album',
      label: 'Álbum',
      options: [
        { value: 'All', label: t('filterAllAlbums') },
        ...albums.map(a => ({ value: a.name, label: a.short })),
      ],
      value: albumFilter,
      onChange: setAlbumFilter,
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
  ], [albums, albumFilter, memberFilter, t]);

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={[COLORS.purple1 + '33', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>{t('myCollection')}</Text>
              <Text style={styles.headerSub}>{t('photocardsOwned', { n: cards.length })}</Text>
            </View>
            <View style={styles.totalBadge}>
              <Text style={styles.totalNum} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {cards.length}
              </Text>
              <Text style={styles.totalLabel}>{t('labelTotal')}</Text>
            </View>
          </View>

          {/* Stats row — full for premium, basic for free */}
          <View style={styles.statsRow}>
            <StatBadge value={albums.length} label={t('labelAlbums')} color={COLORS.purple3} />
            <View style={styles.statDivider} />
            {isPremium ? (
              <>
                <StatBadge value={uniqueMembers} label={t('labelMembers')} color={COLORS.pink} />
                <View style={styles.statDivider} />
                <StatBadge value={rarityCount['Ultra Rare'] + rarityCount['Limited']} label={t('labelRarePlus')} color={COLORS.gold} />
              </>
            ) : (
              <TouchableOpacity
                style={styles.statLockArea}
                onPress={() => router.push('/paywall')}
                activeOpacity={0.7}
              >
                <Ionicons name="diamond-outline" size={12} color={COLORS.purple3} />
                <Text style={styles.statLockText}>{t('premiumCTA')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Rarity breakdown — premium only */}
        {cards.length > 0 && (
          isPremium ? (
            <View style={styles.rarityRow}>
              {Object.entries(RARITIES).map(([name, r]) => (
                <GlassCard key={name} style={styles.rarityCard}>
                  <Text style={[styles.raritySymbol, { color: r.color }]}>{r.symbol}</Text>
                  <Text style={[styles.rarityCount, { color: r.color }]}>{rarityCount[name] || 0}</Text>
                  <Text style={styles.rarityName}>
                    {name === 'Ultra Rare' ? 'UR' : t(RARITY_LABEL_KEY[name as keyof typeof RARITY_LABEL_KEY] as any)}
                  </Text>
                </GlassCard>
              ))}
            </View>
          ) : (
            <PremiumLock
              feature={t('premiumFeatureStats')}
              style={styles.lockMargin}
            />
          )
        )}

        {/* Search bar */}
        {!loading && cards.length > 0 && (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={COLORS.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('searchPlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

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
                  color={activeFilterCount > 0 ? COLORS.purple3 : COLORS.textSecondary}
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
                {albumFilter !== 'All' && (
                  <TouchableOpacity onPress={() => setAlbumFilter('All')} activeOpacity={0.7} style={styles.activeChip}>
                    <Text style={styles.activeChipText}>{albumFilter}</Text>
                    <Ionicons name="close" size={11} color={COLORS.purple3} />
                  </TouchableOpacity>
                )}
                {memberFilter !== 'All' && (
                  <TouchableOpacity onPress={() => setMemberFilter('All')} activeOpacity={0.7} style={styles.activeChip}>
                    <Text style={styles.activeChipText}>{memberFilter}</Text>
                    <Ionicons name="close" size={11} color={COLORS.purple3} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.purple2} />
            <Text style={styles.loadingText}>{t('loadingCollection')}</Text>
          </View>
        ) : error ? (
          <ErrorView message={error} onRetry={refetch} />
        ) : cards.length === 0 ? (
          <View style={styles.emptyWrap}>
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="albums-outline" size={52} color={COLORS.purple2} style={{ marginBottom: 14 }} />
              <Text style={styles.emptyTitle}>{t('noCards')}</Text>
              <Text style={styles.emptyText}>{t('noCardsDesc')}</Text>
              <TouchableOpacity onPress={() => router.push('/')} activeOpacity={0.8} style={styles.browseBtn}>
                <LinearGradient
                  colors={[COLORS.purple1, COLORS.pink]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.browseBtnGrad}
                >
                  <Text style={styles.browseBtnText}>{t('browseAlbums')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </GlassCard>
          </View>
        ) : (
          <>
            {filtered.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="search" size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyText}>{t('noCardsFilter')}</Text>
              </View>
            ) : (
              <View style={styles.flatSection}>
                <View style={styles.pcGrid}>
                  {filtered.map(card => (
                    <Photocard
                      key={card.id}
                      card={card}
                      onPress={() => router.push(`/album/${card.album_id}`)}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <FilterBottomSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        sections={filterSections}
        onReset={() => { setAlbumFilter('All'); setMemberFilter('All'); }}
        resultCount={filtered.length}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 40 },

  header: {
    margin: 16, marginBottom: 12,
    borderRadius: 18, overflow: 'hidden',
    padding: 18, borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceGlass,
  },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  totalBadge: {
    minWidth: 60, height: 60, borderRadius: 16, paddingHorizontal: 10,
    backgroundColor: COLORS.purple1 + '66',
    borderWidth: 1.5, borderColor: COLORS.purple2 + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  totalNum: { fontSize: 22, fontWeight: '900', color: COLORS.purple3 },
  totalLabel: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', marginTop: -2 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10, paddingVertical: 10,
  },
  statBadge: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginTop: 1 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.08)' },
  statLockArea: {
    flex: 2, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 5, paddingHorizontal: 8,
  },
  statLockText: { color: COLORS.purple3, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  rarityRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  rarityCard: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  raritySymbol: { fontSize: 16, marginBottom: 2 },
  rarityCount: { fontSize: 15, fontWeight: '900' },
  rarityName: { fontSize: 9, color: COLORS.textMuted, fontWeight: '600', marginTop: 1 },
  lockMargin: { marginHorizontal: 16 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, padding: 0 },

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
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderColor: 'rgba(168,85,247,0.35)',
  },
  filterBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  filterBtnTextActive: { color: COLORS.purple3 },
  filterBadge: {
    backgroundColor: COLORS.purple2, borderRadius: 10,
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
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
  },
  activeChipText: { color: COLORS.purple3, fontSize: 11, fontWeight: '700' },

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

  flatSection: { marginTop: 10, paddingHorizontal: 16 },
  pcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
});
