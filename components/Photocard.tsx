import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, MEMBER_MAP, RARITIES, STATUS_CONFIG } from '../lib/constants';
import { CardWithStatus } from '../lib/types';
import { getPhotocardUrl } from '../lib/supabase';
import { useI18n } from '../lib/I18nContext';

interface PhotocardProps {
  card: CardWithStatus;
  onPress: () => void;
  onLongPress?: () => void;
}

export default function Photocard({ card, onPress, onLongPress }: PhotocardProps) {
  const member = MEMBER_MAP[card.member];
  const rarity = RARITIES[card.rarity];
  const isOwned = card.status === 'have';
  const hasImage = card.image_path && !card.is_blurred;

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
                source={{ uri: getPhotocardUrl(card.image_path!) }}
                style={[styles.image, !isOwned && styles.imageNotOwned]}
                contentFit="contain"
                cachePolicy="disk"
                transition={150}
              />
              {!isOwned && <View style={styles.purpleOverlay} />}
            </>
          ) : (
            <View style={[
              styles.placeholder,
              { backgroundColor: isOwned ? (member?.colors[0] || '#1a1a2e') : '#120828' },
            ]}>
              {isOwned ? (
                <LinearGradient
                  colors={member ? [member.colors[0], member.colors[1] + 'aa', member.colors[2] + '66'] : ['#2a1a4a', '#1a1030']}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text style={[styles.emoji, !isOwned && { opacity: 0.4 }]}>
                {card.member?.charAt(0) || '?'}
              </Text>
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
            ) : (
              <View style={styles.dotNone}>
                <Text style={styles.checkNone}>{STATUS_CONFIG.not_collecting.icon}</Text>
              </View>
            )}
          </View>

        </TouchableOpacity>
      </View>

      {/* Card name below card */}
      <View style={styles.status}>
        {card.version_short && (
          <Text style={styles.versionTag}>Ver. {card.version_short}</Text>
        )}
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
    opacity: 0.65,
  },
  purpleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(88,28,135,0.45)',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 32,
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
  versionTag: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.purple3,
    letterSpacing: 0.5,
  },
  cardSetName: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});
