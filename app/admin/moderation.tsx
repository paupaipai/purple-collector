import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
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
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { PendingSubmission, RejectReason, useModerationQueue } from '../../hooks/useModerationQueue';
import { OpenReport, ResolveAction, useReportsQueue } from '../../hooks/useReportsQueue';
import { COLORS } from '../../lib/constants';
import { useI18n } from '../../lib/I18nContext';
import { ReportReason } from '../../lib/types';

/** Motivo del reporte -> clave de i18n. */
const REASON_KEY: Record<ReportReason, string> = {
  copyright: 'reportCopyright',
  wrong_card: 'reportWrongCard',
  inappropriate: 'reportInappropriate',
  low_quality: 'reportLowQuality',
  duplicate: 'rejectDuplicate',
  other: 'reportImage',
};

const REJECT_REASONS: { value: RejectReason; key: string }[] = [
  { value: 'wrong_card', key: 'rejectWrongCard' },
  { value: 'low_quality', key: 'rejectLowQuality' },
  { value: 'no_rights', key: 'rejectNoRights' },
  { value: 'duplicate', key: 'rejectDuplicate' },
];

export default function ModerationScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { userId } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin(userId);
  const { items, loading, error, working, refetch, moderate } = useModerationQueue(isAdmin);
  const reports = useReportsQueue(isAdmin, userId);
  const [tab, setTab] = useState<'pending' | 'reports'>('pending');

  const run = async (
    submission: PendingSubmission,
    action: 'approve' | 'reject',
    reason?: RejectReason,
  ) => {
    const result = await moderate(submission.id, action, reason);
    if (!result.ok) {
      Alert.alert(t('moderation'), `${t('moderationError')}\n\n${result.error}`);
      return;
    }
    Alert.alert(
      t('moderation'),
      action === 'approve' ? t('moderationApproved') : t('moderationRejected'),
    );
  };

  const resolveReport = async (report: OpenReport, action: ResolveAction) => {
    const result = await reports.resolve(report.id, action);
    if (!result.ok) {
      Alert.alert(t('reports'), `${t('moderationError')}\n\n${result.error}`);
      return;
    }
    Alert.alert(t('reports'), t('reportResolved'));
  };

  // Retirar es destructivo e irreversible: borra el objeto de Storage y, si es
  // legacy, vacia cards.image_path. Por eso pide confirmacion explicita.
  const askTakedown = (report: OpenReport) => {
    Alert.alert(t('takedownTitle'), t('takedownDesc'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('takedownConfirm'),
        style: 'destructive',
        onPress: async () => {
          const result = await reports.takedown(report.id, report.cardImageId, report.reason);
          if (!result.ok) {
            Alert.alert(t('reports'), `${t('moderationError')}\n\n${result.error}`);
            return;
          }
          Alert.alert(t('reports'), t('takedownDone'));
        },
      },
    ]);
  };

  const askReason = (submission: PendingSubmission) => {
    Alert.alert(t('rejectTitle'), t('rejectDesc'), [
      ...REJECT_REASONS.map(r => ({
        text: t(r.key as any),
        onPress: () => run(submission, 'reject', r.value),
      })),
      { text: t('cancel'), style: 'cancel' as const },
    ]);
  };

  // El gate de verdad esta en la RLS y en la edge function; esto solo evita
  // mostrar una pantalla vacia a quien no es admin.
  if (!adminLoading && !isAdmin) {
    return (
      <View style={styles.root}>
        <GalaxyBackground />
        <SafeAreaView style={styles.flex}>
          <ErrorView message={t('moderationNotAllowed')} onRetry={() => router.back()} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <GalaxyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('moderation')}</Text>
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            onPress={() => setTab('pending')}
            activeOpacity={0.7}
            style={[styles.tab, tab === 'pending' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
              {t('queuePending')} · {items.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab('reports')}
            activeOpacity={0.7}
            style={[styles.tab, tab === 'reports' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'reports' && styles.tabTextActive]}>
              {t('reports')} · {reports.items.length}
            </Text>
          </TouchableOpacity>
        </View>

        {adminLoading || (tab === 'pending' ? loading : reports.loading) ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.purple2} />
          </View>
        ) : (tab === 'pending' ? error : reports.error) ? (
          <ErrorView
            message={(tab === 'pending' ? error : reports.error) as string}
            onRetry={tab === 'pending' ? refetch : reports.refetch}
          />
        ) : tab === 'reports' ? (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={reports.refetch} tintColor={COLORS.purple2} />
            }
          >
            {reports.items.length === 0 ? (
              <GlassCard style={styles.empty}>
                <Ionicons name="flag-outline" size={26} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>{t('reportsEmpty')}</Text>
                <Text style={styles.emptyDesc}>{t('reportsEmptyDesc')}</Text>
              </GlassCard>
            ) : reports.items.map(report => {
              const busy = reports.working === report.id;
              return (
                <GlassCard key={report.id} style={styles.item}>
                  <View style={styles.reportHead}>
                    <View style={styles.flex}>
                      <Text style={styles.reasonText}>{t(REASON_KEY[report.reason] as any)}</Text>
                      <Text style={styles.cardMeta} numberOfLines={1}>
                        {report.cardName} · {report.sourceType ?? '—'}
                      </Text>
                      <Text style={styles.cardCode} numberOfLines={1}>{report.cardCode}</Text>
                    </View>
                    {report.reportCount > 1 && (
                      <Text style={styles.count}>×{report.reportCount}</Text>
                    )}
                  </View>

                  {report.detail ? (
                    <Text style={styles.detailText}>{`\u201c${report.detail}\u201d`}</Text>
                  ) : null}

                  {report.imageUrl ? (
                    <View style={styles.reportThumbWrap}>
                      <Image source={{ uri: report.imageUrl }} style={styles.reportThumb} contentFit="contain" />
                    </View>
                  ) : null}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => resolveReport(report, 'dismissed')}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.dismissBtn, busy && styles.btnDisabled]}
                    >
                      <Text style={[styles.btnText, { color: COLORS.textSecondary }]}>
                        {t('reportDismiss')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => resolveReport(report, 'resolved_kept')}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.approveBtn, busy && styles.btnDisabled]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={COLORS.green} />
                      ) : (
                        <Text style={[styles.btnText, { color: COLORS.green }]}>{t('reportKeep')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Retirar va aparte y en rojo: es la unica accion que toca la
                      imagen, y es irreversible. */}
                  <TouchableOpacity
                    onPress={() => askTakedown(report)}
                    disabled={busy}
                    activeOpacity={0.7}
                    style={[styles.btn, styles.takedownBtn, busy && styles.btnDisabled]}
                  >
                    <Ionicons name="trash-outline" size={15} color={COLORS.pink} />
                    <Text style={[styles.btnText, { color: COLORS.pink }]}>{t('reportRemove')}</Text>
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={refetch} tintColor={COLORS.purple2} />
            }
          >
            {items.length === 0 ? (
              <GlassCard style={styles.empty}>
                <Ionicons name="checkmark-done-outline" size={26} color={COLORS.green} />
                <Text style={styles.emptyTitle}>{t('moderationEmpty')}</Text>
                <Text style={styles.emptyDesc}>{t('moderationEmptyDesc')}</Text>
              </GlassCard>
            ) : items.map(item => {
              const busy = working === item.id;
              return (
                <GlassCard key={item.id} style={styles.item}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.cardName}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.member} · {item.albumShort} · {item.categoryName}
                  </Text>
                  <Text style={styles.cardCode} numberOfLines={1}>{item.cardCode}</Text>

                  {/* La aportada al lado de la que se ve hoy: aprobar sin poder
                      comparar es como firmar a ciegas. */}
                  <View style={styles.compare}>
                    <View style={styles.side}>
                      <Text style={styles.sideLabel}>{t('moderationSubmitted')}</Text>
                      {item.signedUrl ? (
                        <Image source={{ uri: item.signedUrl }} style={styles.thumb} contentFit="contain" />
                      ) : (
                        <View style={[styles.thumb, styles.thumbEmpty]}>
                          <Ionicons name="alert-circle-outline" size={18} color={COLORS.textMuted} />
                        </View>
                      )}
                    </View>
                    <View style={styles.side}>
                      <Text style={styles.sideLabel}>
                        {t('moderationCurrent')}
                        {item.currentSource ? ` · ${item.currentSource}` : ''}
                      </Text>
                      {item.currentUrl ? (
                        <Image source={{ uri: item.currentUrl }} style={styles.thumb} contentFit="contain" />
                      ) : (
                        <View style={[styles.thumb, styles.thumbEmpty]}>
                          <Text style={styles.thumbEmptyText}>—</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => askReason(item)}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.rejectBtn, busy && styles.btnDisabled]}
                    >
                      <Ionicons name="close" size={16} color={COLORS.pink} />
                      <Text style={[styles.btnText, { color: COLORS.pink }]}>{t('reject')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => run(item, 'approve')}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.approveBtn, busy && styles.btnDisabled]}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={COLORS.green} />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color={COLORS.green} />
                          <Text style={[styles.btnText, { color: COLORS.green }]}>{t('approve')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              );
            })}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: COLORS.textPrimary },
  count: {
    fontSize: 12, fontWeight: '800', color: COLORS.purple3,
    backgroundColor: 'rgba(168,85,247,0.15)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden',
  },
  list: { padding: 12, gap: 12, paddingBottom: 32 },

  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  emptyDesc: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },

  item: { gap: 2 },
  cardName: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  cardMeta: { fontSize: 11, color: COLORS.textSecondary },
  cardCode: { fontSize: 9, color: COLORS.textMuted, letterSpacing: 0.3 },

  compare: { flexDirection: 'row', gap: 10, marginTop: 10 },
  side: { flex: 1, gap: 4 },
  sideLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, letterSpacing: 0.3 },
  thumb: {
    width: '100%', aspectRatio: 2 / 3, borderRadius: 8,
    backgroundColor: '#0d0520',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbEmptyText: { color: COLORS.textMuted, fontSize: 18 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5,
  },
  btnDisabled: { opacity: 0.5 },
  approveBtn: { borderColor: COLORS.green + '55', backgroundColor: COLORS.green + '14' },
  rejectBtn: { borderColor: COLORS.pink + '55', backgroundColor: COLORS.pink + '14' },
  dismissBtn: { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)' },
  takedownBtn: {
    marginTop: 8, borderColor: COLORS.pink + '55', backgroundColor: COLORS.pink + '10',
  },
  btnText: { fontSize: 12, fontWeight: '800' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 8 },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border,
  },
  tabActive: { borderColor: COLORS.borderActive, backgroundColor: 'rgba(168,85,247,0.12)' },
  tabText: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.purple3 },

  reportHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reasonText: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  detailText: {
    fontSize: 11, fontStyle: 'italic', color: COLORS.textSecondary, marginTop: 6,
  },
  reportThumbWrap: { alignItems: 'flex-start', marginTop: 10 },
  reportThumb: {
    width: 74, aspectRatio: 2 / 3, borderRadius: 8,
    backgroundColor: '#0d0520',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
});
