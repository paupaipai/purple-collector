import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { useAuth } from '../../hooks/useAuth';
import { useCollectionTypes } from '../../hooks/useCollectionTypes';
import { useBias } from '../../lib/BiasContext';
import { COLORS, getMemberByKey } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { CollectionTypeWithStats, BiasKey } from '../../lib/types';

const TYPE_ICONS: Record<string, any> = {
  book:   require('../../assets/images/icons/book.png'),
  sakura: require('../../assets/images/icons/sakura.png'),
  dvd:    require('../../assets/images/icons/dvd.png'),
  gift:   require('../../assets/images/icons/gift.png'),
  mic:    require('../../assets/images/icons/mic.png'),
  bag:    require('../../assets/images/icons/bag.png'),
};

function getBiasLine(biases: BiasKey[], biasLabel: string, biasesLabel: string): string | null {
  if (biases.length === 0) return null;
  const MAX_SHOW = 2;
  const shown = biases.slice(0, MAX_SHOW).map(k => {
    const m = getMemberByKey(k);
    return m ? m.name : k;
  });
  const extra = biases.length > MAX_SHOW ? ` +${biases.length - MAX_SHOW}` : '';
  const label = biases.length === 1 ? biasLabel : biasesLabel;
  return `${label}: ${shown.join(', ')}${extra}`;
}

function TypeCard({
  type,
  onPress,
  index,
}: {
  type: CollectionTypeWithStats;
  onPress: () => void;
  index: number;
}) {
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const iconSource = type.icon ? TYPE_ICONS[type.icon] : null;

  return (
    <Animated.View style={[styles.typeCardWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={{ flex: 1 }}>
        <GlassCard style={styles.typeCard}>
          <LinearGradient
            colors={[type.color + '22', type.color + '06', 'transparent']}
            style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Icon */}
          <View style={[styles.typeIconWrap, { backgroundColor: type.color + '18', borderColor: type.color + '30' }]}>
            {iconSource ? (
              <RNImage source={iconSource} style={styles.typeIcon} resizeMode="contain" />
            ) : (
              <Ionicons name="albums-outline" size={26} color={type.color} />
            )}
          </View>

          {/* Text */}
          <View style={styles.typeContent}>
            <Text style={styles.typeName} numberOfLines={2}>{type.name}</Text>
            {type.album_count > 0 && (
              <Text style={styles.typeStat}>
                <Text style={[styles.typeStatNum, { color: type.color }]}>{type.album_count}</Text>
                {' '}{t('wordAlbums')}
              </Text>
            )}
          </View>

          <Ionicons name="chevron-forward" size={14} color={type.color + 'AA'} />
        </GlassCard>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { userName } = useAuth();
  const { types, loading, error, refetch, silentRefetch } = useCollectionTypes();
  const { t } = useI18n();
  const { biases } = useBias();

  const titleScale = useRef(new Animated.Value(0.85)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => { silentRefetch(); }, [silentRefetch]));

  useEffect(() => {
    Animated.parallel([
      Animated.spring(titleScale, { toValue: 1, useNativeDriver: true, speed: 8 }),
      Animated.timing(titleOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const firstName = userName?.split(' ')[0] || 'ARMY';
  const biasLine = getBiasLine(biases, t('bias'), t('biases'));

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Animated.View style={[styles.header, { opacity: titleOpacity, transform: [{ scale: titleScale }] }]}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
          <View style={styles.welcomeRow}>
            <Text style={styles.welcome}>{t('welcome', { name: firstName })} </Text>
            <Ionicons name="sparkles" size={13} color={COLORS.gold} />
          </View>
          {biasLine && (
            <View style={styles.biasRow}>
              <Ionicons name="heart" size={12} color={COLORS.pink} />
              <Text style={styles.biasLine}>{biasLine}</Text>
            </View>
          )}
        </Animated.View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.purple2} />
            <Text style={styles.loadingText}>{t('loadingTypes')}</Text>
          </View>
        ) : error ? (
          <ErrorView message={error} onRetry={refetch} />
        ) : types.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={48} color={COLORS.purple2} />
            <Text style={styles.emptyTitle}>{t('noTypes')}</Text>
          </View>
        ) : (
          <View style={styles.typesGrid}>
            {types.map((type, i) => (
              <TypeCard
                key={type.id}
                type={type}
                index={i}
                onPress={() => router.push(`/type/${type.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: 16, paddingBottom: 120 },

  header: { alignItems: 'center', marginBottom: 28, marginTop: 12 },
  logo: { width: 213, height: 92 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  welcome: { fontSize: 14, color: COLORS.textSecondary },
  biasRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  biasLine: { fontSize: 12, color: COLORS.purple3, fontWeight: '600' },

  loadingWrap: { alignItems: 'center', marginTop: 60, gap: 12 },
  loadingText: { color: COLORS.textMuted, fontSize: 13 },

  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

  typesGrid: { gap: 4 },

  typeCardWrap: { width: '100%' },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
    overflow: 'hidden',
  },
  typeIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIcon: { width: 34, height: 34 },
  typeContent: { flex: 1 },
  typeName: { fontSize: 16, fontWeight: '800', color: '#fff', lineHeight: 21 },
  typeStat: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginTop: 4 },
  typeStatNum: { fontWeight: '900' },
});
