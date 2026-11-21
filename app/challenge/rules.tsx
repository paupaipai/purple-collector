import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import GalaxyBackground from '../../components/GalaxyBackground';
import GlassCard from '../../components/GlassCard';
import ScreenHeader from '../../components/ScreenHeader';
import { CHALLENGE_RULES, CHALLENGE_RULES_VERSION } from '../../lib/challengeRules';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';

/** Pantalla F: reglas completas. */
export default function RulesScreen() {
  const { t, lang } = useI18n();
  const sections = CHALLENGE_RULES[lang === 'en' ? 'en' : 'es'];

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScreenHeader title={t('challengeRulesTitle')} fallback="/challenge" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {sections.map(s => (
          <GlassCard key={s.title} style={styles.card}>
            <Text style={styles.title}>{s.title}</Text>
            {s.items.map((it, i) => (
              <View key={i} style={styles.item}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.text}>{it}</Text>
              </View>
            ))}
          </GlassCard>
        ))}
        <Text style={styles.version}>{t('challengeRulesVersion', { v: CHALLENGE_RULES_VERSION })}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 10 },
  card: { padding: 16 },
  title: { fontSize: 15, fontWeight: '800', color: '#fff', marginBottom: 8 },
  item: { flexDirection: 'row', gap: 8, marginTop: 4 },
  bullet: { color: COLORS.purple3, fontSize: 13, lineHeight: 19 },
  text: { flex: 1, fontSize: 13, lineHeight: 19, color: COLORS.textSecondary },
  version: { fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: 6 },
});
