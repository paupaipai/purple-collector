import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';

/**
 * Una fila "etiqueta: valor" que abre una lista para elegir.
 *
 * Existe porque el formulario de card nueva tiene seis niveles de taxonomia, y
 * seis listas desplegadas a la vez no caben en una pantalla de telefono. Asi
 * cada nivel ocupa una linea y la lista se abre sobre el resto.
 *
 * El buscador aparece solo cuando hay mas de 12 opciones: en 6 tipos estorba,
 * pero en 159 albums es la unica forma de encontrar algo.
 */

export interface PickerOption {
  value: number | string;
  label: string;
  /** Segunda linea, para desambiguar dos opciones con nombre parecido. */
  sublabel?: string;
}

const SEARCH_THRESHOLD = 12;

interface Props {
  label: string;
  options: PickerOption[];
  value: number | string | null;
  onChange: (value: number | string | null) => void;
  /** Texto cuando no hay nada elegido. */
  placeholder: string;
  /** Deshabilitado mientras el nivel de arriba no este elegido. */
  disabled?: boolean;
  /** Marca el campo como obligatorio en la etiqueta. */
  required?: boolean;
  /** Permite volver a "sin elegir". Para version y card set, que son opcionales. */
  clearable?: boolean;
}

export default function PickerField({
  label, options, value, onChange, placeholder,
  disabled, required, clearable,
}: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find(o => o.value === value) ?? null;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q));
  }, [options, query]);

  const close = () => { setOpen(false); setQuery(''); };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>

      <TouchableOpacity
        onPress={() => !disabled && options.length > 0 && setOpen(true)}
        activeOpacity={0.7}
        style={[styles.field, disabled && styles.fieldDisabled]}
      >
        <Text
          style={[styles.value, !selected && styles.placeholder]}
          numberOfLines={1}
        >
          {selected?.label ?? (disabled || options.length === 0 ? t('pickerBlocked') : placeholder)}
        </Text>
        <Ionicons
          name="chevron-down"
          size={16}
          color={disabled ? COLORS.textMuted : COLORS.purple3}
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={close} activeOpacity={0.7} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {options.length > SEARCH_THRESHOLD ? (
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('pickerSearch')}
                placeholderTextColor={COLORS.textMuted}
                style={styles.search}
                autoCorrect={false}
              />
            ) : null}

            {clearable && selected ? (
              <TouchableOpacity
                onPress={() => { onChange(null); close(); }}
                activeOpacity={0.7}
                style={styles.clearRow}
              >
                <Text style={styles.clearText}>{t('pickerClear')}</Text>
              </TouchableOpacity>
            ) : null}

            <FlatList
              data={visible}
              keyExtractor={item => String(item.value)}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const active = item.value === value;
                return (
                  <TouchableOpacity
                    onPress={() => { onChange(item.value); close(); }}
                    activeOpacity={0.7}
                    style={[styles.row, active && styles.rowActive]}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                        {item.label}
                      </Text>
                      {item.sublabel ? (
                        <Text style={styles.rowSub} numberOfLines={1}>{item.sublabel}</Text>
                      ) : null}
                    </View>
                    {active ? (
                      <Ionicons name="checkmark" size={17} color={COLORS.purple3} />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>{t('pickerNoMatches')}</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 5 },
  flex: { flex: 1 },
  label: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.2 },
  required: { color: COLORS.pink },
  field: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceGlass,
  },
  fieldDisabled: { opacity: 0.45 },
  value: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  placeholder: { fontWeight: '500', color: COLORS.textMuted },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(5,0,15,0.7)' },
  sheet: {
    maxHeight: '78%',
    backgroundColor: COLORS.surface1,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: COLORS.borderActive,
    paddingBottom: 24,
  },
  sheetHead: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  closeBtn: { padding: 4 },
  search: {
    marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface2,
    color: COLORS.textPrimary, fontSize: 13,
  },
  clearRow: { paddingHorizontal: 16, paddingVertical: 10 },
  clearText: { fontSize: 12, fontWeight: '800', color: COLORS.textMuted },
  list: { paddingHorizontal: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 10, marginBottom: 2,
  },
  rowActive: { backgroundColor: 'rgba(168,85,247,0.14)' },
  rowLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  rowLabelActive: { color: COLORS.purple3 },
  rowSub: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
  empty: { textAlign: 'center', padding: 24, fontSize: 12, color: COLORS.textMuted },
});
