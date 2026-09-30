import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  COLORS, MEMBER_MAP, RARITIES, STATUS_CONFIG,
  LEGACY_TREATMENT_ENABLED, LEGACY_BLUR_RADIUS, LEGACY_VEIL_COLOR,
  CONTRIBUTIONS_ENABLED,
} from '../lib/constants';
import { CardWithStatus } from '../lib/types';
import { getCardImageUrl } from '../lib/supabase';
import { useI18n } from '../lib/I18nContext';

// Atenuacion de las cartas NO marcadas como "Tengo". Son los dos unicos valores
// que hay que tocar para calibrar: la opacidad apaga la foto, el velo le mete el
// lila. Subirlos aclara las no adquiridas; bajarlos las apaga mas.
const NOT_OWNED_IMAGE_OPACITY = 0.65;
const NOT_OWNED_OVERLAY_OPACITY = 0.32;
const NOT_OWNED_OVERLAY_COLOR = `rgba(88,28,135,${NOT_OWNED_OVERLAY_OPACITY})`;

interface PhotocardProps {
  card: CardWithStatus;
  onPress: () => void;
  onLongPress?: () => void;
  /** Si esta persona ya tiene un aporte sin resolver para esta card. */
  contributionPending?: boolean;
}

export default function Photocard({
  card, onPress, onLongPress, contributionPending,
}: PhotocardProps) {
  const member = MEMBER_MAP[card.member];
  const rarity = RARITIES[card.rarity];
  const isOwned = card.status === 'have';
  const imageUrl = getCardImageUrl(card);
  const hasImage = !!imageUrl && !card.is_blurred;

  // Solo se marca lo que realmente viene del catalogo legacy. Una imagen
  // aportada por la comunidad y aprobada no lleva ninguna marca.
  const showLegacy =
    LEGACY_TREATMENT_ENABLED && hasImage && card.primary_image_source === 'legacy';

  const { t } = useI18n();

  const borderColor = isOwned
    ? (member?.colors[1] || COLORS.purple2)
    : 'rgba(168,85,247,0.25)';

  return (
    <View style={styles.container}>
      <View>
        <TouchableOpacity
          onPress={onPress}
          onLongPress={onLongPress}
          activeOpacity={0.7}
          style={[
            styles.card,
            { borderColor },
            isOwned && {
              shadowColor: member?.colors[1] || COLORS.purple2,
              shadowOpacity: 0.5,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 0 },
              elevation: 8,
            },
          ]}
        >
          {hasImage ? (
            <>
              <View style={styles.imageBg} />
              <Image
                source={{ uri: imageUrl! }}
                style={[styles.image, !isOwned && styles.imageNotOwned]}
                contentFit="contain"
                cachePolicy="disk"
                transition={150}
                blurRadius={showLegacy ? LEGACY_BLUR_RADIUS : 0}
              />
              {!isOwned && <View style={styles.purpleOverlay} />}
              {showLegacy && <View style={styles.legacyVeil} />}
            </>
          ) : (
            <View style={[
              styles.placeholder,
              { backgroundColor: member?.colors[0] || '#1a1a2e' },
            ]}>
              {/* El degradado del miembro va SIEMPRE, no solo en las adquiridas.
                  Antes una card vacia que no tenias quedaba en un plano casi
                  negro con la inicial al 40%: se leia como hueco roto, no como
                  "esta card existe y le falta la foto". El color del miembro es
                  lo que deja identificarla de un vistazo. */}
              <LinearGradient
                colors={member
                  ? [member.colors[0], member.colors[1] + 'aa', member.colors[2] + '66']
                  : ['#2a1a4a', '#1a1030']}
                style={[StyleSheet.absoluteFill, !isOwned && styles.placeholderDim]}
              />
              <Text style={styles.emptyInitial}>
                {card.member?.charAt(0) || '?'}
              </Text>
              {/* Mismo lenguaje que la marca de las legacy, para que las dos
                  situaciones se lean como parte del mismo sistema. */}
              <Text style={styles.emptyLabel}>{t('imageMissingBadge')}</Text>

              {/* Card sin imagen: invitacion discreta a aportar una. Es el mismo
                  estado tanto si nunca tuvo como si se retiro -- para quien mira,
                  la accion posible es la misma, y no hace falta airear que hubo
                  un reclamo de derechos.

                  Va abajo a la IZQUIERDA porque el icono de estado ocupa la
                  derecha. Solo abre el modal, que es donde vive el flujo: la
                  pastilla es una pista, no un boton aparte. */}
              {CONTRIBUTIONS_ENABLED && !contributionPending && (
                <View style={styles.addHint} pointerEvents="none">
                  <Ionicons name="add" size={10} color={COLORS.purple3} />
                  <Text style={styles.addHintText}>{t('contributeShort')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Rarity badge — only for owned */}
          {isOwned && rarity && (
            <View style={styles.rarityBadge}>
              <Text style={[styles.rarityText, { color: rarity.color }]}>{rarity.symbol}</Text>
            </View>
          )}

          {/* Duplicate count badge */}
          {isOwned && card.duplicate_count > 0 && (
            <View style={styles.dupBadge}>
              <Text style={styles.dupText}>×{card.duplicate_count + 1}</Text>
            </View>
          )}

          {/* Bottom gradient */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.55)']}
            style={styles.bottomGrad}
          />

          {/* Marca de legacy — centrada sobre la imagen. Va centrada y no en una
              esquina porque las cuatro ya estan ocupadas (rareza, duplicados,
              estado) y porque el objetivo es que se lea como una marca de agua
              sobre la foto, no como un badge mas. */}
          {showLegacy && (
            <View style={styles.legacyOverlay} pointerEvents="none">
              <Ionicons name="image-outline" size={15} color="rgba(255,255,255,0.8)" />
              <Text style={styles.legacyOverlayText}>{t('imageLegacyBadge')}</Text>
            </View>
          )}

          {/* Attribution — sólo en las aportadas por la comunidad, y sólo si
              quien la aportó tiene handle. Va abajo a la izquierda: la derecha
              es del icono de estado, y la pastilla de "+ Aportar" nunca coincide
              con esta porque aquella sólo sale cuando NO hay imagen. */}
          {card.primary_image_source === 'community' && card.primary_image_handle && (
            <View style={styles.attribution} pointerEvents="none">
              <Ionicons name="person-circle" size={11} color={COLORS.purple4} />
              <Text style={styles.attributionText} numberOfLines={1}>
                @{card.primary_image_handle}
              </Text>
            </View>
          )}

          {/* Status icon — bottom-right corner of image */}
          <View style={styles.statusCorner}>
            {isOwned ? (
              <View style={styles.dotOwned}>
                <Text style={styles.checkOwned}>✓</Text>
              </View>
            ) : card.status === 'want' ? (
              <Ionicons name="heart" size={17} color={STATUS_CONFIG.want.color} />
            ) : card.status === 'otw' ? (
              <Ionicons name="cart" size={17} color={STATUS_CONFIG.otw.color} />
            ) : card.status === 'not_collecting' ? (
              <View style={styles.dotNone}>
                <Text style={styles.checkNone}>{STATUS_CONFIG.not_collecting.icon}</Text>
              </View>
            ) : (
              <Ionicons name="ellipse-outline" size={16} color={COLORS.textMuted} />
            )}
          </View>

        </TouchableOpacity>
      </View>

      {/* Card name below card */}
      <View style={styles.status}>
        {card.card_name ? (
          <Text style={styles.cardSetName} numberOfLines={2}>
            {card.card_name.toUpperCase()}
          </Text>
        ) : null}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '31%',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  card: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
  },
  imageBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0d0520',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageNotOwned: {
    opacity: NOT_OWNED_IMAGE_OPACITY,
  },
  purpleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NOT_OWNED_OVERLAY_COLOR,
  },
  legacyVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LEGACY_VEIL_COLOR,
  },
  attribution: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    maxWidth: '72%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: 'rgba(88,28,135,0.82)',
  },
  attributionText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.purple4,
    letterSpacing: 0.2,
  },
  addHint: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    backgroundColor: 'rgba(168,85,247,0.14)',
  },
  addHintText: {
    fontSize: 8,
    fontWeight: '800',
    color: COLORS.purple3,
    letterSpacing: 0.2,
  },
  legacyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  legacyOverlayText: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 11,
    // La sombra es lo que la hace legible sobre una foto borrosa de cualquier
    // color; sin ella se pierde en las claras.
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowRadius: 3,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderDim: {
    // Las no adquiridas siguen apagandose respecto de las que si tienes, pero
    // lo justo para que el color del miembro se siga distinguiendo.
    opacity: 0.55,
  },
  emptyInitial: {
    fontSize: 28,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  emptyLabel: {
    marginTop: 1,
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.4,
    lineHeight: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  rarityBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rarityText: {
    fontSize: 12,
  },
  dupBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(168,85,247,0.85)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  dupText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '800',
  },
  bottomGrad: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 35,
  },
  statusCorner: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardName: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.3,
    lineHeight: 11,
    textAlign: 'center',
  },
  status: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    width: '100%',
  },
  dotOwned: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ADE80',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  checkOwned: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '900',
  },
  nameOwned: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  dotNone: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  checkNone: {
    fontSize: 11,
    color: '#8B70AA',
    fontWeight: '900',
  },
  nameNone: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B70AA',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardSetName: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
