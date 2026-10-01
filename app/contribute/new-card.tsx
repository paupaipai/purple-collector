import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImagePickerAsset } from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import ErrorView from '../../components/ErrorView';
import GalaxyBackground from '../../components/GalaxyBackground';
import GlassCard from '../../components/GlassCard';
import ImageCropper, { CropRect } from '../../components/ImageCropper';
import PickerField, { PickerOption } from '../../components/PickerField';
import { useAuth } from '../../hooks/useAuth';
import {
  useCatalogTaxonomy,
  useExistingCards,
  useFilteredCardSets,
} from '../../hooks/useCatalogTaxonomy';
import { CARD_SUBMISSIONS_ENABLED, COLORS, MEMBERS } from '../../lib/constants';
import {
  ContributionFailure,
  normalizeToPhotocard,
  pickContributionImage,
  submitContribution,
} from '../../lib/contributions';
import { useDialog } from '../../lib/DialogContext';
import { useI18n } from '../../lib/I18nContext';
import { getCardImageUrl } from '../../lib/supabase';
import { CardFull } from '../../lib/types';
import { isDraftComplete, NewCardDraft, submitNewCard, SubmissionFailure } from '../../lib/submissions';

/**
 * Proponer una card que no esta en el catalogo.
 *
 * Es una pantalla y no un modal porque son seis niveles de taxonomia mas la
 * foto: no cabe en un popup, y a medio llenar no se puede perder por un toque
 * fuera.
 *
 * EL ORDEN DE LA PANTALLA
 *
 * La foto va primera aunque en la base sea una columna mas. Es lo que la
 * persona ya tiene en la mano --abrio esto porque tiene la foto de una card que
 * no encontro-- y verla ahi arriba confirma que va bien encaminada antes de
 * pedirle seis respuestas.
 *
 * SE PROPONE UNA CARD, NO UN ALBUM
 *
 * Los seis selectores solo ofrecen lo que ya existe. Si el album falta de
 * verdad, eso va en las notas y lo crea un mantenedor: dejar crear albums desde
 * aca multiplicaria la moderacion, porque un album mal creado arrastra eras,
 * versiones y sets detras.
 *
 * Acepta `?albumId=` para llegar desde un album ya elegido, y en ese caso
 * rellena tipo y era hacia atras.
 */
export default function NewCardScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { alert } = useDialog();
  const { userId } = useAuth();
  const params = useLocalSearchParams<{ albumId?: string }>();

  const taxonomy = useCatalogTaxonomy();

  const [typeId, setTypeId] = useState<number | null>(null);
  const [eraId, setEraId] = useState<number | null>(null);
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [versionId, setVersionId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cardSetId, setCardSetId] = useState<number | null>(null);
  const [member, setMember] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');
  const [notes, setNotes] = useState('');

  const [asset, setAsset] = useState<ImagePickerAsset | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [cropping, setCropping] = useState<ImagePickerAsset | null>(null);
  const [sending, setSending] = useState(false);
  // La miniatura tiene que ser el ENCUADRE elegido, no la foto original metida
  // en un marco 2:3: si no, la pantalla muestra algo distinto de lo que se va a
  // enviar. Sale de normalizeToPhotocard(), la misma funcion que aplica el
  // recorte al subir.
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const { sets } = useFilteredCardSets(albumId, versionId, categoryId);

  // Las cards que ya existen en este hueco. Avisar llega tarde si se hace al
  // enviar: para entonces la persona ya respondio todo el formulario.
  const { cards: existentes } = useExistingCards({ albumId, versionId, categoryId, member });

  // Llegada desde un album: se rellenan los dos niveles de arriba a partir de
  // el, porque pedirlos de nuevo seria hacer repetir algo ya dicho.
  useEffect(() => {
    const incoming = params.albumId ? Number(params.albumId) : null;
    if (!incoming || taxonomy.loading || albumId != null) return;

    const album = taxonomy.albums.find(a => a.id === incoming);
    if (!album) return;
    const era = taxonomy.eras.find(e => e.id === album.era_id);

    setAlbumId(album.id);
    setEraId(era?.id ?? null);
    setTypeId(era?.collection_type_id ?? null);
  }, [params.albumId, taxonomy.loading, taxonomy.albums, taxonomy.eras, albumId]);

  const versions = taxonomy.versionsOf(albumId);

  const typeOptions: PickerOption[] = useMemo(
    () => taxonomy.types.map(x => ({ value: x.id, label: x.name })),
    [taxonomy.types],
  );
  const eraOptions: PickerOption[] = useMemo(
    () => taxonomy.erasOf(typeId).map(x => ({ value: x.id, label: x.name })),
    [taxonomy, typeId],
  );
  const albumOptions: PickerOption[] = useMemo(
    () => taxonomy.albumsOf(eraId).map(x => ({
      value: x.id,
      label: x.name,
      sublabel: x.release_year ? String(x.release_year) : undefined,
    })),
    [taxonomy, eraId],
  );
  const versionOptions: PickerOption[] = useMemo(
    () => versions.map(x => ({ value: x.id, label: x.name })),
    [versions],
  );
  const categoryOptions: PickerOption[] = useMemo(
    () => taxonomy.categories.map(x => ({ value: x.id, label: x.name })),
    [taxonomy.categories],
  );
  const setOptions: PickerOption[] = useMemo(
    () => sets.map(x => ({
      value: x.id,
      label: x.name,
      sublabel: [x.retailer, x.country, x.draw_type].filter(Boolean).join(' · ') || undefined,
    })),
    [sets],
  );

  // Elegir un nivel invalida los de abajo: una version de otro album no
  // describe ninguna card real, y el trigger de la base la rechazaria.
  const chooseType = (value: number | string | null) => {
    setTypeId(value as number | null);
    setEraId(null); setAlbumId(null); setVersionId(null); setCardSetId(null);
  };
  const chooseEra = (value: number | string | null) => {
    setEraId(value as number | null);
    setAlbumId(null); setVersionId(null); setCardSetId(null);
  };
  const chooseAlbum = (value: number | string | null) => {
    setAlbumId(value as number | null);
    setVersionId(null); setCardSetId(null);
  };
  const chooseVersion = (value: number | string | null) => {
    setVersionId(value as number | null);
    setCardSetId(null);
  };
  const chooseCategory = (value: number | string | null) => {
    setCategoryId(value as number | null);
    setCardSetId(null);
  };

  const draft: NewCardDraft = {
    albumId, versionId, categoryId, cardSetId, member, cardName, notes,
  };
  const ready = isDraftComplete(draft) && !!asset && !sending;

  const failureText = (reason: SubmissionFailure | ContributionFailure) => {
    if (reason === 'unavailable') return t('contributeErrUnavailable');
    if (reason === 'read_failed') return t('contributeErrReadFailed');
    if (reason === 'permission') return t('contributeErrPermission');
    if (reason === 'too_large') return t('contributeErrTooLarge');
    if (reason === 'bad_type') return t('contributeErrBadType');
    if (reason === 'duplicate') return t('newCardErrDuplicate');
    if (reason === 'incomplete') return t('newCardErrIncomplete');
    return t('contributeErrFailed');
  };

  const pickPhoto = async () => {
    const picked = await pickContributionImage();
    if (!picked.ok) {
      if (picked.reason !== 'cancelled') {
        alert(t('newCardTitle'), failureText(picked.reason));
      }
      return;
    }
    setCropping(picked.asset);
  };

  /**
   * Redirige la foto que ya eligio a una card que YA existe.
   *
   * No la manda al album a buscarla: la foto y el encuadre ya estan hechos, y
   * perderlos para repetirlos alli seria castigar a quien hizo lo correcto.
   * Esto es exactamente lo que habria pasado de no haber creado un duplicado.
   */
  const contributeToExisting = (card: CardFull) => {
    if (!asset) {
      alert(t('newCardTitle'), t('newCardNeedImage'));
      return;
    }
    alert(t('contributeTitle'), t('contributeRights'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('contributeConfirm'),
        onPress: async () => {
          setSending(true);
          const sent = await submitContribution({
            cardId: card.id,
            userId,
            asset,
            crop: crop ?? undefined,
          });
          setSending(false);

          if (!sent.ok) {
            alert(t('contributeTitle'), failureText(sent.reason));
            return;
          }
          alert(t('contributeSent'), t('contributeSentDesc'), [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
      },
    ]);
  };

  const send = () => {
    if (!asset) {
      alert(t('newCardTitle'), t('newCardNeedImage'));
      return;
    }
    // Este aviso ES la aceptacion de terminos: submitNewCard() graba
    // terms_accepted_at y terms_version, y la constraint
    // card_submissions_has_terms no deja registrar la propuesta sin ellos.
    alert(t('newCardTitle'), t('contributeRights'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('newCardSend'),
        onPress: async () => {
          setSending(true);
          const sent = await submitNewCard({
            userId,
            draft,
            asset,
            crop: crop ?? undefined,
          });
          setSending(false);

          if (!sent.ok) {
            alert(t('newCardTitle'), failureText(sent.reason));
            return;
          }
          alert(t('newCardSent'), t('newCardSentDesc'), [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
      },
    ]);
  };

  // El gate de verdad es la policy de INSERT; esto solo evita mostrar un
  // formulario que no lleva a ningun sitio mientras la bandeja no este lista.
  if (!CARD_SUBMISSIONS_ENABLED) {
    return (
      <View style={styles.root}>
        <GalaxyBackground />
        <SafeAreaView style={styles.flex}>
          <ErrorView message={t('newCardDisabled')} onRetry={() => router.back()} />
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
          <Text style={styles.title}>{t('newCardTitle')}</Text>
        </View>

        {taxonomy.loading ? (
          <View style={styles.centered}><ActivityIndicator color={COLORS.purple2} /></View>
        ) : taxonomy.error ? (
          <ErrorView message={taxonomy.error} onRetry={taxonomy.refetch} />
        ) : (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
              <Text style={styles.intro}>{t('newCardIntro')}</Text>

              {/* La foto primero: es lo que la persona ya tiene. */}
              <GlassCard style={styles.card}>
                <Text style={styles.sectionTitle}>{t('newCardImage')}</Text>
                <View style={styles.photoRow}>
                  <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={styles.photoFrame}>
                    {asset ? (
                      <Image
                        source={{ uri: previewUri ?? asset.uri }}
                        style={styles.photo}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={styles.photoEmpty}>
                        <Ionicons name="image-outline" size={24} color={COLORS.purple3} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <View style={styles.photoSide}>
                    <Text style={styles.photoHint}>{t('newCardImageHint')}</Text>
                    <TouchableOpacity onPress={pickPhoto} activeOpacity={0.7} style={styles.photoBtn}>
                      <Ionicons name={asset ? 'swap-horizontal' : 'add'} size={15} color={COLORS.purple3} />
                      <Text style={styles.photoBtnText}>
                        {t(asset ? 'newCardChangeImage' : 'newCardPickImage')}
                      </Text>
                    </TouchableOpacity>
                    {asset ? (
                      <TouchableOpacity
                        onPress={() => setCropping(asset)}
                        activeOpacity={0.7}
                        style={styles.photoBtn}
                      >
                        <Ionicons name="crop-outline" size={15} color={COLORS.purple3} />
                        <Text style={styles.photoBtnText}>{t('cropConfirm')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </GlassCard>

              {/* La taxonomia, en cascada. */}
              <GlassCard style={styles.card}>
                <Text style={styles.sectionTitle}>{t('newCardWhere')}</Text>

                <PickerField
                  label={t('fieldType')} required
                  options={typeOptions} value={typeId} onChange={chooseType}
                  placeholder={t('pickerChoose')}
                />
                <PickerField
                  label={t('fieldEra')} required
                  options={eraOptions} value={eraId} onChange={chooseEra}
                  placeholder={t('pickerChoose')} disabled={typeId == null}
                />
                <PickerField
                  label={t('fieldAlbum')} required
                  options={albumOptions} value={albumId} onChange={chooseAlbum}
                  placeholder={t('pickerChoose')} disabled={eraId == null}
                />
                <PickerField
                  label={t('fieldVersion')} clearable
                  options={versionOptions} value={versionId} onChange={chooseVersion}
                  placeholder={t('pickerOptional')} disabled={albumId == null}
                />
                <PickerField
                  label={t('fieldCategory')} required
                  options={categoryOptions} value={categoryId} onChange={chooseCategory}
                  placeholder={t('pickerChoose')}
                />
                <PickerField
                  label={t('fieldCardSet')} clearable
                  options={setOptions} value={cardSetId}
                  onChange={v => setCardSetId(v as number | null)}
                  placeholder={t('pickerOptional')} disabled={albumId == null}
                />
              </GlassCard>

              {/* La card en si. */}
              <GlassCard style={styles.card}>
                <Text style={styles.sectionTitle}>{t('newCardWhat')}</Text>

                <Text style={styles.fieldLabel}>
                  {t('fieldMember')}<Text style={styles.required}> *</Text>
                </Text>
                <View style={styles.chips}>
                  {[...MEMBERS.map(m => m.name), 'Group'].map(name => {
                    const active = member === name;
                    return (
                      <TouchableOpacity
                        key={name}
                        onPress={() => setMember(name)}
                        activeOpacity={0.7}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {name === 'Group' ? t('memberGroup') : name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>
                  {t('fieldCardName')}<Text style={styles.required}> *</Text>
                </Text>
                <TextInput
                  value={cardName}
                  onChangeText={setCardName}
                  placeholder={t('newCardNamePlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  maxLength={120}
                />

                <Text style={styles.fieldLabel}>{t('fieldNotes')}</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t('newCardNotesPlaceholder')}
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.input, styles.inputMulti]}
                  multiline
                  maxLength={500}
                />
              </GlassCard>

              {existentes.length > 0 && (
                <GlassCard style={styles.warn}>
                  <View style={styles.warnHead}>
                    <Ionicons name="alert-circle" size={17} color={COLORS.gold} />
                    <Text style={styles.warnTitle}>
                      {t('duplicateWarnTitle', { n: existentes.length })}
                    </Text>
                  </View>
                  <Text style={styles.warnDesc}>{t('duplicateWarnDesc')}</Text>

                  {existentes.map(card => {
                    const url = getCardImageUrl(card);
                    return (
                      <View key={card.id} style={styles.warnRow}>
                        {url ? (
                          <Image source={{ uri: url }} style={styles.warnThumb} contentFit="cover" />
                        ) : (
                          <View style={[styles.warnThumb, styles.warnThumbEmpty]}>
                            <Ionicons name="image-outline" size={14} color={COLORS.textMuted} />
                          </View>
                        )}
                        <View style={styles.flex}>
                          <Text style={styles.warnName} numberOfLines={2}>{card.card_name}</Text>
                          <Text style={styles.warnMeta} numberOfLines={1}>
                            {[card.version_name, url ? t('duplicateHasImage') : t('duplicateNoImage')]
                              .filter(Boolean).join(' \u00b7 ')}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => contributeToExisting(card)}
                          disabled={sending}
                          activeOpacity={0.7}
                          style={styles.warnBtn}
                        >
                          <Text style={styles.warnBtnText}>{t('duplicateUseThis')}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  <Text style={styles.warnFoot}>{t('duplicateWarnFoot')}</Text>
                </GlassCard>
              )}

              <TouchableOpacity
                onPress={send}
                disabled={!ready}
                activeOpacity={0.8}
                style={[styles.send, !ready && styles.sendDisabled]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendText}>{t('newCardSend')}</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.terms}>{t('newCardTerms')}</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>

      <ImageCropper
        visible={!!cropping}
        uri={cropping?.uri ?? null}
        imageWidth={cropping?.width ?? 0}
        imageHeight={cropping?.height ?? 0}
        onCancel={() => setCropping(null)}
        onConfirm={async rect => {
          const picked = cropping;
          setAsset(picked);
          setCrop(rect);
          setCropping(null);
          if (!picked) return;

          // Si el recorte de la vista previa falla no se bloquea nada: se
          // muestra la original y el envio vuelve a intentarlo por su cuenta.
          try {
            const framed = await normalizeToPhotocard(
              picked,
              picked.mimeType ?? 'image/jpeg',
              rect,
            );
            setPreviewUri(framed?.uri ?? picked.uri);
          } catch {
            setPreviewUri(picked.uri);
          }
        }}
      />
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

  body: { padding: 12, gap: 12, paddingBottom: 40 },
  intro: { fontSize: 12, lineHeight: 17, color: COLORS.textSecondary },
  card: { gap: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.purple3 },

  photoRow: { flexDirection: 'row', gap: 12 },
  photoFrame: {
    width: 88, aspectRatio: 2 / 3, borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.borderActive, backgroundColor: '#0d0520',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  photoSide: { flex: 1, gap: 8, justifyContent: 'center' },
  photoHint: { fontSize: 11, lineHeight: 15, color: COLORS.textMuted },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface2,
  },
  photoBtnText: { fontSize: 11, fontWeight: '800', color: COLORS.purple3 },

  fieldLabel: {
    fontSize: 11, fontWeight: '800', color: COLORS.textSecondary,
    letterSpacing: 0.2, marginTop: 2,
  },
  required: { color: COLORS.pink },
  input: {
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceGlass,
    color: COLORS.textPrimary, fontSize: 13,
  },
  inputMulti: { minHeight: 68, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceGlass,
  },
  chipActive: { borderColor: COLORS.borderActive, backgroundColor: 'rgba(168,85,247,0.18)' },
  chipText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.purple3, fontWeight: '800' },

  warn: { gap: 8, borderColor: COLORS.gold + '55' },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  warnTitle: { flex: 1, fontSize: 13, fontWeight: '800', color: COLORS.gold },
  warnDesc: { fontSize: 11, lineHeight: 15, color: COLORS.textSecondary },
  warnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  warnThumb: {
    width: 38, aspectRatio: 2 / 3, borderRadius: 6,
    backgroundColor: '#0d0520',
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)',
  },
  warnThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  warnName: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },
  warnMeta: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  warnBtn: {
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9,
    borderWidth: 1, borderColor: COLORS.borderActive,
    backgroundColor: 'rgba(168,85,247,0.14)',
  },
  warnBtnText: { fontSize: 10, fontWeight: '800', color: COLORS.purple3 },
  warnFoot: { fontSize: 10, lineHeight: 14, color: COLORS.textMuted, fontStyle: 'italic' },

  send: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderRadius: 14, backgroundColor: COLORS.purple1,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  terms: { fontSize: 10, lineHeight: 14, color: COLORS.textMuted, textAlign: 'center' },
});
