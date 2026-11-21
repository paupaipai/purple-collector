import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GalaxyBackground from '../../components/GalaxyBackground';
import { NewsArt, PrizeChips } from '../../components/NewsBanner';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { goBack, BACK_HIT_SLOP } from '../../lib/navigation';
import { findNews, markNewsSeen, pick } from '../../lib/news';

/** Detalle de una novedad. Abrirla la marca como vista (apaga el punto). */
export default function NewsDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { t, lang } = useI18n();
  const item = findNews(id);

  useEffect(() => {
    if (item && userId) markNewsSeen(userId, item.id);
  }, [item?.id, userId]);

  const dateText = item
    ? new Date(item.date + 'T12:00:00').toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CL', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => goBack(router, '/news')} hitSlop={BACK_HIT_SLOP} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('newsTitle')}</Text>
      </View>

      {!item ? (
        <Text style={styles.empty}>{t('newsNotFound')}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <LinearGradient
              colors={['#4a1f8f', '#2c1060', '#1d0a45']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <NewsArt size={1.3} />
            <View style={styles.tag}>
              <Ionicons name="sparkles" size={11} color={COLORS.purple4} />
              <Text style={styles.tagText}>{pick(item.tag, lang)}</Text>
            </View>
            <Text style={styles.title}>{pick(item.title, lang)}</Text>
            <Text style={styles.summary}>{pick(item.summary, lang)}</Text>
            <PrizeChips item={item} />
          </View>

          <Text style={styles.date}>{dateText}</Text>
          {item.body.map((p, i) => (
            <Text key={i} style={styles.paragraph}>{pick(p, lang)}</Text>
          ))}
          {item.route && (
            <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={() => router.push(item.route as any)}>
              <Text style={styles.ctaText}>{pick(item.cta, lang)}</Text>
              <Ionicons name="chevron-forward" size={14} color="#2E1065" />
            </TouchableOpacity>
          )}
          {item.footnote && (
            <View style={styles.footnote}>
              <Ionicons name="people-outline" size={14} color={COLORS.purple3} />
              <Text style={styles.footnoteText}>{pick(item.footnote, lang)}</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
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
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  empty: { color: COLORS.textMuted, textAlign: 'center', marginTop: 60 },

  hero: {
    alignItems: 'center',
    borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(192,132,252,0.55)',
    paddingVertical: 20, paddingHorizontal: 16, overflow: 'hidden',
  },
  tag: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999,
    backgroundColor: 'rgba(168,85,247,0.25)',
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.5)',
    marginTop: 12, marginBottom: 8,
  },
  tagText: { fontSize: 11, fontWeight: '700', color: COLORS.purple4 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center' },
  summary: {
    fontSize: 13, lineHeight: 19, color: COLORS.textSecondary,
    textAlign: 'center', marginTop: 6,
  },

  date: { fontSize: 11, color: COLORS.textMuted, marginTop: 18, marginBottom: 6 },
  paragraph: { fontSize: 14, lineHeight: 21, color: COLORS.textSecondary, marginTop: 10 },
  footnote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    marginTop: 22, paddingVertical: 14, borderRadius: 14, backgroundColor: '#D8B4FE',
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#2E1065' },
  footnoteText: { fontSize: 12, fontWeight: '700', color: COLORS.purple3 },
});
