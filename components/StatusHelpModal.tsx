import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';

export const STATUS_HELP_ITEMS = [
  { icon: 'ellipse-outline' as const,          color: COLORS.textMuted, labelKey: 'clearStatus',         descKey: 'statusHelpPending' },
  { icon: 'checkmark-circle-outline' as const, color: '#4ADE80',        labelKey: 'statusHave',          descKey: 'statusHelpHave' },
  { icon: 'heart-outline' as const,            color: '#E040A0',        labelKey: 'statusWant',          descKey: 'statusHelpWant' },
  { icon: 'send-outline' as const,             color: '#60A5FA',        labelKey: 'statusOtw',           descKey: 'statusHelpOtw' },
  { icon: 'close-circle-outline' as const,     color: '#FF6B6B',        labelKey: 'statusNotCollecting', descKey: 'statusHelpNotCollecting' },
] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function StatusHelpModal({ visible, onClose }: Props) {
  const { t } = useI18n();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.helpHeader}>
            <Text style={styles.helpTitle}>{t('statusHelpTitle')}</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.helpCloseBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          {STATUS_HELP_ITEMS.map(item => (
            <View key={item.labelKey} style={styles.helpRow}>
              <View style={[styles.helpIconWrap, { backgroundColor: item.color + '22', borderColor: item.color + '55' }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.helpRowTitle}>{t(item.labelKey as any)}</Text>
                <Text style={styles.helpRowDesc}>{t(item.descKey as any)}</Text>
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={styles.helpBtn}>
            <LinearGradient
              colors={[COLORS.pink, COLORS.purple1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.helpBtnGrad}
            >
              <Text style={styles.helpBtnText}>{t('statusHelpGotIt')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#160A30',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40,
    borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)', borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginTop: 12, marginBottom: 16,
  },
  helpHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 16,
  },
  helpTitle: { color: '#fff', fontSize: 18, fontWeight: '900', flex: 1 },
  helpCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  helpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  helpIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  helpRowTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  helpRowDesc: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  helpBtn: { marginHorizontal: 20, marginTop: 20, marginBottom: 8, borderRadius: 14, overflow: 'hidden' },
  helpBtnGrad: { paddingVertical: 15, alignItems: 'center' },
  helpBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
