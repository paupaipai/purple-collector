import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import {
  ActivityIndicator,
  Animated,
  Modal,
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
import NeonBar from '../../components/NeonBar';
import Photocard from '../../components/Photocard';
import { useAuth } from '../../hooks/useAuth';
import { useAlbumCards } from '../../hooks/useCards';
import { COLORS, MEMBER_MAP, MEMBERS, STATUS_CONFIG, STATUS_LABEL_KEY } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { getPhotocardUrl } from '../../lib/supabase';
import { CardStatus, CardWithStatus } from '../../lib/types';

const GROUP_IMAGE = require('../../assets/images/bts/bts.png');

const MEMBER_IMAGES: Record<string, any> = {
  'RM':       require('../../assets/images/bts/rm.png'),
  'Jin':      require('../../assets/images/bts/jin.png'),
  'Suga':     require('../../assets/images/bts/suga.png'),
  'J-Hope':   require('../../assets/images/bts/jhope.png'),
  'Jimin':    require('../../assets/images/bts/jimin.png'),
  'V':        require('../../assets/images/bts/v.png'),
  'Jungkook': require('../../assets/images/bts/jungkook.png'),
};

const HELP_ITEMS = [
  { icon: 'time-outline' as const,             color: COLORS.textMuted, labelKey: 'clearStatus',         descKey: 'statusHelpPending' },
  { icon: 'checkmark-circle-outline' as const, color: '#4ADE80',        labelKey: 'statusHave',          descKey: 'statusHelpHave' },
  { icon: 'heart-outline' as const,            color: '#E040A0',        labelKey: 'statusWant',          descKey: 'statusHelpWant' },
  { icon: 'send-outline' as const,             color: '#60A5FA',        labelKey: 'statusOtw',           descKey: 'statusHelpOtw' },
  { icon: 'close-circle-outline' as const,     color: '#FF6B6B',        labelKey: 'statusNotCollecting', descKey: 'statusHelpNotCollecting' },
] as const;

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { cards, album, loading, error, setCardStatus, clearCardStatus, setDuplicateCount, refetch } = useAlbumCards(Number(id), userId);
  const { t } = useI18n();

  const [memberFilter, setMemberFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardWithStatus | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Track completion to trigger celebration
  const prevOwnedRef = useRef<number | null>(null);
  const celebrationScale = useRef(new Animated.Value(0.7)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    cards.forEach(c => { if (!seen.has(c.category_name)) seen.set(c.category_name, c.category_short); });
    return Array.from(seen, ([name, short]) => ({ name, short }));
  }, [cards]);

  const filtered = useMemo(() => {
    let result = cards;
    if (memberFilter !== 'All') result = result.filter(c => c.member === memberFilter);
    if (categoryFilter !== 'All') result = result.filter(c => c.category_name === categoryFilter);
    if (statusFilter === 'none') result = result.filter(c => c.status === null);
    else if (statusFilter !== 'All') result = result.filter(c => c.status === statusFilter);
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(c =>
        c.card_name.toLowerCase().includes(query) ||
        c.member.toLowerCase().includes(query) ||
        c.category_name.toLowerCase().includes(query)
      );
    }
    return result;
  }, [cards, memberFilter, categoryFilter, statusFilter, searchQuery]);

  const grouped = useMemo(() => {
    const groups: Record<string, CardWithStatus[]> = {};
    filtered.forEach(c => {
      if (!groups[c.category_name]) groups[c.category_name] = [];
      groups[c.category_name].push(c);
    });
    return groups;
  }, [filtered]);

  const activeFilterCount = (categoryFilter !== 'All' ? 1 : 0) + (statusFilter !== 'All' ? 1 : 0) + (memberFilter !== 'All' ? 1 : 0);

  const filterSections = useMemo<FilterSection[]>(() => [
    {
      key: 'category',
      label: 'Categoría',
      options: [
        { value: 'All', label: t('filterAll') },
        ...categories.map(c => ({ value: c.name, label: c.name })),
      ],
      value: categoryFilter,
      onChange: setCategoryFilter,
    },
    {
      key: 'status',
      label: 'Estado',
      options: [
        { value: 'All', label: t('filterAll') },
        ...(Object.keys(STATUS_LABEL_KEY) as Array<keyof typeof STATUS_LABEL_KEY>).map(s => ({
          value: s,
          label: t(STATUS_LABEL_KEY[s] as any),
        })),
        { value: 'none', label: t('statusNone') },
      ],
      value: statusFilter,
      onChange: setStatusFilter,
      onHelp: () => setShowHelp(true),
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
  ], [categories, categoryFilter, statusFilter, memberFilter, t]);

  const albumName = cards[0]?.album_name || album?.name || 'Album';
  const albumShort = cards[0]?.album_short || album?.short_name || '';
  const albumColor = cards[0]?.album_color || album?.color || COLORS.purple2;
  const albumCover = cards[0]?.album_cover || album?.cover_image_url || null;
  const totalOwned = cards.filter(c => c.status === 'have').length;

  // Completion celebration trigger
  useEffect(() => {
    if (!loading && cards.length > 0) {
      if (
        prevOwnedRef.current !== null &&
        totalOwned === cards.length &&
        prevOwnedRef.current < totalOwned
      ) {
        setShowCelebration(true);
        Animated.parallel([
          Animated.spring(celebrationScale, { toValue: 1, useNativeDriver: true, speed: 12 }),
          Animated.timing(celebrationOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }
      prevOwnedRef.current = totalOwned;
    }
  }, [totalOwned, cards.length, loading]);

  const handleStatusSelect = (status: CardStatus) => {
    if (!selectedCard) return;
    setCardStatus(selectedCard.id, status);
    setSelectedCard(null);
  };

  const closeCelebration = () => {
    Animated.timing(celebrationOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setShowCelebration(false);
      celebrationScale.setValue(0.7);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />

      {/* Header fijo */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.albumTitle} numberOfLines={1}>{albumName}</Text>
          <Text style={styles.albumArtist}>BTS</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Album cover + stats */}
        <View style={styles.coverSection}>
          <View style={styles.coverOuter}>
            <LinearGradient
              colors={[albumColor + '33', albumColor + '11', 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={[styles.coverBox, { borderColor: albumColor + '44' }]}>
              {albumCover ? (
                <Image
                  source={{ uri: getPhotocardUrl(albumCover) }}
                  style={{ width: '100%', height: '100%', borderRadius: 13 }}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={150}
                />
              ) : (
                <>
                  <Text style={[styles.coverText, { color: albumColor }]}>{albumShort}</Text>
                  <Text style={styles.coverSub}>BTS</Text>
                </>
              )}
            </View>
          </View>

          <Text style={styles.countText}>
            {t('photocardsOf', { owned: totalOwned, total: cards.length })}
          </Text>

          <View style={styles.barWrap}>
            <NeonBar
              value={totalOwned}
              max={cards.length}
              height={6}
              color={totalOwned === cards.length && cards.length > 0 ? COLORS.gold : undefined}
            />
          </View>
        </View>

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
                color={activeFilterCount > 0 ? albumColor : COLORS.textSecondary}
              />
              <Text style={[styles.filterBtnText, activeFilterCount > 0 && { color: albumColor }]}>
                Filtros
              </Text>
              {activeFilterCount > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: albumColor }]}>
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
              {categoryFilter !== 'All' && (
                <TouchableOpacity onPress={() => setCategoryFilter('All')} activeOpacity={0.7} style={[styles.activeChip, { borderColor: albumColor + '55', backgroundColor: albumColor + '18' }]}>
                  <Text style={[styles.activeChipText, { color: albumColor }]}>{categoryFilter}</Text>
                  <Ionicons name="close" size={11} color={albumColor} />
                </TouchableOpacity>
              )}
              {statusFilter !== 'All' && (
                <TouchableOpacity onPress={() => setStatusFilter('All')} activeOpacity={0.7} style={[styles.activeChip, { borderColor: albumColor + '55', backgroundColor: albumColor + '18' }]}>
                  <Text style={[styles.activeChipText, { color: albumColor }]}>
                    {statusFilter === 'none' ? t('statusNone') : t(STATUS_LABEL_KEY[statusFilter as keyof typeof STATUS_LABEL_KEY] as any)}
                  </Text>
                  <Ionicons name="close" size={11} color={albumColor} />
                </TouchableOpacity>
              )}
              {memberFilter !== 'All' && (
                <TouchableOpacity onPress={() => setMemberFilter('All')} activeOpacity={0.7} style={[styles.activeChip, { borderColor: albumColor + '55', backgroundColor: albumColor + '18' }]}>
                  <Text style={[styles.activeChipText, { color: albumColor }]}>{memberFilter}</Text>
                  <Ionicons name="close" size={11} color={albumColor} />
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.purple2} style={{ marginTop: 40 }} />
        ) : error ? (
          <ErrorView message={error} onRetry={refetch} />
        ) : (
          Object.entries(grouped).map(([catName, catCards]) => {
            const catOwned = catCards.filter(c => c.status === 'have').length;
            return (
              <View key={catName} style={styles.catSection}>
                <View style={styles.catHeader}>
                  <LinearGradient
                    colors={['#E040A0', '#C03090']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.catBadge}
                  >
                    <Text style={styles.catBadgeText}>{catName.toUpperCase()}</Text>
                  </LinearGradient>
                  <Text style={styles.catCount}>{catOwned} {t('wordOf')} {catCards.length}</Text>
                </View>
                <View style={styles.catBarWrap}>
                  <NeonBar value={catOwned} max={catCards.length} height={3} />
                </View>
                <View style={styles.pcGrid}>
                  {catCards.map(card => (
                    <Photocard
                      key={card.id}
                      card={card}
                      onPress={() => setSelectedCard(card)}
                    />
                  ))}
                </View>
              </View>
            );
          })
        )}

        {!loading && filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="search" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('noCardsFilter')}</Text>
          </View>
        )}
      </ScrollView>

      <FilterBottomSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        sections={filterSections}
        accentColor={albumColor}
        onReset={() => { setCategoryFilter('All'); setStatusFilter('All'); setMemberFilter('All'); }}
        resultCount={filtered.length}
      />

      {/* Status picker modal */}
      <Modal
        visible={!!selectedCard}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedCard(null)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSelectedCard(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            {selectedCard && (
              <>
                <View style={styles.sheetHandle} />
                <View style={styles.sheetHeader}>
                  <View style={[
                    styles.sheetMemberDot,
                    { borderColor: MEMBER_MAP[selectedCard.member]?.colors[1] || COLORS.purple2 },
                  ]}>
                    {selectedCard.is_group ? (
                      <Image source={GROUP_IMAGE} style={styles.sheetMemberImg} contentFit="contain" />
                    ) : MEMBER_IMAGES[selectedCard.member] ? (
                      <Image source={MEMBER_IMAGES[selectedCard.member]} style={styles.sheetMemberImg} contentFit="cover" />
                    ) : (
                      <Text style={styles.sheetMemberInitial}>{selectedCard.member?.charAt(0) || '?'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetMember}>{selectedCard.member}</Text>
                    <Text style={styles.sheetCardName} numberOfLines={1}>{selectedCard.card_name}</Text>
                    <Text style={styles.sheetAlbum}>{selectedCard.album_short} · {selectedCard.category_short}</Text>
                  </View>
                </View>
                <View style={styles.sheetDivider} />
                {/* Falta — estado inicial (borra la fila) */}
                {(() => {
                  const isActive = selectedCard.status === null;
                  return (
                    <TouchableOpacity
                      style={[styles.statusRow, isActive && { backgroundColor: 'rgba(139,112,170,0.12)' }]}
                      onPress={() => { clearCardStatus(selectedCard.id); setSelectedCard(null); }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.statusIcon, { backgroundColor: 'rgba(139,112,170,0.15)', borderColor: 'rgba(139,112,170,0.3)' }]}>
                        <Text style={[styles.statusIconText, { color: COLORS.textMuted }]}>○</Text>
                      </View>
                      <Text style={[styles.statusLabel, { color: isActive ? COLORS.textSecondary : '#fff' }]}>{t('clearStatus')}</Text>
                      {isActive && <Text style={[styles.statusCheck, { color: COLORS.textMuted }]}>✓</Text>}
                    </TouchableOpacity>
                  );
                })()}
                {(Object.entries(STATUS_CONFIG) as [CardStatus, typeof STATUS_CONFIG[CardStatus]][]).map(([key, cfg]) => {
                  const isActive = selectedCard.status === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.statusRow, isActive && { backgroundColor: cfg.color + '18' }]}
                      onPress={() => handleStatusSelect(key)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.statusIcon, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
                        {key === 'otw'
                          ? <Ionicons name="cart-outline" size={20} color={cfg.color} />
                          : <Text style={[styles.statusIconText, { color: cfg.color }]}>{cfg.icon}</Text>}
                      </View>
                      <Text style={[styles.statusLabel, { color: isActive ? cfg.color : '#fff' }]}>{t(STATUS_LABEL_KEY[key] as any)}</Text>
                      {isActive && <Text style={[styles.statusCheck, { color: cfg.color }]}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}

                {/* Duplicate count stepper — only when status is 'have' */}
                {selectedCard.status === 'have' && (
                  <>
                    <View style={styles.sheetDivider} />
                    <View style={styles.dupRow}>
                      <View style={styles.dupLabelWrap}>
                        <Text style={styles.dupLabel}>Duplicados</Text>
                        <Text style={styles.dupSub}>
                          {selectedCard.duplicate_count === 0
                            ? '1 copia'
                            : `${selectedCard.duplicate_count + 1} copias`}
                        </Text>
                      </View>
                      <View style={styles.dupStepper}>
                        <TouchableOpacity
                          style={[styles.dupBtn, selectedCard.duplicate_count === 0 && styles.dupBtnDisabled]}
                          onPress={() => {
                            const next = selectedCard.duplicate_count - 1;
                            setDuplicateCount(selectedCard.id, next);
                            setSelectedCard(prev => prev ? { ...prev, duplicate_count: Math.max(0, next) } : null);
                          }}
                          disabled={selectedCard.duplicate_count === 0}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dupBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.dupCount}>{selectedCard.duplicate_count}</Text>
                        <TouchableOpacity
                          style={styles.dupBtn}
                          onPress={() => {
                            const next = selectedCard.duplicate_count + 1;
                            setDuplicateCount(selectedCard.id, next);
                            setSelectedCard(prev => prev ? { ...prev, duplicate_count: next } : null);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.dupBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </>
                )}
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>


      {/* Status help modal */}
      <Modal
        visible={showHelp}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHelp(false)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setShowHelp(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.helpHeader}>
              <Text style={styles.helpTitle}>{t('statusHelpTitle')}</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)} activeOpacity={0.7} style={styles.helpCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            {HELP_ITEMS.map(item => (
              <View key={item.labelKey} style={styles.helpRow}>
                <View style={[styles.helpIconWrap, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}>
                  <Ionicons name={item.icon} size={20} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.helpRowTitle}>{t(item.labelKey as any)}</Text>
                  <Text style={styles.helpRowDesc}>{t(item.descKey as any)}</Text>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => setShowHelp(false)} activeOpacity={0.8} style={styles.helpBtn}>
              <LinearGradient
                colors={[COLORS.pink, COLORS.purple1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.helpBtnGrad}
              >
                <Text style={styles.helpBtnText}>{t('statusHelpGotIt')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Album completion celebration */}
      <Modal visible={showCelebration} transparent animationType="none" onRequestClose={closeCelebration}>
        <TouchableOpacity style={styles.celebBackdrop} activeOpacity={1} onPress={closeCelebration}>
          <Animated.View style={[
            styles.celebSheet,
            { opacity: celebrationOpacity, transform: [{ scale: celebrationScale }] },
          ]}>
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.celebInner}>
                <LinearGradient
                  colors={['rgba(28,10,60,0.98)', 'rgba(55,15,80,0.96)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.celebGrad}
                >
                  <View style={styles.celebTrophyWrap}>
                    <Ionicons name="trophy" size={64} color="#FFD700" />
                  </View>
                  <Text style={styles.celebTitle}>{t('celebrationTitle')}</Text>
                  <Text style={styles.celebDesc}>{t('celebrationDesc')}</Text>
                  <TouchableOpacity onPress={closeCelebration} activeOpacity={0.8} style={styles.celebBtn}>
                    <LinearGradient
                      colors={[COLORS.pink, COLORS.purple1]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.celebBtnGrad}
                    >
                      <Text style={styles.celebBtnText}>{t('celebrationClose')}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 40 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, marginTop: 6, marginBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  backText: { color: COLORS.purple3, fontSize: 18 },
  albumTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  albumArtist: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  coverSection: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 16 },
  coverOuter: { width: 140, height: 140, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverBox: {
    width: 130, height: 130, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  coverText: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  coverSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '600' },
  countText: { fontSize: 15, color: '#fff', fontWeight: '700', marginTop: 16, marginBottom: 10 },
  barWrap: { width: '75%' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14, padding: 0 },

  filterBarWrap: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  filterBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  filterBadge: {
    borderRadius: 10, minWidth: 18, height: 18,
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
    borderRadius: 8, borderWidth: 1,
  },
  activeChipText: { fontSize: 11, fontWeight: '700' },

  catSection: { marginTop: 20, paddingHorizontal: 16 },
  catHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  catBadge: {
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 4,
    shadowColor: COLORS.pink, shadowOpacity: 0.4, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  catBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  catCount: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  catBarWrap: { marginBottom: 12 },
  pcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  emptyWrap: { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },


  // Status picker
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#160A30',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)', borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 16 },
  sheetMemberDot: { width: 74, height: 74, borderRadius: 37, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,112,170,0.2)', borderWidth: 2.5 },
  sheetMemberImg: { width: 62, height: 62 },
  sheetMemberEmoji: { fontSize: 26 },
  sheetMemberInitial: { fontSize: 22, fontWeight: '900', color: '#fff' },
  sheetMember: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sheetCardName: { color: COLORS.textSecondary, fontSize: 12, marginTop: 1 },
  sheetAlbum: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  sheetDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
  statusIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusIconText: { fontSize: 16, fontWeight: '700' },
  statusLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  statusCheck: { fontSize: 16, fontWeight: '900' },

  dupRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  dupLabelWrap: { gap: 2 },
  dupLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  dupSub: { color: COLORS.textMuted, fontSize: 11 },
  dupStepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dupBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.purple1 + '55',
    borderWidth: 1, borderColor: COLORS.purple2 + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  dupBtnDisabled: { opacity: 0.3 },
  dupBtnText: { color: COLORS.purple3, fontSize: 18, fontWeight: '800' },
  dupCount: { color: '#fff', fontSize: 20, fontWeight: '900', minWidth: 24, textAlign: 'center' },

  // Status help modal
  helpHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 16,
  },
  helpTitle: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 },
  helpCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  helpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  helpIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  helpRowTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  helpRowDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  helpBtn: { marginHorizontal: 20, marginTop: 20, marginBottom: 8, borderRadius: 14, overflow: 'hidden' },
  helpBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  helpBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // Celebration modal
  celebBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  celebSheet: {
    width: '100%', borderRadius: 28,
    borderWidth: 1, borderColor: 'rgba(224,64,160,0.35)',
    shadowColor: COLORS.purple2, shadowOpacity: 0.7, shadowRadius: 40, shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  celebInner: { borderRadius: 27, overflow: 'hidden' },
  celebGrad: { padding: 36, alignItems: 'center', gap: 12 },
  celebTrophyWrap: {
    shadowColor: '#FFD700', shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 0 },
    marginBottom: 4,
  },
  celebTitle: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  celebDesc: { fontSize: 14, color: 'rgba(255,255,255,0.72)', textAlign: 'center', lineHeight: 21 },
  celebBtn: { marginTop: 8, borderRadius: 14, overflow: 'hidden', width: '100%' },
  celebBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  celebBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
