import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
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
import {
  MyContribution,
  useMyContributions,
  useMyHandle,
} from '../../hooks/useMyContributions';
import { CARD_SUBMISSIONS_ENABLED, COLORS } from '../../lib/constants';
import { rejectionReasonKey } from '../../lib/submissions';
import { useI18n } from '../../lib/I18nContext';
import { ImageStatus } from '../../lib/types';

/**
 * Aportes: donde vive lo que esta persona ha aportado.
 *
 * POR QUE ES UN TAB Y NO UN BOTON
 *
 * Un tab es un lugar al que se vuelve, no una accion que se hace una vez. Si
 * esto solo abriera el formulario seria un boton disfrazado de destino: entras,
 * subes, y no hay razon para volver.
 *
 * Lo que justifica el sitio fijo es la lista de abajo. Antes se podia aportar y
 * no habia NINGUN sitio donde enterarse de si se aprobo: quien aporta a ciegas
 * no aporta dos veces. Aportar es la accion de arriba; saber en que quedo es la
 * razon de volver.
 */

const STATUS_STYLE: Record<ImageStatus, { color: string; icon: any; key: string }> = {
  pending:  { color: COLORS.gold,  icon: 'time-outline',            key: 'statusPendingReview' },
  approved: { color: COLORS.green, icon: 'checkmark-circle-outline', key: 'statusApproved' },
  rejected: { color: COLORS.pink,  icon: 'close-circle-outline',     key: 'statusRejected' },
};

export default function ContributionsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { userId } = useAuth();
  const { items, loading, error, refetch, silentRefetch } = useMyContributions(userId);
  const { handle, refetch: refetchHandle } = useMyHandle(userId);

  // Volver de la bandeja de moderacion es justo cuando esta lista cambia: lo
  // que estaba "en revision" pasa a aprobado o rechazado. Sin esto se quedaba
  // con lo que hubiera al montar la tab, que es la primera vez que entras.
  useFocusEffect(useCallback(() => {
    silentRefetch();
    // Al volver de ponerse el nombre de usuario, para que el aviso se vaya solo.
    refetchHandle();
  }, [silentRefetch, refetchHandle]));

  const refreshAll = useCallback(() => {
    refetch();
  }, [refetch]);

  /**
   * El motivo, legible. `rejection_reason` guarda el token del enum
   * ('wrong_card'), util para agrupar pero ilegible para quien aporto; los
   * retiros que vienen de un reporte escriben una frase libre, y esa se muestra
   * tal cual.
   */
  const reasonText = (reason: string) => {
    const key = rejectionReasonKey(reason);
    return key ? t(key as any) : reason;
  };

  const openContribution = (item: MyContribution) => {
    // Solo lleva a algun sitio si ya esta publicada: una pendiente todavia no
    // se ve en el album, y una rechazada no llego a existir.
    if (item.status === 'approved' && item.albumId != null) {
      router.push(`/album/${item.albumId}`);
    }
  };

  return (
    <View style={styles.root}>
      <GalaxyBackground />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('tabContributions')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refreshAll} tintColor={COLORS.purple2} />
          }
        >
          {/* La accion, arriba y grande: es a lo que se viene la primera vez. */}
          {CARD_SUBMISSIONS_ENABLED && (
            <TouchableOpacity
              onPress={() => router.push('/contribute/new-card')}
              activeOpacity={0.85}
              style={styles.cta}
            >
              <Ionicons name="add-circle" size={26} color="#fff" />
              <View style={styles.flex}>
                <Text style={styles.ctaTitle}>{t('newCardEntry')}</Text>
                <Text style={styles.ctaDesc}>{t('newCardEntryDesc')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          )}

          {/* Solo si YA aporto algo: antes de aportar, pedir un handle es
              pedir un dato porque si. */}
          {!handle && items.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/profile?handle=1')}
              activeOpacity={0.8}
            >
              <GlassCard style={styles.handleCard}>
                <Ionicons name="at" size={18} color={COLORS.gold} />
                <View style={styles.flex}>
                  <Text style={styles.handleTitle}>{t('handleNudgeTitle')}</Text>
                  <Text style={styles.handleDesc}>{t('handleNudgeDesc')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </GlassCard>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>{t('myContributions')}</Text>

          {loading ? (
            <ActivityIndicator color={COLORS.purple2} style={styles.spinner} />
          ) : error ? (
            <ErrorView message={error} onRetry={refetch} />
          ) : items.length === 0 ? (
            <GlassCard style={styles.empty}>
              <Ionicons name="sparkles-outline" size={26} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>{t('myContributionsEmpty')}</Text>
              <Text style={styles.emptyDesc}>{t('myContributionsEmptyDesc')}</Text>
            </GlassCard>
          ) : (
            items.map(item => {
              const status = STATUS_STYLE[item.status];
              const openable = item.status === 'approved' && item.albumId != null;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => openContribution(item)}
                  activeOpacity={openable ? 0.8 : 1}
                  disabled={!openable}
                >
                  <GlassCard style={styles.item}>
                    <View style={styles.itemRow}>
                      {item.thumbUrl ? (
                        <Image source={{ uri: item.thumbUrl }} style={styles.thumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.thumb, styles.thumbEmpty]}>
                          <Ionicons name="image-outline" size={16} color={COLORS.textMuted} />
                        </View>
                      )}

                      <View style={styles.flex}>
                        <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                        {item.subtitle ? (
                          <Text style={styles.itemSub} numberOfLines={1}>{item.subtitle}</Text>
                        ) : null}

                        {/* Que se aporto: una card nueva o una imagen para una
                            que ya existia. Cambia lo que significa "aprobada". */}
                        <Text style={styles.kind}>
                          {t(item.kind === 'card' ? 'contributionKindCard' : 'contributionKindImage')}
                        </Text>

                        <View style={styles.statusRow}>
                          <Ionicons name={status.icon} size={13} color={status.color} />
                          <Text style={[styles.statusText, { color: status.color }]}>
                            {t(status.key as any)}
                          </Text>
                        </View>
                      </View>

                      {openable && (
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
                      )}
                    </View>

                    {/* El motivo del rechazo se muestra entero: es lo unico que
                        permite corregir y volver a intentarlo. */}
                    {item.status === 'rejected' && item.rejectionReason ? (
                      <Text style={styles.reason}>{reasonText(item.rejectionReason)}</Text>
                    ) : null}
                  </GlassCard>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },

  body: { padding: 12, gap: 10, paddingBottom: 28 },

  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
    borderRadius: 16, backgroundColor: COLORS.purple1,
  },
  ctaTitle: { fontSize: 14, fontWeight: '800', color: '#fff' },
  ctaDesc: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },


  handleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderColor: COLORS.gold + '44',
  },
  handleTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  handleDesc: { fontSize: 11, lineHeight: 15, color: COLORS.textMuted, marginTop: 2 },

  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.textMuted,
    letterSpacing: 0.6, marginTop: 8, marginLeft: 4,
  },
  spinner: { marginTop: 28 },

  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: COLORS.textPrimary },
  emptyDesc: { fontSize: 12, color: COLORS.textMuted, textAlign: 'center' },

  item: { gap: 0 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  thumb: {
    width: 46, aspectRatio: 2 / 3, borderRadius: 7,
    backgroundColor: '#0d0520',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textPrimary },
  itemSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  kind: { fontSize: 9, color: COLORS.textMuted, marginTop: 3, letterSpacing: 0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  statusText: { fontSize: 11, fontWeight: '800' },
  reason: {
    fontSize: 11, fontStyle: 'italic', color: COLORS.textSecondary,
    marginTop: 9, lineHeight: 15, marginLeft: 57,
  },
});
