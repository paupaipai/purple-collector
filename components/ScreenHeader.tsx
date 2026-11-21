import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { COLORS } from '../lib/constants';
import { goBack, BACK_HIT_SLOP } from '../lib/navigation';

/** Cabecera simple con volver, igual a la de las pantallas de tipo/album. */
export default function ScreenHeader({ title, fallback = '/' }: { title: string; fallback?: string }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={() => goBack(router, fallback)} hitSlop={BACK_HIT_SLOP} style={styles.back} activeOpacity={0.7}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title} numberOfLines={1}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, marginTop: 6, marginBottom: 14,
  },
  back: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  backText: { color: COLORS.purple3, fontSize: 18 },
  title: { flex: 1, fontSize: 22, fontWeight: '900', color: '#fff' },
});
