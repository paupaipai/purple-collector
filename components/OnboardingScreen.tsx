import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, MEMBERS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';
import { BiasKey } from '../lib/types';
import GalaxyBackground from './GalaxyBackground';

const MEMBER_IMAGES: Record<string, any> = {
  'RM':       require('../assets/images/bts/rm.png'),
  'Jin':      require('../assets/images/bts/jin.png'),
  'Suga':     require('../assets/images/bts/suga.png'),
  'J-Hope':   require('../assets/images/bts/jhope.png'),
  'Jimin':    require('../assets/images/bts/jimin.png'),
  'V':        require('../assets/images/bts/v.png'),
  'Jungkook': require('../assets/images/bts/jungkook.png'),
};

interface Props {
  onFinish: (biases: BiasKey[]) => void;
  initialBiases?: BiasKey[];
  isEditing?: boolean;
  onCancel?: () => void;
}

export default function OnboardingScreen({
  onFinish,
  initialBiases = [],
  isEditing = false,
  onCancel,
}: Props) {
  const [selected, setSelected] = useState<BiasKey[]>(initialBiases);
  const { t } = useI18n();

  const toggle = (key: BiasKey) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground showIcons={false} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {isEditing && onCancel && (
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}

        <View style={styles.header}>
          <Text style={styles.title}>{t('onboardingSubtitle')}</Text>
          <Text style={styles.subtitle}>{t('onboardingBiasSubtitle')}</Text>
        </View>

        <View style={styles.grid}>
          {MEMBERS.map(m => {
            const active = selected.includes(m.key);
            return (
              <TouchableOpacity
                key={m.key}
                activeOpacity={0.75}
                onPress={() => toggle(m.key)}
                style={[
                  styles.card,
                  { borderColor: active ? m.colors[1] : 'rgba(255,255,255,0.08)' },
                  active && {
                    shadowColor: m.colors[1],
                    shadowOpacity: 0.55,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                  },
                ]}
              >
                {active && (
                  <LinearGradient
                    colors={[m.colors[0] + 'CC', m.colors[1] + '44']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}

                {active && (
                  <View style={[styles.checkCorner, { backgroundColor: m.colors[1] }]}>
                    <Ionicons name="checkmark" size={10} color="#fff" />
                  </View>
                )}

                <View style={[
                  styles.photoBorder,
                  { borderColor: active ? COLORS.purple2 : 'transparent' },
                ]}>
                  <View style={styles.photoClip}>
                    <Image
                      source={MEMBER_IMAGES[m.name]}
                      style={styles.photo}
                      contentFit="cover"
                    />
                  </View>
                </View>

                <Text style={[styles.name, active && { color: '#fff' }]}>{m.name}</Text>
                <Text style={styles.fullName}>{m.fullName}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Primary button */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => onFinish(selected)}
          style={styles.cta}
        >
          <LinearGradient
            colors={[COLORS.purple1, COLORS.pink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGrad}
          >
            <Text style={styles.ctaText}>
              {isEditing ? t('saveChanges') : t('continue')}
            </Text>
            {!isEditing && selected.length > 0 && (
              <Ionicons name="heart" size={16} color="#fff" style={{ marginLeft: 6 }} />
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Skip button — only in initial onboarding */}
        {!isEditing && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onFinish([])}
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>{t('onboardingSkip')}</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { paddingHorizontal: 20, paddingBottom: 50 },

  cancelBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
    padding: 6,
  },

  header: { alignItems: 'center', marginTop: 20, marginBottom: 28 },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 28,
  },
  card: {
    width: '44%',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
    position: 'relative',
  },
  checkCorner: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    zIndex: 1,
  },
  photoBorder: {
    width: 67,
    height: 67,
    borderRadius: 33.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  photoClip: {
    width: 67,
    height: 67,
    borderRadius: 33.5,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  name: { fontSize: 15, fontWeight: '900', color: COLORS.textSecondary },
  fullName: { fontSize: 10, color: COLORS.textMuted },

  cta: { borderRadius: 16, overflow: 'hidden', marginBottom: 12 },
  ctaGrad: {
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },

  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },
});
