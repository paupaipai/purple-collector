import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  COLORS, STATUS_CONFIG, STATUS_LABEL_KEY, LEGACY_TREATMENT_ENABLED,
  CONTRIBUTIONS_ENABLED, LEGACY_BLUR_RADIUS,
} from '../lib/constants';
import { useI18n } from '../lib/I18nContext';
import { getCardImageUrl } from '../lib/supabase';
import { CardStatus, CardWithStatus } from '../lib/types';

interface CardStatusModalProps {
  card: CardWithStatus | null;
  onClose: () => void;
  onSetStatus: (status: CardStatus) => void;
  /** Solo lo pasa la vista de album: borra la fila y deja la carta en "pendiente". */
  onClearStatus?: () => void;
  /** Solo donde se pueden editar duplicados. Recibe el conteo ya clampeado. */
  onSetDuplicates?: (count: number) => void;
  /** Solo con CONTRIBUTIONS_ENABLED. Abre el flujo de aporte de imagen. */
  onContribute?: () => void;
  /** true si el usuario ya tiene una aportacion sin resolver para esta card. */
  contributionPending?: boolean;
  /** Abre el flujo de reporte de la imagen que se esta viendo. */
  onReport?: () => void;
  /** true si el usuario ya reporto esta imagen. */
  reportSent?: boolean;
}

export default function CardStatusModal({
  card, onClose, onSetStatus, onClearStatus, onSetDuplicates,
  onContribute, contributionPending, onReport, reportSent,
}: CardStatusModalProps) {
  const { t } = useI18n();
  const visible = !!card;
  const status = card?.status as CardStatus | null | undefined;

  const dupCount = card?.duplicate_count ?? 0;
  const thumbUrl = card ? getCardImageUrl(card) : null;

  // Procedencia de la imagen. Gated por la misma bandera que la grilla: con el
  // catalogo 100% legacy, mostrar "Legacy" en cada card no distingue nada.
  const imageSource = LEGACY_TREATMENT_ENABLED ? card?.primary_image_source : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {card && (
            <>
              <View style={styles.thumbWrap}>
                {thumbUrl ? (
                  <Image
                    source={{ uri: thumbUrl }}
                    style={styles.thumb}
                    contentFit="cover"
                    transition={150}
                    blurRadius={imageSource === 'legacy' ? LEGACY_BLUR_RADIUS : 0}
                  />
                ) : (
                  <View style={[styles.thumb, styles.placeholder, { backgroundColor: card.album_color + '33' }]}>
                    <Text style={styles.memberInitial}>{card.member?.charAt(0) || '?'}</Text>
                  </View>
                )}
                {imageSource ? (
                  <View style={styles.sourceTag}>
                    <Text style={styles.sourceTagText} numberOfLines={1}>
                      {imageSource === 'community'
                        ? t('imageSourceCommunity')
                        : t('imageSourceLegacy')}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.title} numberOfLines={1}>{card.card_name}</Text>
              <Text style={styles.sub} numberOfLines={1}>
                {card.member} · {card.album_short}
                {card.version_short ? ` · Ver. ${card.version_short}` : ''}
              </Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => onSetStatus('have')}
                  activeOpacity={0.7}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: STATUS_CONFIG.have.color + (status === 'have' ? '33' : '14'),
                      borderColor: STATUS_CONFIG.have.color + '55',
                    },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={20} color={STATUS_CONFIG.have.color} />
                  <Text style={[styles.btnText, { color: STATUS_CONFIG.have.color }]}>{t(STATUS_LABEL_KEY.have)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSetStatus('want')}
                  activeOpacity={0.7}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: STATUS_CONFIG.want.color + (status === 'want' ? '33' : '14'),
                      borderColor: STATUS_CONFIG.want.color + '55',
                    },
                  ]}
                >
                  <Ionicons name="heart" size={20} color={STATUS_CONFIG.want.color} />
                  <Text style={[styles.btnText, { color: STATUS_CONFIG.want.color }]}>{t(STATUS_LABEL_KEY.want)}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onSetStatus('otw')}
                  activeOpacity={0.7}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: STATUS_CONFIG.otw.color + (status === 'otw' ? '33' : '14'),
                      borderColor: STATUS_CONFIG.otw.color + '55',
                    },
                  ]}
                >
                  <Ionicons name="cart" size={20} color={STATUS_CONFIG.otw.color} />
                  <Text style={[styles.btnText, { color: STATUS_CONFIG.otw.color }]}>{t(STATUS_LABEL_KEY.otw)}</Text>
                </TouchableOpacity>
              </View>

              {/* Duplicados — solo cuando la carta esta marcada como "Tengo" */}
              {onSetDuplicates && status === 'have' && (
                <View style={styles.dupRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dupLabel}>{t('duplicates')}</Text>
                    <Text style={styles.dupSub}>
                      {dupCount === 0 ? t('copiesOne') : t('copiesMany', { n: dupCount + 1 })}
                    </Text>
                  </View>
                  <View style={styles.dupStepper}>
                    <TouchableOpacity
                      style={[styles.dupBtn, dupCount === 0 && styles.dupBtnDisabled]}
                      onPress={() => onSetDuplicates(dupCount - 1)}
                      disabled={dupCount === 0}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dupBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.dupCount}>{dupCount}</Text>
                    <TouchableOpacity
                      style={styles.dupBtn}
                      onPress={() => onSetDuplicates(dupCount + 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dupBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.secondaryRow}>
                <TouchableOpacity
                  onPress={() => onSetStatus('not_collecting')}
                  activeOpacity={0.7}
                  style={[
                    styles.secondaryBtn,
                    status === 'not_collecting' && { backgroundColor: 'rgba(255,255,255,0.08)' },
                  ]}
                >
                  <Text style={styles.secondaryText}>
                    {STATUS_CONFIG.not_collecting.icon} {t(STATUS_LABEL_KEY.not_collecting)}
                  </Text>
                </TouchableOpacity>
                {onClearStatus && (
                  <TouchableOpacity
                    onPress={onClearStatus}
                    activeOpacity={0.7}
                    style={[
                      styles.secondaryBtn,
                      status == null && { backgroundColor: 'rgba(255,255,255,0.08)' },
                    ]}
                  >
                    <Text style={styles.secondaryText}>○ {t('clearStatus')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Aporte de imagen — FASE D, tras CONTRIBUTIONS_ENABLED */}
              {CONTRIBUTIONS_ENABLED && (contributionPending ? (
                <View style={styles.contributeRow}>
                  <Ionicons name="time-outline" size={15} color={COLORS.textSecondary} />
                  <Text style={styles.contributePendingText}>{t('contributePending')}</Text>
                </View>
              ) : onContribute ? (
                <TouchableOpacity
                  onPress={onContribute}
                  activeOpacity={0.7}
                  style={[styles.contributeRow, styles.contributeBtn]}
                >
                  <Ionicons name="camera-outline" size={16} color={COLORS.purple3} />
                  <Text style={styles.contributeText}>{t('contribute')}</Text>
                </TouchableOpacity>
              ) : null)}

              {/* Reportar — NO va tras CONTRIBUTIONS_ENABLED: recibir un
                  reclamo de copyright sobre una legacy es valioso desde ya, y
                  las 4503 del catalogo son de terceros. Solo si hay imagen. */}
              {onReport && card.primary_image_id != null && (
                <TouchableOpacity
                  onPress={reportSent ? undefined : onReport}
                  disabled={reportSent}
                  activeOpacity={0.7}
                  style={styles.reportRow}
                >
                  <Ionicons
                    name={reportSent ? 'flag' : 'flag-outline'}
                    size={13}
                    color={COLORS.textMuted}
                  />
                  <Text style={styles.reportText}>
                    {reportSent ? t('reportAlreadySent') : t('reportImage')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
                <Text style={styles.closeText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#160A30',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  thumbWrap: {
    width: 96, height: 144, borderRadius: 12,
    overflow: 'hidden', marginBottom: 14,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
  },
  thumb: { width: '100%', height: '100%' },
  contributeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 10, paddingVertical: 10, width: '100%',
  },
  contributeBtn: {
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(168,85,247,0.10)',
  },
  contributeText: { fontSize: 12, fontWeight: '800', color: COLORS.purple3 },
  contributePendingText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  reportRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, marginTop: 8, paddingVertical: 6, width: '100%',
  },
  reportText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted },
  sourceTag: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 3,
  },
  sourceTagText: {
    fontSize: 9, fontWeight: '800', letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.85)', textAlign: 'center',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  memberInitial: { fontSize: 28, fontWeight: '900', color: '#fff' },
  title: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },
  sub: { color: COLORS.textMuted, fontSize: 12, marginTop: 3, marginBottom: 16, textAlign: 'center' },

  actions: { flexDirection: 'row', gap: 8, width: '100%' },
  btn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
  },
  btnText: { fontSize: 11, fontWeight: '800' },

  dupRow: {
    flexDirection: 'row', alignItems: 'center',
    width: '100%', marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dupLabel: { color: '#fff', fontSize: 12, fontWeight: '800' },
  dupSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 1 },
  dupStepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dupBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.35)',
  },
  dupBtnDisabled: { opacity: 0.35 },
  dupBtnText: { color: '#fff', fontSize: 16, fontWeight: '900', lineHeight: 18 },
  dupCount: { color: '#fff', fontSize: 14, fontWeight: '900', minWidth: 16, textAlign: 'center' },

  secondaryRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 8 },
  secondaryBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },

  closeBtn: { marginTop: 16, paddingVertical: 6, paddingHorizontal: 12 },
  closeText: { color: COLORS.textMuted, fontSize: 13, fontWeight: '700' },
});
