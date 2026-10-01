import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
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
import { PendingCardSubmission, useSubmissionsQueue } from '../../hooks/useSubmissionsQueue';
import { COLORS } from '../../lib/constants';
import { useDialog } from '../../lib/DialogContext';
import { useI18n } from '../../lib/I18nContext';
import { SubmissionRejectReason } from '../../lib/submissions';
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

/**
 * Motivos de rechazo de una PROPUESTA de card, que no son los mismos que los de
 * una imagen: aca lo que mas se va a rechazar es una card que ya esta en el
 * catalogo o mal ubicada, y eso no tiene nada que ver con la calidad de la foto.
 */
const SUBMISSION_REJECT_REASONS: { value: SubmissionRejectReason; key: string }[] = [
  { value: 'already_exists', key: 'submissionRejectExists' },
  { value: 'wrong_taxonomy', key: 'submissionRejectTaxonomy' },
  { value: 'not_a_photocard', key: 'submissionRejectNotPhotocard' },
  { value: 'low_quality', key: 'rejectLowQuality' },
  { value: 'no_rights', key: 'rejectNoRights' },
];

const REJECT_REASONS: { value: RejectReason; key: string }[] = [
  { value: 'wrong_card', key: 'rejectWrongCard' },
  { value: 'low_quality', key: 'rejectLowQuality' },
  { value: 'no_rights', key: 'rejectNoRights' },
  { value: 'duplicate', key: 'rejectDuplicate' },
];

export default function ModerationScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { alert } = useDialog();
  const { userId } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin(userId);
  const { items, loading, error, working, refetch, moderate } = useModerationQueue(isAdmin);
  const reports = useReportsQueue(isAdmin, userId);
  const submissions = useSubmissionsQueue(isAdmin);
  const [tab, setTab] = useState<'pending' | 'cards' | 'reports'>('pending');

  // Los hooks dicen que hay algo en curso ('working'), pero no CUAL de los dos
  // botones se pulso, y la ruedita salia siempre en Aprobar aunque hubieras
  // rechazado. Esto guarda el boton pulsado para dibujarla donde toca.
  const [pressed, setPressed] = useState<'approve' | 'reject' | null>(null);

  // Cada bandeja tiene su carga y su error; se mira la de la pestana activa
  // para no mostrar el spinner de otra.
  const active = tab === 'pending'
    ? { loading, error, refetch }
    : tab === 'cards'
      ? { loading: submissions.loading, error: submissions.error, refetch: submissions.refetch }
      : { loading: reports.loading, error: reports.error, refetch: reports.refetch };

  const run = async (
    submission: PendingSubmission,
    action: 'approve' | 'reject',
    reason?: RejectReason,
  ) => {
    setPressed(action);
    const result = await moderate(submission.id, action, reason);
    setPressed(null);
    if (!result.ok) {
      alert(t('moderation'), `${t('moderationError')}\n\n${result.error}`);
      return;
    }
    alert(
      t('moderation'),
      action === 'approve' ? t('moderationApproved') : t('moderationRejected'),
    );
  };

  const resolveReport = async (report: OpenReport, action: ResolveAction) => {
    setPressed('approve');
    const result = await reports.resolve(report.id, action);
    setPressed(null);
    if (!result.ok) {
      alert(t('reports'), `${t('moderationError')}\n\n${result.error}`);
      return;
    }
    alert(t('reports'), t('reportResolved'));
  };

  // Retirar es destructivo e irreversible: borra el objeto de Storage y, si es
  // legacy, vacia cards.image_path. Por eso pide confirmacion explicita.
  const askTakedown = (report: OpenReport) => {
    alert(t('takedownTitle'), t('takedownDesc'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('takedownConfirm'),
        style: 'destructive',
        onPress: async () => {
          setPressed('reject');
          const result = await reports.takedown(report.id, report.cardImageId, report.reason);
          setPressed(null);
          if (!result.ok) {
            alert(t('reports'), `${t('moderationError')}\n\n${result.error}`);
            return;
          }
          alert(t('reports'), t('takedownDone'));
        },
      },
    ]);
  };

  const runSubmission = async (
    item: PendingCardSubmission,
    action: 'approve' | 'reject',
    reason?: SubmissionRejectReason,
  ) => {
    setPressed(action);
    const result = await submissions.moderate(item.id, action, reason);
    setPressed(null);
    if (!result.ok) {
      alert(t('moderation'), `${t('moderationError')}\n\n${result.error}`);
      return;
    }
    alert(
      t('moderation'),
      action === 'approve' ? t('submissionApproved') : t('submissionRejected'),
    );
  };

  // Aprobar una propuesta CREA una card en el catalogo, que es visible para
  // todo el mundo en cuanto se guarda. Por eso pide confirmacion y rechazar no:
  // rechazar no publica nada.
  const askApproveCard = (item: PendingCardSubmission) => {
    alert(t('newCardTitle'), `${item.cardName}\n${item.albumName} \u00b7 ${item.member}`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('approve'), onPress: () => runSubmission(item, 'approve') },
    ]);
  };

  const askSubmissionReason = (item: PendingCardSubmission) => {
    alert(t('submissionRejectTitle'), t('submissionRejectDesc'), [
      ...SUBMISSION_REJECT_REASONS.map(r => ({
        text: t(r.key as any),
        onPress: () => runSubmission(item, 'reject', r.value),
      })),
      { text: t('cancel'), style: 'cancel' as const },
    ]);
  };

  const askReason = (submission: PendingSubmission) => {
    alert(t('rejectTitle'), t('rejectDesc'), [
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
            onPress={() => setTab('cards')}
            activeOpacity={0.7}
            style={[styles.tab, tab === 'cards' && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === 'cards' && styles.tabTextActive]}>
              {t('queueCards')} · {submissions.items.length}
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

        {adminLoading || active.loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.purple2} />
          </View>
        ) : active.error ? (
          <ErrorView message={active.error} onRetry={active.refetch} />
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

                  {/* Dos acciones, no tres: al revisar un reporte la decision es
                      binaria. Retirar va a la izquierda y en rojo, igual que
                      Rechazar en la pestana de pendientes. */}
                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => askTakedown(report)}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.rejectBtn, busy && styles.btnDisabled]}
                    >
                      {busy && pressed === 'reject' ? (
                        <ActivityIndicator size="small" color={COLORS.pink} />
                      ) : (
                        <>
                          <Ionicons name="trash-outline" size={15} color={COLORS.pink} />
                          <Text style={[styles.btnText, { color: COLORS.pink }]}>{t('reportRemove')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => resolveReport(report, 'resolved_kept')}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.approveBtn, busy && styles.btnDisabled]}
                    >
                      {busy && pressed === 'approve' ? (
                        <ActivityIndicator size="small" color={COLORS.green} />
                      ) : (
                        <Text style={[styles.btnText, { color: COLORS.green }]}>{t('reportKeep')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              );
            })}
          </ScrollView>
        ) : tab === 'cards' ? (
          <ScrollView
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={submissions.refetch}
                tintColor={COLORS.purple2}
              />
            }
          >
            {submissions.items.length === 0 ? (
              <GlassCard style={styles.empty}>
                <Ionicons name="albums-outline" size={26} color={COLORS.textMuted} />
                <Text style={styles.emptyTitle}>{t('submissionsEmpty')}</Text>
                <Text style={styles.emptyDesc}>{t('submissionsEmptyDesc')}</Text>
              </GlassCard>
            ) : submissions.items.map(item => {
              const busy = submissions.working === item.id;
              return (
                <GlassCard key={item.id} style={styles.item}>
                  <View style={styles.submissionRow}>
                    {item.signedUrl ? (
                      <Image
                        source={{ uri: item.signedUrl }}
                        style={styles.submissionThumb}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.submissionThumb, styles.thumbEmpty]}>
                        <Ionicons name="alert-circle-outline" size={18} color={COLORS.textMuted} />
                      </View>
                    )}
                    <View style={styles.flex}>
                      <Text style={styles.cardName} numberOfLines={2}>{item.cardName}</Text>
                      <Text style={styles.cardMeta}>
                        {item.member}{item.handle ? ` \u00b7 @${item.handle}` : ''}
                      </Text>
                      {/* La cadena taxonomica completa. Aprobar CREA la card,
                          asi que hay que poder ver donde va a caer sin salir
                          de la bandeja. */}
                      <Text style={styles.chain} numberOfLines={3}>
                        {[item.typeName, item.eraName, item.albumName, item.versionName, item.categoryName]
                          .filter(Boolean).join(' \u203a ')}
                      </Text>
                      {item.cardSetName ? (
                        <Text style={styles.cardCode} numberOfLines={2}>
                          {item.cardSetName}
                          {item.cardSetDetail ? ` \u00b7 ${item.cardSetDetail}` : ''}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {item.notes ? (
                    <Text style={styles.detailText}>{`\u201c${item.notes}\u201d`}</Text>
                  ) : null}

                  <View style={styles.actions}>
                    <TouchableOpacity
                      onPress={() => askSubmissionReason(item)}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.rejectBtn, busy && styles.btnDisabled]}
                    >
                      {busy && pressed === 'reject' ? (
                        <ActivityIndicator size="small" color={COLORS.pink} />
                      ) : (
                        <>
                          <Ionicons name="close" size={16} color={COLORS.pink} />
                          <Text style={[styles.btnText, { color: COLORS.pink }]}>{t('reject')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => askApproveCard(item)}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.approveBtn, busy && styles.btnDisabled]}
                    >
                      {busy && pressed === 'approve' ? (
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
                      {busy && pressed === 'reject' ? (
                        <ActivityIndicator size="small" color={COLORS.pink} />
                      ) : (
                        <>
                          <Ionicons name="close" size={16} color={COLORS.pink} />
                          <Text style={[styles.btnText, { color: COLORS.pink }]}>{t('reject')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => run(item, 'approve')}
                      disabled={busy}
                      activeOpacity={0.7}
                      style={[styles.btn, styles.approveBtn, busy && styles.btnDisabled]}
                    >
                      {busy && pressed === 'approve' ? (
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
  submissionRow: { flexDirection: 'row', gap: 10 },
  submissionThumb: {
    width: 62, aspectRatio: 2 / 3, borderRadius: 8,
    backgroundColor: '#0d0520',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  chain: { fontSize: 10, lineHeight: 14, color: COLORS.purple3, marginTop: 3 },
  reportThumbWrap: { alignItems: 'flex-start', marginTop: 10 },
  reportThumb: {
    width: 74, aspectRatio: 2 / 3, borderRadius: 8,
    backgroundColor: '#0d0520',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
});
