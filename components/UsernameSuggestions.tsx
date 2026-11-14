import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';

/**
 * Nombres libres que se ofrecen cuando el elegido esta ocupado o reservado.
 *
 * Tocar uno lo pone en el campo, NO lo guarda: asi la persona lo ve escrito y
 * puede retocarlo antes de confirmar. Lo usan el alta y el editor del perfil.
 */
interface Props {
  suggestions: string[];
  onPick: (username: string) => void;
}

export default function UsernameSuggestions({ suggestions, onPick }: Props) {
  const { t } = useI18n();
  if (suggestions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('handleSuggestions')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {suggestions.map(s => (
          <TouchableOpacity key={s} onPress={() => onPick(s)} activeOpacity={0.7} style={styles.chip}>
            <Text style={styles.chipText}>@{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 6 },
  label: { fontSize: 11, color: COLORS.textMuted, marginLeft: 4 },
  row: { gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.borderActive,
    backgroundColor: 'rgba(168,85,247,0.14)',
  },
  chipText: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
});
