import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import CardStatusModal from '../../components/CardStatusModal';
import ImageCropper, { CropRect } from '../../components/ImageCropper';
import StatusHelpModal from '../../components/StatusHelpModal';
import { useAuth } from '../../hooks/useAuth';
import { useAlbumCards } from '../../hooks/useCards';
import { CARD_SUBMISSIONS_ENABLED, COLORS, MEMBERS, STATUS_LABEL_KEY, CONTRIBUTIONS_ENABLED } from '../../lib/constants';
import type { ImagePickerAsset } from 'expo-image-picker';
import {
  ContributionFailure, fetchMyPendingContributions, pickContributionImage, submitContribution,
} from '../../lib/contributions';
import { fetchMyReportedImages, submitImageReport } from '../../lib/reports';
import { useDialog } from '../../lib/DialogContext';
import { useI18n } from '../../lib/I18nContext';
import { getPhotocardUrl } from '../../lib/supabase';
import { CardStatus, CardWithStatus, ReportReason } from '../../lib/types';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const {
    cards, album, loading, error,
    setCardStatus, clearCardStatus, setDuplicateCount, refetch, silentRefetch,
  } = useAlbumCards(Number(id), userId);

  // Al volver de moderar: aprobar una imagen o una card nueva cambia lo que
  // esta grilla tiene que mostrar, y sin esto el album se quedaba con lo que
  // habia cargado al abrirlo. Silencioso para que no parpadee.
  useFocusEffect(useCallback(() => { silentRefetch(); }, [silentRefetch]));
  const { t } = useI18n();
  const { alert } = useDialog();

  const [memberFilter, setMemberFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardWithStatus | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  // card_id con una aportacion propia sin resolver. Vacio y sin consultar
  // mientras CONTRIBUTIONS_ENABLED este en false.
  const [pendingContrib, setPendingContrib] = useState<Set<number>>(new Set());
  // card_images.id que esta persona ya reporto, para no ofrecerlo dos veces.
  const [reported, setReported] = useState<Set<number>>(new Set());
  // Foto elegida esperando encuadre. Guarda tambien la card, porque el modal de
  // la card se cierra al abrir el cropper.
  const [cropping, setCropping] = useState<{ asset: ImagePickerAsset; cardId: number } | null>(null);

  // Track completion to trigger celebration
  const prevOwnedRef = useRef<number | null>(null);
  const celebrationScale = useRef(new Animated.Value(0.7)).current;
  const celebrationOpacity = useRef(new Animated.Value(0)).current;

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    cards.forEach(c => { if (!seen.has(c.category_name)) seen.set(c.category_name, c.category_short); });
    return Array.from(seen, ([name, short]) => ({ name, short }));
  }, [cards]);

  useEffect(() => {
    if (!CONTRIBUTIONS_ENABLED || !userId || cards.length === 0) return;
    let cancelled = false;
    fetchMyPendingContributions(userId, cards.map(c => c.id)).then(set => {
      if (!cancelled) setPendingContrib(set);
    });
    return () => { cancelled = true; };
    // cards.length y no cards: el array se recrea en cada cambio de estado de
    // una carta, y no hace falta recargar las aportaciones por eso.
  }, [userId, id, cards.length]);

  useEffect(() => {
    if (!userId || cards.length === 0) return;
    let cancelled = false;
    const imageIds = cards
      .map(c => c.primary_image_id)
      .filter((v): v is number => v != null);
    fetchMyReportedImages(userId, imageIds).then(set => {
      if (!cancelled) setReported(set);
    });
    return () => { cancelled = true; };
  }, [userId, id, cards.length]);

  const REPORT_REASONS: { value: ReportReason; key: string }[] = [
    { value: 'copyright', key: 'reportCopyright' },
    { value: 'wrong_card', key: 'reportWrongCard' },
    { value: 'inappropriate', key: 'reportInappropriate' },
    { value: 'low_quality', key: 'reportLowQuality' },
  ];

  const handleReport = () => {
    const card = selectedCard;
    if (!card || card.primary_image_id == null) return;
    const imageId = card.primary_image_id;

    // La ficha se cierra ANTES de preguntar. Es un <Modal> de React Native, o
    // sea una presentacion de UIKit que se dibuja por encima de todo el arbol,
    // y el dialogo vive DENTRO del arbol: con la ficha abierta, el aviso queda
    // detras y solo se ve el oscurecido.
    setSelectedCard(null);

    alert(t('reportTitle'), t('reportDesc'), [
      ...REPORT_REASONS.map(r => ({
        text: t(r.key as any),
        onPress: async () => {
          const sent = await submitImageReport({ cardImageId: imageId, userId, reason: r.value });
          if (!sent.ok) {
            alert(
              t('reportTitle'),
              sent.reason === 'already' ? t('reportErrAlready') : t('reportErrFailed'),
            );
            // 'already' significa que el reporte existe, asi que la UI debe
            // reflejarlo igual.
            if (sent.reason === 'already') setReported(prev => new Set(prev).add(imageId));
            return;
          }
          setReported(prev => new Set(prev).add(imageId));
          alert(t('reportSent'), t('reportSentDesc'));
        },
      })),
      { text: t('cancel'), style: 'cancel' as const },
    ]);
  };

  const finishContribution = async (crop: CropRect) => {
    if (!cropping) return;
    const { asset, cardId } = cropping;
    setCropping(null);

    const sent = await submitContribution({ cardId, userId, asset, crop });
    if (!sent.ok) {
      alert(t('contributeTitle'), contributionError(sent.reason));
      return;
    }
    setPendingContrib(prev => new Set(prev).add(cardId));
    alert(t('contributeSent'), t('contributeSentDesc'));
  };

  const contributionError = (reason: ContributionFailure) => {
    if (reason === 'unavailable') return t('contributeErrUnavailable');
    if (reason === 'read_failed') return t('contributeErrReadFailed');
    if (reason === 'permission') return t('contributeErrPermission');
    if (reason === 'too_large') return t('contributeErrTooLarge');
    if (reason === 'bad_type') return t('contributeErrBadType');
    return t('contributeErrFailed');
  };

  const handleContribute = () => {
    const card = selectedCard;
    if (!card) return;
    // El aviso ES la aceptacion explicita de terminos: submitContribution
    // guarda terms_accepted_at y terms_version, y la constraint
    // card_images_community_has_terms no deja registrar el aporte sin ellos.
    // Igual que en handleReport: la ficha es un Modal nativo y taparia el aviso.
    setSelectedCard(null);

    alert(t('contributeTitle'), t('contributeRights'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('contributeConfirm'),
        onPress: async () => {
          const picked = await pickContributionImage();
          if (!picked.ok) {
            if (picked.reason !== 'cancelled') {
              alert(t('contributeTitle'), contributionError(picked.reason));
            }
            return;
          }
          // El envio no ocurre aca: primero se encuadra. Lo continua
          // finishContribution().
          setCropping({ asset: picked.asset, cardId: card.id });
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    let result = cards;
    if (statusFilter === 'All') result = result.filter(c => c.status !== 'not_collecting');
    if (memberFilter === 'Group') result = result.filter(c => c.is_group);
    else if (memberFilter !== 'All') result = result.filter(c => c.member === memberFilter);
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

  const groupedEntries = useMemo(() => {
    const groups: Record<string, CardWithStatus[]> = {};
    filtered.forEach(c => {
      if (!groups[c.category_name]) groups[c.category_name] = [];
      groups[c.category_name].push(c);
    });
    return Object.entries(groups).sort(
      ([, a], [, b]) => a[0].category_sort_order - b[0].category_sort_order
    );
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
      onHelp: () => {
        setShowFilters(false);
        setTimeout(() => setShowHelp(true), 300);
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
  ], [categories, categoryFilter, statusFilter, memberFilter, t]);

  const albumName = cards[0]?.album_name || album?.name || 'Album';
  const albumShort = cards[0]?.album_short || album?.short_name || '';
  const albumColor = cards[0]?.album_color || album?.color || COLORS.purple2;
  const albumCover = cards[0]?.album_cover || album?.cover_image_url || null;
  const totalOwned = cards.filter(c => c.status === 'have').length;
  // "not_collecting" cards don't count toward the album's total — a card the
  // user has explicitly opted out of shouldn't block 100% completion.
  const collectibleCount = cards.filter(c => c.status !== 'not_collecting').length;

  // Completion celebration trigger
  useEffect(() => {
    if (!loading && collectibleCount > 0) {
      if (
        prevOwnedRef.current !== null &&
        totalOwned === collectibleCount &&
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
  }, [totalOwned, collectibleCount, loading]);

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
                  source={{ uri: getPhotocardUrl(albumCover!) }}
                  style={{ width: '100%', height: '100%', borderRadius: 13 }}
                  contentFit="cover"
                  cachePolicy="disk"
                  transition={150}
                />
              ) : (
                <Text style={[styles.coverText, { color: albumColor }]}>{albumShort}</Text>
              )}
            </View>
          </View>

          <Text style={styles.countText}>
            {t('photocardsOf', { owned: totalOwned, total: collectibleCount })}
          </Text>

          <View style={styles.barWrap}>
            <NeonBar
              value={totalOwned}
              max={collectibleCount}
              height={6}
              color={totalOwned === collectibleCount && collectibleCount > 0 ? COLORS.gold : undefined}
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
                {t('filtersLabel')}
              </Text>
              {activeFilterCount > 0 && (
                <View style={[styles.filterBadge, { backgroundColor: albumColor }]}>
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
          groupedEntries.map(([catName, catCards]) => {
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
                      contributionPending={pendingContrib.has(card.id)}
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

        {!loading && cards.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="albums-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('noPhotocardsYet')}</Text>
            <Text style={styles.emptyTextSub}>{t('noPhotocardsYetDesc')}</Text>
          </View>
        ) : !loading && filtered.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="search" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('noCardsFilter')}</Text>
          </View>
        )}

        {/* Al pie de la grilla y no arriba: quien llega a proponer una card es
            quien ya recorrio el album y no la encontro. Lleva el albumId para
            no volver a preguntar donde va. */}
        {CARD_SUBMISSIONS_ENABLED && !loading && (
          <TouchableOpacity
            onPress={() => router.push(`/contribute/new-card?albumId=${id}`)}
            activeOpacity={0.7}
            style={styles.missingCardBtn}
          >
            <Ionicons name="add-circle-outline" size={16} color={COLORS.purple3} />
            <Text style={styles.missingCardText}>{t('newCardEntry')}</Text>
          </TouchableOpacity>
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
      <CardStatusModal
        card={selectedCard}
        onClose={() => setSelectedCard(null)}
        onSetStatus={handleStatusSelect}
        onClearStatus={() => { clearCardStatus(selectedCard!.id); setSelectedCard(null); }}
        onSetDuplicates={(count) => {
          if (!selectedCard) return;
          const clamped = Math.max(0, count);
          setDuplicateCount(selectedCard.id, clamped);
          setSelectedCard(prev => prev ? { ...prev, duplicate_count: clamped } : null);
        }}
        onContribute={handleContribute}
        contributionPending={selectedCard ? pendingContrib.has(selectedCard.id) : false}
        onReport={handleReport}
        reportSent={
          selectedCard?.primary_image_id != null && reported.has(selectedCard.primary_image_id)
        }
      />

      <ImageCropper
        visible={!!cropping}
        uri={cropping?.asset.uri ?? null}
        imageWidth={cropping?.asset.width ?? 0}
        imageHeight={cropping?.asset.height ?? 0}
        onCancel={() => setCropping(null)}
        onConfirm={finishContribution}
      />

      <StatusHelpModal visible={showHelp} onClose={() => setShowHelp(false)} />

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
  coverSection: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 16 },
  coverOuter: { width: 140, height: 140, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverBox: {
    width: 130, height: 130, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  coverText: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },
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
  missingCardBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 20, marginHorizontal: 12, paddingVertical: 13,
    borderRadius: 12, borderWidth: 1, borderStyle: 'dashed',
    borderColor: COLORS.borderActive,
  },
  missingCardText: { fontSize: 12, fontWeight: '800', color: COLORS.purple3 },
  emptyWrap: { alignItems: 'center', marginTop: 50, gap: 10, paddingHorizontal: 32 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
  emptyTextSub: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', opacity: 0.7, marginTop: -4 },


  // Status picker


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
