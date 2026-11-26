import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  COLORS, STATUS_CONFIG, STATUS_LABEL_KEY, LEGACY_TREATMENT_ENABLED,
  CONTRIBUTIONS_ENABLED, LEGACY_BLUR_RADIUS,
} from '../lib/constants';
import { useI18n } from '../lib/I18nContext';
import { getCardBackUrl, getCardImageUrl } from '../lib/supabase';
import ImageZoomViewer, { ZoomSide } from './ImageZoomViewer';
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
  /** Aportar solo el reverso, para cards que ya tienen frente y no reverso. */
  onContributeBack?: () => void;
  /** true si el usuario ya tiene una aportacion sin resolver para esta card. */
  contributionPending?: boolean;
  /** Lados con un aporte propio en revision. */
  pendingSides?: ReadonlySet<'front' | 'back'>;
  /** Abre el flujo de reporte de la imagen que se esta viendo (frente o reverso). */
  onReport?: (cardImageId: number) => void;
  /** true si el usuario ya reporto esa imagen. */
  isReported?: (cardImageId: number) => boolean;
}

export default function CardStatusModal({
  card, onClose, onSetStatus, onClearStatus, onSetDuplicates,
  onContribute, onContributeBack, contributionPending, pendingSides, onReport, isReported,
}: CardStatusModalProps) {
  const { t } = useI18n();
  const visible = !!card;
  const status = card?.status as CardStatus | null | undefined;

  // Que lado se ve. Vuelve al frente cada vez que se abre otra card.
  const [showBack, setShowBack] = useState(false);
  // Visor ampliado (la lupa). Se cierra al cambiar de card.
  const [zoomSide, setZoomSide] = useState<ZoomSide | null>(null);
  useEffect(() => { setShowBack(false); setZoomSide(null); }, [card?.id]);

  const dupCount = card?.duplicate_count ?? 0;
  const frontUrl = card ? getCardImageUrl(card) : null;
  const backUrl = card ? getCardBackUrl(card) : null;
  const viewingBack = showBack && !!backUrl;
  // La imagen que se reporta es la que se esta viendo.
  const visibleImageId = viewingBack ? card?.back_image_id ?? null : card?.primary_image_id ?? null;
  const reportSent = visibleImageId != null && !!isReported?.(visibleImageId);

  // Procedencia de la imagen. Gated por la misma bandera que la grilla: con el
  // catalogo 100% legacy, mostrar "Legacy" en cada card no distingue nada.
  const imageSource = LEGACY_TREATMENT_ENABLED ? card?.primary_image_source : null;

  // Solo se amplian las imagenes aportadas: las legacy rondan los 160 px y
  // ampliadas solo se verian pixeladas.
  const zoomFrontUrl = frontUrl && card?.primary_image_source !== 'legacy' ? frontUrl : null;
  const zoomBackUrl = backUrl && card?.back_image_source !== 'legacy' ? backUrl : null;

  // Card con frente pero sin reverso: el recuadro vacio permite aportarlo. Con
  // un aporte pendiente se espera a que se resuelva.
  const frontPending = !!pendingSides?.has('front');
  const backPending = !!pendingSides?.has('back');
  const canContributeBack =
    CONTRIBUTIONS_ENABLED && !contributionPending && !!onContributeBack && !!frontUrl && !backUrl;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {card && (
            <>
              {/* Frente y reverso lado a lado. Sin reverso aprobado queda un
                  recuadro vacio (que sirve para aportarlo, si se puede). Si hay
                  reverso, tocar un lado lo elige como el que se reporta. */}
              <View style={styles.sidesRow}>
                <TouchableOpacity
                  activeOpacity={backUrl ? 0.8 : 1}
                  disabled={!backUrl}
                  onPress={() => setShowBack(false)}
                  style={styles.side}
                >
                  <View style={[styles.thumbWrap, backUrl && !viewingBack && styles.thumbSelected]}>
                    {frontUrl ? (
                      <Image
                        source={{ uri: frontUrl }}
                        style={styles.thumb}
                        contentFit="cover"
                        transition={150}
                        blurRadius={imageSource === 'legacy' ? LEGACY_BLUR_RADIUS : undefined}
                      />
                    ) : (
                      <View style={[styles.thumb, styles.placeholder, { backgroundColor: card.album_color + '33' }]}>
                        {frontPending ? (
                          <>
                            <Ionicons name="time-outline" size={22} color={COLORS.purple3} />
                            <Text style={[styles.emptyBackText, { color: COLORS.purple3, marginTop: 6 }]}>
                              {t('pendingSide')}
                            </Text>
                          </>
                        ) : (
                          <Text style={styles.memberInitial}>{card.member?.charAt(0) || '?'}</Text>
                        )}
                      </View>
                    )}
                    {/* Aportada por la comunidad: se firma con el @ de quien la
                        dono, con la misma pastilla lila de la grilla. Sin handle
                        va sin firmar, igual que en la grilla. */}
                    {imageSource === 'community' ? (
                      card.primary_image_handle ? (
                        <View style={styles.handleTag} pointerEvents="none">
                          <Text style={styles.handleTagText} numberOfLines={1}>
                            @{card.primary_image_handle}
                          </Text>
                        </View>
                      ) : null
                    ) : imageSource ? (
                      <View style={styles.sourceTag}>
                        <Text style={styles.sourceTagText} numberOfLines={1}>
                          {t('imageSourceLegacy')}
                        </Text>
                      </View>
                    ) : null}
                    {zoomFrontUrl && (
                      <ZoomButton label={t('zoomImage')} onPress={() => setZoomSide('front')} />
                    )}
                  </View>
                  <Text style={styles.sideLabel}>{t('sideFront')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={!backUrl && !canContributeBack}
                  onPress={backUrl ? () => setShowBack(true) : onContributeBack}
                  style={styles.side}
                >
                  {backUrl ? (
                    <View style={[styles.thumbWrap, viewingBack && styles.thumbSelected]}>
                      <Image
                        source={{ uri: backUrl }}
                        style={styles.thumb}
                        contentFit="cover"
                        transition={150}
                      />
                      {card.back_image_source === 'community' && card.back_image_handle ? (
                        <View style={styles.handleTag} pointerEvents="none">
                          <Text style={styles.handleTagText} numberOfLines={1}>
                            @{card.back_image_handle}
                          </Text>
                        </View>
                      ) : null}
                      {zoomBackUrl && (
                        <ZoomButton label={t('zoomImage')} onPress={() => setZoomSide('back')} />
                      )}
                    </View>
                  ) : (
                    <View style={[styles.thumbWrap, styles.emptyBack, backPending && styles.pendingSlot]}>
                      <Ionicons
                        name={backPending ? 'time-outline' : canContributeBack ? 'add' : 'image-outline'}
                        size={22}
                        color={backPending || canContributeBack ? COLORS.purple3 : 'rgba(255,255,255,0.25)'}
                      />
                      <Text style={[styles.emptyBackText, (backPending || canContributeBack) && { color: COLORS.purple3 }]}>
                        {backPending ? t('pendingSide') : canContributeBack ? t('contributeBackOnly') : t('noBack')}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.sideLabel}>{t('sideBack')}</Text>
                </TouchableOpacity>
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
                    <Text style={styles.dupLabel}>{t('copies')}</Text>
                    <Text style={styles.dupSub}>
                      {dupCount === 0 ? t('dupNone') : dupCount === 1 ? t('dupOne') : t('dupMany', { n: dupCount })}
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
                    <Text style={styles.dupCount}>{dupCount + 1}</Text>
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
              {onReport && visibleImageId != null && (
                <TouchableOpacity
                  onPress={reportSent ? undefined : () => onReport(visibleImageId)}
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
      <ImageZoomViewer
        side={zoomSide}
        frontUrl={zoomFrontUrl}
        backUrl={zoomBackUrl}
        frontHandle={card?.primary_image_source === 'community' ? card.primary_image_handle : null}
        backHandle={card?.back_image_source === 'community' ? card.back_image_handle ?? null : null}
        onChangeSide={setZoomSide}
        onClose={() => setZoomSide(null)}
      />
    </Modal>
  );
}

/** Lupa en la esquina de la miniatura: abre el visor ampliado. */
function ZoomButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.zoomBtn}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name="search" size={14} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  zoomBtn: {
    position: 'absolute', top: 5, right: 5,
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(22,10,48,0.75)',
    borderWidth: 1, borderColor: 'rgba(233,213,255,0.35)',
  },
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
  sidesRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  side: { alignItems: 'center' },
  thumbWrap: {
    width: 96, height: 144, borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
  },
  thumbSelected: { borderColor: COLORS.purple3 },
  emptyBack: {
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8,
    borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pendingSlot: { borderColor: 'rgba(216,180,254,0.55)', backgroundColor: 'rgba(168,85,247,0.10)' },
  emptyBackText: {
    fontSize: 10, fontWeight: '700', textAlign: 'center',
    color: 'rgba(255,255,255,0.35)',
  },
  sideLabel: { marginTop: 5, fontSize: 10, fontWeight: '700', color: COLORS.textMuted },
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
  handleTag: {
    position: 'absolute', bottom: 5, left: 5, maxWidth: '90%',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
    backgroundColor: '#E9D5FF',
  },
  handleTagText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2, color: '#2E1065' },
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
