import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorView({ message, onRetry }: ErrorViewProps) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={onRetry} activeOpacity={0.7} style={styles.btn}>
        <Text style={styles.btnText}>{t('errorRetry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    marginTop: 60,
    gap: 10,
    paddingHorizontal: 32,
  },
  icon: { fontSize: 36 },
  message: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
    backgroundColor: 'rgba(168,85,247,0.1)',
  },
  btnText: {
    color: COLORS.purple3,
    fontSize: 13,
    fontWeight: '700',
  },
});
