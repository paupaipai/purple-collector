import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { COLORS } from '../lib/constants';

export interface FilterSection {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  premiumLocked?: boolean;
  onPremiumPress?: () => void;
  onHelp?: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  sections: FilterSection[];
  accentColor?: string;
  onReset: () => void;
  resultCount?: number;
}

export default function FilterBottomSheet({
  visible,
  onClose,
  sections,
  accentColor = COLORS.purple2,
  onReset,
  resultCount,
}: Props) {
  const hasActive = sections.some(s => !s.premiumLocked && s.value !== 'All');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Filtros</Text>
            {hasActive && (
              <TouchableOpacity onPress={onReset} activeOpacity={0.7} style={styles.resetBtn}>
                <Text style={styles.resetText}>Limpiar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {sections.map((section, i) => (
              <View key={section.key} style={[styles.section, i > 0 && styles.sectionDivider]}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>{section.label}</Text>
                  {section.onHelp && (
                    <TouchableOpacity
                      onPress={section.onHelp}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="help-circle-outline" size={16} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {section.premiumLocked ? (
                  <TouchableOpacity
                    onPress={section.onPremiumPress}
                    activeOpacity={0.7}
                    style={styles.premiumRow}
                  >
                    <Ionicons name="diamond-outline" size={13} color={COLORS.purple3} />
                    <Text style={styles.premiumText}>Desbloquear con Premium</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.pillWrap}>
                    {section.options.map(opt => {
                      const active = section.value === opt.value;
                      return (
                        <TouchableOpacity
                          key={opt.value}
                          onPress={() => section.onChange(opt.value)}
                          activeOpacity={0.7}
                          style={[
                            styles.pill,
                            active && {
                              backgroundColor: accentColor + '30',
                              borderColor: accentColor + '80',
                              shadowColor: accentColor,
                              shadowOpacity: 0.3,
                              shadowRadius: 6,
                              shadowOffset: { width: 0, height: 0 },
                            },
                          ]}
                        >
                          <Text style={[styles.pillText, active && { color: '#fff' }]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={styles.applyBtn}>
            <LinearGradient
              colors={[COLORS.purple1, COLORS.pink]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.applyBtnGrad}
            >
              <Text style={styles.applyBtnText}>
                {resultCount !== undefined
                  ? `Ver ${resultCount} resultado${resultCount !== 1 ? 's' : ''}`
                  : 'Ver resultados'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#160A30',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.2)',
    borderBottomWidth: 0,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  resetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
  },
  resetText: {
    color: COLORS.purple3,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  section: {
    paddingVertical: 14,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.purple2 + '33',
    backgroundColor: 'rgba(168,85,247,0.06)',
    alignSelf: 'flex-start',
  },
  premiumText: {
    color: COLORS.purple3,
    fontSize: 13,
    fontWeight: '700',
  },
  applyBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  applyBtnGrad: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});
