import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GalaxyBackground from '../../components/GalaxyBackground';
import NewsBanner from '../../components/NewsBanner';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { goBack, BACK_HIT_SLOP } from '../../lib/navigation';
import { NEWS } from '../../lib/news';

/** Todas las novedades, la mas reciente arriba. Se llega desde la campanita. */
export default function NewsListScreen() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => goBack(router)} hitSlop={BACK_HIT_SLOP} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('newsTitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {NEWS.length === 0 ? (
          <Text style={styles.empty}>{t('newsEmpty')}</Text>
        ) : (
          NEWS.map(item => (
            <NewsBanner
              key={item.id}
              item={item}
              onOpen={() => router.push(`/news/${item.id}`)}
            />
          ))
        )}
      </ScrollView>
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
});
