import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import GalaxyBackground from '../../components/GalaxyBackground';
import GlassCard from '../../components/GlassCard';
import NeonBar from '../../components/NeonBar';
import OnboardingScreen from '../../components/OnboardingScreen';
import PremiumLock from '../../components/PremiumLock';
import { useAlbums } from '../../hooks/useAlbums';
import { useAuth } from '../../hooks/useAuth';
import { useCollection } from '../../hooks/useCollection';
import { useWishlist } from '../../hooks/useWishlist';
import { useBias } from '../../lib/BiasContext';
import { COLORS, getMemberByKey, MEMBERS, PREMIUM_ENABLED, PRIVACY_URL, RARITIES } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { usePremium } from '../../lib/PremiumContext';
import { supabase } from '../../lib/supabase';
import { BiasKey } from '../../lib/types';

const MEMBER_IMAGES: Record<string, any> = {
  'RM': require('../../assets/images/bts/rm.png'),
  'Jin': require('../../assets/images/bts/jin.png'),
  'Suga': require('../../assets/images/bts/suga.png'),
  'J-Hope': require('../../assets/images/bts/jhope.png'),
  'Jimin': require('../../assets/images/bts/jimin.png'),
  'V': require('../../assets/images/bts/v.png'),
  'Jungkook': require('../../assets/images/bts/jungkook.png'),
  'Group': require('../../assets/images/bts/bts.png'),
};

function BiasChip({ biasKey }: { biasKey: BiasKey }) {
  const m = getMemberByKey(biasKey);
  if (!m) return null;
  return (
    <View style={styles.biasChip}>
      <View style={[styles.biasChipPhoto, { borderColor: m.colors[1] + '99' }]}>
        {MEMBER_IMAGES[m.name] ? (
          <ExpoImage source={MEMBER_IMAGES[m.name]} style={styles.biasChipImg} contentFit="cover" />
        ) : (
          <Text style={styles.biasChipInitial}>{m.name[0]}</Text>
        )}
      </View>
      <Text style={styles.biasChipName}>{m.name}</Text>
    </View>
  );
}

function MemberRow({ name, owned, total, color }: { emoji: string; name: string; owned: number; total: number; color: string }) {
  return (
    <View style={styles.memberRow}>
      <View style={[styles.memberAvatarDot, { borderColor: color }]}>
        {MEMBER_IMAGES[name] ? (
          <Image source={MEMBER_IMAGES[name]} style={styles.memberAvatarImg} resizeMode="cover" />
        ) : (
          <Text style={styles.memberAvatarEmoji}>{name.charAt(0)}</Text>
        )}
      </View>
      <View style={styles.memberRowInfo}>
        <View style={styles.memberRowTop}>
          <Text style={styles.memberRowName}>{name}</Text>
          <Text style={[styles.memberRowCount, { color }]}>{owned}<Text style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '400' }}>/{total}</Text></Text>
        </View>
        <NeonBar value={owned} max={total} height={4} color={color} />
      </View>
    </View>
  );
}

function StatCard({ value, label, color, icon }: { value: number | string; label: string; color: string; icon: string }) {
  return (
    <GlassCard style={styles.statCard}>
      <Text style={styles.statCardIcon}>{icon}</Text>
      <Text style={[styles.statCardValue, { color }]}>{value}</Text>
      <Text style={styles.statCardLabel}>{label}</Text>
    </GlassCard>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userName, userAvatar, authProvider, signOut, deleteAccount } = useAuth();
  const { userId } = useAuth();
  const [deleteModal, setDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showBiasEdit, setShowBiasEdit] = useState(false);
  const { lang, setLang, t } = useI18n();
  const { isPremium } = usePremium();
  const { biases, saveBiases } = useBias();
  const { cards: ownedCards, silentRefetch: silentRefetchCollection } = useCollection(userId);
  const { cards: wishCards } = useWishlist(userId);
  const { albums, silentRefetch: silentRefetchAlbums } = useAlbums(userId);

  useFocusEffect(useCallback(() => { silentRefetchCollection(); silentRefetchAlbums(); }, [silentRefetchCollection, silentRefetchAlbums]));

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 10 }),
    ]).start();
  }, []);

  const providerLabel = authProvider === 'apple' ? 'Apple' : 'Google';

  const totalCards = useMemo(() => albums.reduce((sum, a) => sum + a.total_cards, 0), [albums]);
  const completedAlbums = useMemo(
    () => albums.filter(a => a.owned_cards === a.total_cards && a.total_cards > 0).length,
    [albums],
  );

  const memberCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ownedCards.forEach(c => {
      if (!c.is_group) counts[c.member] = (counts[c.member] || 0) + 1;
    });
    return counts;
  }, [ownedCards]);

  const groupOwned = useMemo(() => ownedCards.filter(c => c.is_group).length, [ownedCards]);

  const [totalByMember, setTotalByMember] = useState<Record<string, number>>({});
  const [totalGroup, setTotalGroup] = useState(0);
  useEffect(() => {
    supabase
      .from('cards')
      .select('member, is_group')
      .eq('is_group', false)
      .then(({ data }) => {
        if (!data) return;
        const counts: Record<string, number> = {};
        data.forEach((c: any) => { counts[c.member] = (counts[c.member] || 0) + 1; });
        setTotalByMember(counts);
      });
    supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('is_group', true)
      .then(({ count }) => { if (count != null) setTotalGroup(count); });
  }, []);

  const rarityCounts = useMemo(() => {
    const c: Record<string, number> = { Common: 0, Rare: 0, 'Ultra Rare': 0, Limited: 0 };
    ownedCards.forEach(card => { c[card.rarity] = (c[card.rarity] || 0) + 1; });
    return c;
  }, [ownedCards]);

  const completionPct = totalCards > 0 ? Math.round((ownedCards.length / totalCards) * 100) : 0;
  const firstName = userName?.split(' ')[0] || 'ARMY';

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <Animated.View style={[styles.avatarSection, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient
            colors={[COLORS.purple1 + '44', COLORS.pink + '22', 'transparent']}
            style={styles.avatarGlow}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          {userAvatar ? (
            <View style={styles.avatarWrap}>
              <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
            </View>
          ) : (
            <LinearGradient colors={[COLORS.purple1, COLORS.purple2, COLORS.pink]} style={styles.avatarWrap}>
              <Text style={styles.avatarInitial}>{firstName[0]?.toUpperCase()}</Text>
            </LinearGradient>
          )}
          <Text style={styles.name}>{userName || 'ARMY'}</Text>
          <Text style={styles.email}>{user?.email || ''}</Text>

          {/* Premium badge or CTA */}
          {!PREMIUM_ENABLED ? null : isPremium ? (
            <View style={styles.premiumBadge}>
              <LinearGradient
                colors={[COLORS.purple1, COLORS.pink]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.premiumBadgeGrad}
              >
                <Text style={styles.premiumBadgeText}>{t('premiumBadge')}</Text>
              </LinearGradient>
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push('/paywall')} activeOpacity={0.8} style={styles.premiumCTA}>
              <LinearGradient
                colors={[COLORS.purple1 + '44', COLORS.pink + '22']}
                style={styles.premiumCTAGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="diamond-outline" size={12} color={COLORS.purple3} />
                <Text style={styles.premiumCTAText}>{t('premiumCTA')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          <View style={styles.quoteBubble}>
            <Ionicons name="heart" size={11} color={COLORS.purple3} style={{ opacity: 0.7 }} />
            <Text style={styles.quote}>{t('loginQuote')}</Text>
            <Ionicons name="heart" size={11} color={COLORS.purple3} style={{ opacity: 0.7 }} />
          </View>
        </Animated.View>

        {/* Quick stats */}
        <View style={styles.statsGrid}>
          <StatCard value={ownedCards.length} label={t('owned')} color={COLORS.green} icon="✓" />
          <StatCard value={wishCards.length} label={t('wishlist')} color={COLORS.pink} icon="♡" />
          <StatCard value={`${completionPct}%`} label={t('labelComplete')} color={COLORS.purple3} icon="★" />
          <StatCard value={completedAlbums} label={t('fullSets')} color={COLORS.gold} icon="◆" />
        </View>

        {/* Overall progress — always visible */}
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('overallProgress')}</Text>
            <Text style={styles.cardBadge}>
              <Text style={{ color: COLORS.pink, fontWeight: '900' }}>{ownedCards.length}</Text>
              <Text style={{ color: COLORS.textMuted }}> / {totalCards}</Text>
            </Text>
          </View>
          <View style={styles.divider} />
          <NeonBar value={ownedCards.length} max={totalCards} height={8} />
          {totalCards - ownedCards.length > 0 ? (
            <Text style={styles.progressHint}>{t('cardsLeft', { n: totalCards - ownedCards.length })}</Text>
          ) : (
            <View style={styles.progressComplete}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.gold} />
              <Text style={styles.progressHint}>{t('collectionComplete')}</Text>
            </View>
          )}
        </GlassCard>

        {/* Rarity breakdown — premium only */}
        {isPremium ? (
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>{t('rarityBreakdown')}</Text>
            <View style={styles.divider} />
            <View style={styles.rarityGrid}>
              {Object.entries(RARITIES).map(([name, r]) => (
                <View key={name} style={styles.rarityItem}>
                  <Text style={[styles.raritySymbol, { color: r.color }]}>{r.symbol}</Text>
                  <Text style={[styles.rarityCount, { color: r.color }]}>{rarityCounts[name] || 0}</Text>
                  <Text style={styles.rarityName}>{name === 'Ultra Rare' ? 'UR' : name}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        ) : (
          <PremiumLock feature={t('premiumFeatureStats')} />
        )}

        {/* Member stats — premium only */}
        {!isPremium ? (
          <PremiumLock feature={t('premiumFeatureMemberStats')} />
        ) : ownedCards.length > 0 ? (
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>{t('memberCollection')}</Text>
            <View style={styles.divider} />
            <View style={styles.memberList}>
              {MEMBERS.map(m => {
                const owned = memberCounts[m.name] || 0;
                if (owned === 0) return null;
                return (
                  <MemberRow key={m.name} emoji={m.emoji} name={m.name} owned={owned} total={totalByMember[m.name] || 0} color={m.colors[1]} />
                );
              })}
              {groupOwned > 0 && (
                <MemberRow key="Group" emoji="" name="Group" owned={groupOwned} total={totalGroup} color={COLORS.purple2} />
              )}
            </View>
          </GlassCard>
        ) : null}

        {/* Mis bias */}
        <GlassCard style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('myBiases')}</Text>
            <TouchableOpacity onPress={() => setShowBiasEdit(true)} activeOpacity={0.7} style={styles.editBtn}>
              <Ionicons name="pencil" size={13} color={COLORS.purple3} />
              <Text style={styles.editBtnText}>{t('edit')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          {biases.length === 0 ? (
            <Text style={styles.noBiasText}>{t('noBiasesSelected')}</Text>
          ) : (
            <View style={styles.biasChips}>
              {biases.map(key => <BiasChip key={key} biasKey={key} />)}
            </View>
          )}
        </GlassCard>

        {/* Account */}
        <GlassCard style={styles.card}>
          <Text style={styles.cardTitle}>{t('account')}</Text>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('labelEmail')}</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{user?.email || '—'}</Text>
          </View>
          <View style={styles.rowSep} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('labelProvider')}</Text>
            <View style={styles.providerBadge}>
              <Text style={styles.providerText}>{providerLabel}</Text>
            </View>
          </View>
          <View style={styles.rowSep} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('labelLanguage')}</Text>
            <View style={styles.langToggle}>
              <TouchableOpacity
                onPress={() => setLang('es')}
                style={[styles.langBtn, lang === 'es' && styles.langBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.langBtnText, lang === 'es' && styles.langBtnTextActive]}>ES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setLang('en')}
                style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>EN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </GlassCard>

        <TouchableOpacity onPress={signOut} activeOpacity={0.7} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>{t('signOut')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setConfirmText(''); setDeleteModal(true); }}
          activeOpacity={0.7}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteBtnText}>{t('deleteAccount')}</Text>
        </TouchableOpacity>

        <View style={styles.versionRow}>
          <Text style={styles.version}>{t('version')} </Text>
          <FontAwesome name="heart" size={11} color={COLORS.purple2} style={{ opacity: 0.5 }} />
        </View>

        <TouchableOpacity
          onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          activeOpacity={0.7}
          style={styles.privacyLink}
        >
          <Text style={styles.privacyLinkText}>{t('privacyPolicy')}</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>{t('affiliationDisclaimer')}</Text>
      </ScrollView>

      {/* Bias edit modal */}
      <Modal visible={showBiasEdit} animationType="slide" statusBarTranslucent onRequestClose={() => setShowBiasEdit(false)}>
        <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
          <OnboardingScreen
            initialBiases={biases}
            isEditing
            onCancel={() => setShowBiasEdit(false)}
            onFinish={async (newBiases) => {
              const result = await saveBiases(newBiases);
              setShowBiasEdit(false);
              if (result.error) {
                Alert.alert('Error de sincronización', result.error);
              }
            }}
          />
        </View>
      </Modal>

      {/* Delete account modal */}
      <Modal visible={deleteModal} transparent animationType="fade" onRequestClose={() => setDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('deleteAccountTitle')}</Text>
            <Text style={styles.modalWarning}>{t('deleteAccountWarning')}</Text>

            <Text style={styles.modalHint}>{t('deleteAccountConfirmHint')}</Text>
            <TextInput
              style={styles.modalInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder={t('deleteAccountConfirmWord')}
              placeholderTextColor="rgba(255,100,100,0.35)"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deleting}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setDeleteModal(false)}
                style={styles.modalCancelBtn}
                activeOpacity={0.7}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>{t('deleteAccountCancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  setDeleting(true);
                  const result = await deleteAccount();
                  setDeleting(false);
                  if (result.error) {
                    Alert.alert(t('deleteAccountErrorTitle'), t('deleteAccountErrorBody'));
                    return;
                  }
                  setDeleteModal(false);
                }}
                style={[
                  styles.modalConfirmBtn,
                  confirmText !== t('deleteAccountConfirmWord') && styles.modalConfirmBtnDisabled,
                ]}
                activeOpacity={0.7}
                disabled={confirmText !== t('deleteAccountConfirmWord') || deleting}
              >
                {deleting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalConfirmText}>{t('deleteAccountConfirmBtn')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 16, paddingBottom: 120 },

  avatarSection: { alignItems: 'center', marginTop: 8, marginBottom: 20, paddingBottom: 24, overflow: 'hidden' },
  avatarGlow: { position: 'absolute', top: 0, left: -40, right: -40, height: 180 },
  avatarWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, overflow: 'hidden',
    borderWidth: 3, borderColor: COLORS.purple2 + '66',
    shadowColor: COLORS.purple2,
    shadowOpacity: 0.6, shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 40, fontWeight: '900', color: '#fff' },
  name: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.3 },
  email: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },

  premiumBadge: { marginTop: 10, borderRadius: 12, overflow: 'hidden' },
  premiumBadgeGrad: { paddingHorizontal: 14, paddingVertical: 5 },
  premiumBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  premiumCTA: { marginTop: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.purple2 + '33' },
  premiumCTAGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 7 },
  premiumCTAText: { color: COLORS.purple3, fontSize: 12, fontWeight: '700' },

  quoteBubble: {
    marginTop: 12,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: COLORS.purple1 + '44',
    borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.purple2 + '33',
  },
  quote: { color: COLORS.purple3, fontSize: 11, fontStyle: 'italic' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: '47%', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
  statCardIcon: { fontSize: 18, marginBottom: 4 },
  statCardValue: { fontSize: 24, fontWeight: '900' },
  statCardLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginTop: 2 },

  card: { padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cardBadge: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  divider: { width: '100%', height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 14 },
  progressHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 8 },
  progressComplete: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },

  rarityGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  rarityItem: { alignItems: 'center', gap: 3 },
  raritySymbol: { fontSize: 20 },
  rarityCount: { fontSize: 18, fontWeight: '900' },
  rarityName: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600' },

  memberList: { gap: 14 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatarDot: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: 'rgba(139,112,170,0.15)' },
  memberAvatarImg: { width: 50, height: 50 },
  memberAvatarEmoji: { fontSize: 20 },
  memberRowInfo: { flex: 1 },
  memberRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  memberRowName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  memberRowCount: { fontSize: 13, fontWeight: '900' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { color: COLORS.textMuted, fontSize: 13 },
  infoValue: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', maxWidth: '60%' },
  rowSep: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginVertical: 4 },
  providerBadge: {
    backgroundColor: COLORS.purple1 + '55',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1, borderColor: COLORS.purple2 + '33',
  },
  providerText: { color: COLORS.purple3, fontSize: 12, fontWeight: '700' },
  langToggle: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  langBtn: { paddingHorizontal: 14, paddingVertical: 5, backgroundColor: 'transparent' },
  langBtnActive: { backgroundColor: COLORS.purple1 },
  langBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted },
  langBtnTextActive: { color: '#fff' },

  signOutBtn: {
    backgroundColor: 'rgba(255,60,60,0.1)',
    borderRadius: 14, padding: 16,
    alignItems: 'center', marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,60,60,0.18)',
  },
  signOutText: { color: '#FF6B6B', fontSize: 15, fontWeight: '700' },

  deleteBtn: {
    alignItems: 'center', marginBottom: 20, paddingVertical: 12,
  },
  deleteBtnText: { color: 'rgba(255,80,80,0.45)', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  versionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  version: { color: COLORS.textMuted, fontSize: 11, opacity: 0.5 },
  disclaimer: { color: COLORS.textMuted, fontSize: 10, opacity: 0.45, textAlign: 'center', paddingHorizontal: 32, marginBottom: 16 },
  privacyLink: { alignItems: 'center', marginBottom: 10 },
  privacyLinkText: { color: COLORS.purple3, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },

  // Bias section
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.purple2 + '44',
    backgroundColor: COLORS.purple1 + '22',
  },
  editBtnText: { color: COLORS.purple3, fontSize: 12, fontWeight: '700' },
  noBiasText: { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic' },
  biasChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  biasChip: { alignItems: 'center', gap: 5, width: 60 },
  biasChipPhoto: {
    width: 48, height: 48, borderRadius: 24,
    overflow: 'hidden', borderWidth: 2,
    backgroundColor: 'rgba(139,112,170,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  biasChipImg: { width: 48, height: 48 },
  biasChipInitial: { fontSize: 18, color: COLORS.purple3, fontWeight: '700' },
  biasChipName: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' },

  // Delete modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalBox: {
    backgroundColor: '#160A30',
    borderRadius: 20, padding: 24, width: '100%',
    borderWidth: 1, borderColor: 'rgba(255,80,80,0.2)',
  },
  modalTitle: { color: '#FF6B6B', fontSize: 18, fontWeight: '900', marginBottom: 14 },
  modalWarning: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 20 },
  modalHint: { color: COLORS.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 8 },
  modalInput: {
    backgroundColor: 'rgba(255,80,80,0.08)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: '#FF6B6B', fontSize: 15, fontWeight: '800', letterSpacing: 2,
    borderWidth: 1, borderColor: 'rgba(255,80,80,0.25)', marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCancelText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', backgroundColor: 'rgba(255,60,60,0.75)',
  },
  modalConfirmBtnDisabled: { backgroundColor: 'rgba(255,60,60,0.2)' },
  modalConfirmText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
