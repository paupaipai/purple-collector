import { useEffect, useRef } from 'react';
import {
  Animated,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { DialogButton, DialogRequest } from '../lib/DialogContext';
import { COLORS } from '../lib/constants';

/**
 * El aviso con el aspecto de la app.
 *
 * NO es un <Modal>, por lo mismo que ImageCropper: un Modal es una presentacion
 * de UIKit y iOS la rechaza en silencio si hay otra en curso -- el selector de
 * fotos cerrandose, por ejemplo, que es justo cuando sale "Enviada a revision".
 * Como capa absoluta dentro del arbol no presenta nada y no puede chocar.
 *
 * Vive al final del DialogProvider, que envuelve a toda la app, asi que se
 * dibuja por encima de cualquier pantalla.
 */
interface Props {
  request: DialogRequest | null;
  onPress: (button: DialogButton) => void;
}

export default function AppDialog({ request, onPress }: Props) {
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!request) {
      appear.setValue(0);
      return;
    }
    Animated.spring(appear, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  }, [request, appear]);

  // El boton atras de Android lo daria el Modal; aqui se atiende a mano. Cierra
  // por el boton de cancelar si lo hay, para no saltarse una confirmacion.
  useEffect(() => {
    if (!request || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const cancel = request.buttons.find(b => b.style === 'cancel');
      if (cancel) onPress(cancel);
      return true;
    });
    return () => sub.remove();
  }, [request, onPress]);

  if (!request) return null;

  const { title, message, buttons } = request;
  // Dos caben en una fila; tres o mas se apilan, igual que hace el nativo.
  const stacked = buttons.length > 2;

  const colorFor = (button: DialogButton) =>
    button.style === 'destructive' ? COLORS.pink
      : button.style === 'cancel' ? COLORS.textSecondary
      : COLORS.purple3;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.backdrop} />

      <View style={styles.centered} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            {
              opacity: appear,
              transform: [
                { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
              ],
            },
          ]}
        >
          <View style={styles.body}>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
          </View>

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {buttons.map((button, index) => {
              // El principal es el ultimo que no sea cancelar, como en iOS.
              const isPrimary =
                button.style !== 'cancel'
                && index === buttons.map(b => b.style !== 'cancel').lastIndexOf(true);
              return (
                <TouchableOpacity
                  key={`${button.text}-${index}`}
                  onPress={() => onPress(button)}
                  activeOpacity={0.75}
                  style={[
                    styles.button,
                    stacked && styles.buttonStacked,
                    isPrimary && button.style !== 'destructive' && styles.buttonPrimary,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: isPrimary && button.style !== 'destructive' ? '#fff' : colorFor(button) },
                    ]}
                    numberOfLines={1}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,0,15,0.72)' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },

  card: {
    width: '100%', maxWidth: 360,
    borderRadius: 22, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.borderActive,
    // El mismo cristal de GlassCard pero mas opaco: un aviso tapa lo que hay
    // detras a proposito, y con 0.7 se leia el catalogo a traves del texto.
    backgroundColor: 'rgba(38, 20, 80, 0.96)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
  },

  body: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 18, gap: 8 },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.textPrimary, textAlign: 'center' },
  message: {
    fontSize: 13, lineHeight: 19, color: COLORS.textSecondary, textAlign: 'center',
  },

  actions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
  actionsStacked: { flexDirection: 'column' },
  button: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  buttonStacked: { flex: 0, width: '100%' },
  buttonPrimary: { backgroundColor: COLORS.purple1, borderColor: COLORS.purple1 },
  buttonText: { fontSize: 14, fontWeight: '800' },
});
