import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Challenge, PRIZE_MEDALS } from '../lib/challenge';
import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';
import { NewsArt } from './NewsBanner';

/** Premios en pastillas: 🥇 12 meses · 🥈 6 meses · 🥉 3 meses. */
export function ChallengePrizes({ challenge, center }: { challenge: Challenge; center?: boolean }) {
  const { t } = useI18n();
  return (
    <View style={[styles.prizes, center && { justifyContent: 'center' }]}>
      {challenge.prizes.map(p => (
        <View key={p.place} style={styles.prize}>
          <Text style={styles.prizeMedal}>{PRIZE_MEDALS[p.place] ?? `${p.place}°`}</Text>
          <Text style={styles.prizeLabel}>{t('challengeMonths', { n: String(p.months) })}</Text>
        </View>
      ))}
    </View>
  );
}

/** Tarjeta destacada del inicio. Lleva a la pantalla del concurso. */
export default function ChallengeCard({ challenge, onOpen }: { challenge: Challenge; onOpen: () => void }) {
  const { t } = useI18n();

  const subtitle =
    challenge.status === 'finished' ? t('challengeCardFinished')
    : challenge.status === 'reviewing' ? t('challengeCardReviewing')
    : t('challengeCardSubtitle');

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={styles.wrap}>
      <LinearGradient
        colors={['#4a1f8f', '#2c1060', '#1d0a45']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.top}>
        <View style={styles.texts}>
          <View style={styles.tag}>
            <Ionicons name="sparkles" size={11} color={COLORS.purple4} />
            <Text style={styles.tagText}>{t('challengeTag')}</Text>
          </View>
          <Text style={styles.title}>
            {challenge.title} <Ionicons name="heart" size={16} color={COLORS.purple2} />
          </Text>
          <Text style={styles.summary}>{subtitle}</Text>
        </View>
        <NewsArt size={0.9} />
      </View>

      <ChallengePrizes challenge={challenge} />

      <View style={styles.bottom}>
        <View style={styles.footnote}>
          <Ionicons name="people-outline" size={13} color={COLORS.textSecondary} />
          <Text style={styles.footnoteText} numberOfLines={1}>
            {t('challengeProgressShort', {
              done: String(challenge.completed_count),
              total: String(challenge.eligible_count),
            })}
          </Text>
        </View>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>
            {challenge.status === 'finished' ? t('challengeSeeResults') : t('challengeSee')}
          </Text>
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
  prizeMedal: { fontSize: 12 },
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
});
