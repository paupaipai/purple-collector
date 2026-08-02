import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ErrorView from '../../components/ErrorView';
import GalaxyBackground from '../../components/GalaxyBackground';
import GlassCard from '../../components/GlassCard';
import NeonBar from '../../components/NeonBar';
import { useAuth } from '../../hooks/useAuth';
import { useEraAlbums } from '../../hooks/useEraAlbums';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { getPhotocardUrl } from '../../lib/supabase';
import { AlbumEraWithAlbums, AlbumWithStats } from '../../lib/types';

const TYPE_ICONS: Record<string, any> = {
  book:   require('../../assets/images/icons/book.png'),
  sakura: require('../../assets/images/icons/sakura.png'),
  dvd:    require('../../assets/images/icons/dvd.png'),
  gift:   require('../../assets/images/icons/gift.png'),
  mic:    require('../../assets/images/icons/mic.png'),
  bag:    require('../../assets/images/icons/bag.png'),
};

function AlbumRow({
  album,
  accentColor,
  onPress,
  index,
}: {
  album: AlbumWithStats;
  accentColor: string;
  onPress: () => void;
  index: number;
}) {
  const complete = album.owned_cards === album.total_cards && album.total_cards > 0;
  const { t } = useI18n();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <GlassCard style={[styles.albumRow, complete && { borderColor: COLORS.gold + '33' }]}>
          {/* Cover */}
          <View style={[styles.albumCover, { borderColor: album.color + '44' }]}>
            {album.cover_image_url ? (
              <Image
                source={{ uri: getPhotocardUrl(album.cover_image_url) }}
                style={{ width: '100%', height: '100%', borderRadius: 9 }}
                contentFit="cover"
                cachePolicy="disk"
                transition={150}
              />
            ) : (
              <LinearGradient
                colors={[album.color + '33', album.color + '11', 'transparent']}
                style={[StyleSheet.absoluteFill, { borderRadius: 9 }]}
              >
                <View style={styles.albumCoverInner}>
                  <Text style={[styles.albumCoverText, { color: album.color }]}>{album.short_name}</Text>
                </View>
              </LinearGradient>
            )}
          </View>

          {/* Info */}
          <View style={styles.albumInfo}>
            <View style={styles.albumHeaderRow}>
              <Text style={styles.albumName} numberOfLines={1}>{album.name}</Text>
              {complete && (
                <LinearGradient colors={[COLORS.gold, '#FFE08A']} style={styles.completeBadge}>
                  <Text style={styles.completeBadgeText}>{t('complete')}</Text>
                </LinearGradient>
              )}
            </View>
            <Text style={styles.albumMeta}>{album.release_year}</Text>
            <Text style={styles.albumCount}>
              <Text style={{ color: COLORS.pink, fontWeight: '900' }}>{album.owned_cards}</Text>
              <Text style={{ color: COLORS.textSecondary }}> {t('wordOf')} </Text>
              <Text style={{ fontWeight: '900', color: '#fff' }}>{album.total_cards}</Text>
              <Text style={{ color: COLORS.textSecondary }}> {t('wordPhotocards')}</Text>
            </Text>
            <NeonBar
              value={album.owned_cards}
              max={album.total_cards}
              color={complete ? COLORS.gold : accentColor}
            />
          </View>
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EraSection({
  era,
  accentColor,
  onAlbumPress,
  eraIndex,
}: {
  era: AlbumEraWithAlbums;
  accentColor: string;
  onAlbumPress: (albumId: number) => void;
  eraIndex: number;
}) {
  if (era.albums.length === 0) return null;
  const totalOwned = era.albums.reduce((s, a) => s + a.owned_cards, 0);
  const totalCards = era.albums.reduce((s, a) => s + a.total_cards, 0);

  return (
    <View style={styles.eraSection}>
      <View style={styles.eraHeader}>
        <View style={[styles.eraAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.eraName}>{era.name}</Text>
        {totalCards > 0 && (
          <Text style={styles.eraCount}>
            {totalOwned}/{totalCards}
          </Text>
        )}
      </View>
      <View style={styles.eraAlbums}>
        {era.albums.map((album, i) => (
          <AlbumRow
            key={album.id}
            album={album}
            accentColor={accentColor}
            onPress={() => onAlbumPress(album.id)}
            index={eraIndex * 10 + i}
          />
        ))}
      </View>
    </View>
  );
}

export default function TypeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const { eras, typeName, typeColor, typeIcon, loading, error, refetch, silentRefetch } = useEraAlbums(
    Number(id),
    userId
  );
  const { t } = useI18n();

  const headerOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => { silentRefetch(); }, [silentRefetch]));

  useEffect(() => {
    Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const accentColor = typeColor || COLORS.purple2;

  const totalAlbums = eras.reduce((s, e) => s + e.albums.length, 0);
  const totalOwned = eras.reduce((s, e) => s + e.albums.reduce((sa, a) => sa + a.owned_cards, 0), 0);
  const totalCards = eras.reduce((s, e) => s + e.albums.reduce((sa, a) => sa + a.total_cards, 0), 0);

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />

      {/* Header fijo */}
      <Animated.View style={[styles.headerRow, { opacity: headerOpacity }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        {typeIcon && TYPE_ICONS[typeIcon] && (
          <RNImage source={TYPE_ICONS[typeIcon]} style={styles.headerIcon} resizeMode="contain" />
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: accentColor }]} numberOfLines={1}>
            {typeName}
          </Text>
          {!loading && totalAlbums > 0 && (
            <Text style={styles.headerSub}>
              {totalAlbums} {t('wordAlbums')}
              {totalCards > 0 ? `  ·  ${totalOwned}/${totalCards} photocards` : ''}
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Progress bar fija */}
      {!loading && totalCards > 0 && (
        <View style={styles.typeProgressWrap}>
          <NeonBar value={totalOwned} max={totalCards} color={accentColor} height={5} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : error ? (
          <ErrorView message={error} onRetry={refetch} />
        ) : eras.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="albums-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>{t('noAlbums')}</Text>
          </View>
        ) : (
          eras.map((era, i) => (
            <EraSection
              key={era.id}
              era={era}
              accentColor={era.albums[0]?.color || accentColor}
              onAlbumPress={albumId => router.push(`/album/${albumId}`)}
              eraIndex={i}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingBottom: 60 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, marginTop: 6, marginBottom: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  backText: { color: COLORS.purple3, fontSize: 18 },
  headerIcon: { width: 44, height: 44 },
  headerTitle: { fontSize: 22, fontWeight: '900' },
  headerSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  typeProgressWrap: { paddingHorizontal: 16, marginBottom: 16 },

  loadingWrap: { alignItems: 'center', marginTop: 60 },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },

  eraSection: { marginBottom: 8 },
  eraHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  eraAccent: { width: 3, height: 16, borderRadius: 2 },
  eraName: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  eraCount: {
    color: COLORS.textMuted, fontSize: 11, fontWeight: '700',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
  },
  eraAlbums: { paddingHorizontal: 16, gap: 8 },

  albumRow: { flexDirection: 'row', padding: 12, gap: 12, alignItems: 'center' },
  albumCover: {
    width: 68, height: 68, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  albumCoverInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  albumCoverText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  albumInfo: { flex: 1 },
  albumHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  albumName: { flex: 1, fontSize: 14, fontWeight: '800', color: '#fff' },
  albumMeta: { fontSize: 10, color: COLORS.textSecondary, marginBottom: 6 },
  albumCount: { fontSize: 11, fontWeight: '700', color: '#fff', marginBottom: 6 },
  completeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  completeBadgeText: { fontSize: 7, fontWeight: '800', color: '#1a0a00', letterSpacing: 0.5 },
});
