import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';
import { NewsItem, pick } from '../lib/news';

const PRIZE_COLORS: Record<1 | 2 | 3, string> = {
  1: COLORS.gold,
  2: '#C9C3E6',
  3: '#E8935A',
};

/** Tres photocards en abanico con un trofeo: la ilustracion del concurso. */
export function NewsArt({ size = 1 }: { size?: number }) {
  const w = 46 * size;
  const h = 64 * size;
  const card = (rotate: string, x: number, y: number, colors: [string, string], z: number) => (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.artCard,
        { width: w, height: h, borderRadius: 7 * size, left: x * size, top: y * size, zIndex: z,
          transform: [{ rotate }] },
      ]}
    />
  );
  return (
    <View style={{ width: 104 * size, height: 92 * size }}>
      {card('-14deg', 4, 14, ['#6d4bb0', '#3b2370'], 1)}
      {card('14deg', 54, 14, ['#6d4bb0', '#3b2370'], 1)}
      {card('0deg', 29, 4, ['#9b6ee0', '#5a3399'], 2)}
      <View style={[styles.trophy, { left: 36 * size, top: 52 * size, width: 32 * size, height: 32 * size }]}>
        <Ionicons name="trophy" size={22 * size} color={COLORS.gold} />
      </View>
    </View>
  );
}

export function PrizeChips({ item }: { item: NewsItem }) {
  const { lang } = useI18n();
  if (!item.prizes?.length) return null;
  return (
    <View style={styles.prizes}>
      {item.prizes.map(p => (
        <View key={p.place} style={styles.prize}>
          <Ionicons name="ribbon" size={12} color={PRIZE_COLORS[p.place]} />
          <Text style={styles.prizePlace}>{p.place}°</Text>
          <Text style={styles.prizeLabel}>{pick(p.label, lang)}</Text>
        </View>
      ))}
    </View>
  );
}

interface Props {
  item: NewsItem;
  onOpen: () => void;
  /** Sin onClose no se muestra la X (por ejemplo, en la lista de novedades). */
  onClose?: () => void;
}

export default function NewsBanner({ item, onOpen, onClose }: Props) {
  const { lang } = useI18n();

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={styles.wrap}>
      <LinearGradient
        colors={['#4a1f8f', '#2c1060', '#1d0a45']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
        >
          <Ionicons name="close" size={14} color={COLORS.textSecondary} />
        </TouchableOpacity>
      )}

      <View style={styles.top}>
        <View style={styles.texts}>
          <View style={styles.tag}>
            <Ionicons name="sparkles" size={11} color={COLORS.purple4} />
            <Text style={styles.tagText}>{pick(item.tag, lang)}</Text>
          </View>
          <Text style={styles.title}>
            {pick(item.title, lang)} <Ionicons name="heart" size={16} color={COLORS.purple2} />
          </Text>
          <Text style={styles.summary}>{pick(item.summary, lang)}</Text>
        </View>
        <NewsArt size={0.9} />
      </View>

      <PrizeChips item={item} />

      <View style={styles.bottom}>
        {item.footnote ? (
          <View style={styles.footnote}>
            <Ionicons name="people-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.footnoteText} numberOfLines={1}>{pick(item.footnote, lang)}</Text>
          </View>
        ) : <View style={{ flex: 1 }} />}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{pick(item.cta, lang)}</Text>
          <Ionicons name="chevron-forward" size={13} color="#2E1065" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(192,132,252,0.55)',
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: COLORS.purple2,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  close: {
    position: 'absolute', top: 8, right: 8, zIndex: 5,
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  texts: { flex: 1 },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.25)',
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.5)',
    marginBottom: 8,
  },
  tagText: { fontSize: 11, fontWeight: '700', color: COLORS.purple4 },
  title: { fontSize: 19, fontWeight: '900', color: '#fff' },
  summary: { fontSize: 12, lineHeight: 17, color: COLORS.textSecondary, marginTop: 4 },

  prizes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  prize: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.35)',
    backgroundColor: 'rgba(11,0,36,0.35)',
  },
  prizePlace: { fontSize: 11, fontWeight: '900', color: '#fff' },
  prizeLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary },

  bottom: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  footnote: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  footnoteText: { fontSize: 11, color: COLORS.textSecondary, flexShrink: 1 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999,
    backgroundColor: '#D8B4FE',
  },
  ctaText: { fontSize: 13, fontWeight: '800', color: '#2E1065' },

  artCard: {
    position: 'absolute',
    borderWidth: 1.5, borderColor: 'rgba(233,213,255,0.6)',
  },
  trophy: {
    position: 'absolute', zIndex: 3,
    alignItems: 'center', justifyContent: 'center',
  },
});
