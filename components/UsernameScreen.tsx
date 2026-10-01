import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';
import { saveUsername, USERNAME_RE, UsernameFailure } from '../lib/username';
import GalaxyBackground from './GalaxyBackground';

/**
 * Elegir nombre de usuario al crear la cuenta.
 *
 * Aparece una sola vez, justo despues de entrar, y SOLO si la cuenta todavia no
 * tiene uno. Es el momento con mas sentido para pedirlo: es cuando la persona
 * esta decidiendo quien es dentro de la app, no a mitad de aportar una foto.
 *
 * Se puede saltar. Pedirlo como requisito seria cobrar un peaje para entrar a
 * una app que se puede usar entera sin aportar nada; quien lo salte lo tiene en
 * su perfil, debajo del correo.
 */
interface Props {
  userId: string | null;
  /** Nombre sugerido, normalmente el del proveedor de OAuth. */
  suggestion?: string | null;
  onDone: (username: string | null) => void;
}

export default function UsernameScreen({ userId, suggestion, onDone }: Props) {
  const { t } = useI18n();

  // La sugerencia se limpia a lo que el formato admite: de "Pau Sepúlveda" sale
  // "pausepulveda". Asi la mayoria no tiene que escribir nada.
  const [value, setValue] = useState(() =>
    (suggestion ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = USERNAME_RE.test(value);

  const errorText = (reason: UsernameFailure) => {
    if (reason === 'taken') return t('handleTaken');
    if (reason === 'reserved') return t('handleReserved');
    if (reason === 'invalid') return t('handleInvalid');
    return t('handleFailed');
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    const result = await saveUsername(userId, value);
    setSaving(false);

    if (!result.ok) {
      setError(errorText(result.reason));
      return;
    }
    onDone(result.username);
  };

  return (
    <SafeAreaView style={styles.container}>
      <GalaxyBackground showIcons={false} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <View style={styles.badge}>
            <Ionicons name="at" size={28} color={COLORS.purple3} />
          </View>

          <Text style={styles.title}>{t('usernameSetupTitle')}</Text>
          <Text style={styles.subtitle}>{t('usernameSetupDesc')}</Text>

          <View style={[styles.field, error ? styles.fieldError : null]}>
            <Text style={styles.at}>@</Text>
            <TextInput
              value={value}
              onChangeText={text => {
                setValue(text.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20));
                setError(null);
              }}
              placeholder={t('usernamePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={() => valid && !saving && submit()}
            />
          </View>

          <Text style={[styles.rules, error ? styles.rulesError : null]}>
            {error ?? t('handleRules')}
          </Text>

          <TouchableOpacity
            onPress={submit}
            disabled={!valid || saving}
            activeOpacity={0.85}
            style={[styles.primary, (!valid || saving) && styles.primaryDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{t('usernameContinue')}</Text>
            )}
          </TouchableOpacity>

          {/* Saltar no es un fracaso: se puede poner luego desde el perfil, y
              decirlo aqui evita que parezca una puerta cerrada. */}
          <TouchableOpacity
            onPress={() => onDone(null)}
            disabled={saving}
            activeOpacity={0.7}
            style={styles.skip}
          >
            <Text style={styles.skipText}>{t('usernameSkip')}</Text>
          </TouchableOpacity>
          <Text style={styles.skipHint}>{t('usernameSkipHint')}</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, gap: 2 },

  badge: {
    alignSelf: 'center', width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
    backgroundColor: 'rgba(168,85,247,0.14)',
    borderWidth: 1, borderColor: COLORS.borderActive,
  },
  title: {
    fontSize: 22, fontWeight: '800', color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13, lineHeight: 19, color: COLORS.textSecondary,
    textAlign: 'center', marginTop: 8, marginBottom: 22,
  },

  field: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 14, paddingVertical: 4,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceGlass,
  },
  fieldError: { borderColor: COLORS.pink + '88' },
  at: { fontSize: 17, fontWeight: '800', color: COLORS.textMuted },
  input: {
    flex: 1, paddingVertical: 13,
    fontSize: 16, fontWeight: '700', color: COLORS.textPrimary,
  },
  rules: {
    fontSize: 11, color: COLORS.textMuted,
    marginTop: 8, marginBottom: 20, marginLeft: 4,
  },
  rulesError: { color: COLORS.pink },

  primary: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 15, borderRadius: 14, backgroundColor: COLORS.purple1,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  skip: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  skipHint: {
    fontSize: 11, color: COLORS.textMuted, textAlign: 'center', marginTop: -6,
  },
});
