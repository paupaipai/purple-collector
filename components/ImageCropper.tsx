import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';

/**
 * Recorte 2:3 con encuadre manual.
 *
 * Existe porque `allowsEditing` del image picker no es portable: Android respeta
 * el aspect, iOS lo ignora y fuerza un recorte cuadrado, y web no recorta. Antes
 * se compensaba recortando al centro a ciegas, que resolvia la proporcion pero
 * no dejaba elegir QUE parte de la foto entra.
 *
 * Se usa PanResponder, de React Native, en vez de react-native-gesture-handler:
 * no esta instalado, es nativo --implicaria otro rebuild-- y para mover y
 * escalar una imagen el gesto no necesita correr fuera del hilo de JS. De paso
 * funciona igual en las tres plataformas.
 */

/** Proporcion real de una photocard: 55x85mm. */
const ASPECT = 2 / 3;

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

interface Props {
  visible: boolean;
  uri: string | null;
  /** Dimensiones reales del archivo, en pixeles. */
  imageWidth: number;
  imageHeight: number;
  onCancel: () => void;
  onConfirm: (crop: CropRect) => void;
}

export default function ImageCropper({
  visible, uri, imageWidth, imageHeight, onCancel, onConfirm,
}: Props) {
  const { t } = useI18n();

  // El marco: lo mas ancho que quepa dejando aire, sin pasarse de alto.
  const frame = useMemo(() => {
    const { width: sw, height: sh } = Dimensions.get('window');
    let w = sw - 64;
    let h = w / ASPECT;
    const maxH = sh * 0.6;
    if (h > maxH) { h = maxH; w = h * ASPECT; }
    return { w, h };
  }, [visible]);

  // Escala minima: la imagen tiene que CUBRIR el marco, nunca dejar huecos.
  const baseScale = useMemo(() => {
    if (!imageWidth || !imageHeight) return 1;
    return Math.max(frame.w / imageWidth, frame.h / imageHeight);
  }, [frame.w, frame.h, imageWidth, imageHeight]);

  // Multiplicador del usuario sobre baseScale. Nunca baja de 1 para que el
  // invariante de cobertura se mantenga solo.
  const [zoom, setZoom] = useState(1);
  // Desplazamiento del centro de la imagen respecto del centro del marco.
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Los gestos necesitan leer el estado sin recrear el PanResponder en cada
  // render, de ahi las refs espejo.
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const gestureStart = useRef({ x: 0, y: 0, zoom: 1, distance: 0 });

  /** Impide que la imagen se despegue del marco. */
  const clamp = (x: number, y: number, z: number) => {
    const shownW = imageWidth * baseScale * z;
    const shownH = imageHeight * baseScale * z;
    const maxX = Math.max(0, (shownW - frame.w) / 2);
    const maxY = Math.max(0, (shownH - frame.h) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const distanceBetween = (touches: any[]) => {
    const [a, b] = touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    onPanResponderGrant: (evt) => {
      const touches = evt.nativeEvent.touches;
      gestureStart.current = {
        x: offsetRef.current.x,
        y: offsetRef.current.y,
        zoom: zoomRef.current,
        distance: touches.length === 2 ? distanceBetween(touches) : 0,
      };
    },

    onPanResponderMove: (evt, gesture) => {
      const touches = evt.nativeEvent.touches;

      if (touches.length === 2) {
        // Pellizco. Si el gesto empezo con un dedo y se sumo el segundo, se
        // toma esa distancia como referencia en vez de arrastrar un valor viejo.
        const dist = distanceBetween(touches);
        if (gestureStart.current.distance === 0) {
          gestureStart.current.distance = dist;
          gestureStart.current.zoom = zoomRef.current;
          return;
        }
        const next = Math.min(5, Math.max(1,
          gestureStart.current.zoom * (dist / gestureStart.current.distance)));
        zoomRef.current = next;
        setZoom(next);
        const clamped = clamp(offsetRef.current.x, offsetRef.current.y, next);
        offsetRef.current = clamped;
        setOffset(clamped);
        return;
      }

      const clamped = clamp(
        gestureStart.current.x + gesture.dx,
        gestureStart.current.y + gesture.dy,
        zoomRef.current,
      );
      offsetRef.current = clamped;
      setOffset(clamped);
    },
  }), [baseScale, frame.w, frame.h, imageWidth, imageHeight]);

  const reset = () => {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  /** Pasa el marco de coordenadas de pantalla a pixeles de la imagen. */
  const confirm = () => {
    const scale = baseScale * zoomRef.current;
    const shownW = imageWidth * scale;
    const shownH = imageHeight * scale;

    const cropW = Math.round(frame.w / scale);
    const cropH = Math.round(frame.h / scale);
    const originX = Math.round((shownW / 2 - offsetRef.current.x - frame.w / 2) / scale);
    const originY = Math.round((shownH / 2 - offsetRef.current.y - frame.h / 2) / scale);

    onConfirm({
      // El redondeo puede sacar un pixel fuera de rango y el manipulador falla
      // con un rect que no cabe, asi que se acota al tamano real.
      originX: Math.min(Math.max(0, originX), Math.max(0, imageWidth - cropW)),
      originY: Math.min(Math.max(0, originY), Math.max(0, imageHeight - cropH)),
      width: Math.min(cropW, imageWidth),
      height: Math.min(cropH, imageHeight),
    });
  };

  const shownW = imageWidth * baseScale * zoom;
  const shownH = imageHeight * baseScale * zoom;

  return (
    <Modal visible={visible && !!uri} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Text style={styles.title}>{t('cropTitle')}</Text>
        <Text style={styles.hint}>{t('cropHint')}</Text>

        <View style={[styles.frame, { width: frame.w, height: frame.h }]} {...responder.panHandlers}>
          {uri ? (
            <Image
              source={{ uri }}
              style={{
                width: shownW,
                height: shownH,
                transform: [{ translateX: offset.x }, { translateY: offset.y }],
              }}
              contentFit="fill"
            />
          ) : null}
        </View>

        <TouchableOpacity onPress={reset} activeOpacity={0.7} style={styles.reset}>
          <Text style={styles.resetText}>{t('cropReset')}</Text>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={[styles.btn, styles.cancel]}>
            <Text style={styles.cancelText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={confirm} activeOpacity={0.7} style={[styles.btn, styles.confirm]}>
            <Text style={styles.confirmText}>{t('cropConfirm')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,0,15,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, marginBottom: 18, textAlign: 'center' },
  frame: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: COLORS.purple2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reset: { marginTop: 14, paddingVertical: 6, paddingHorizontal: 12 },
  resetText: { fontSize: 12, fontWeight: '700', color: COLORS.purple3 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18, width: '100%', maxWidth: 380 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 12 },
  cancel: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  cancelText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  confirm: { backgroundColor: COLORS.purple1 },
  confirmText: { fontSize: 13, fontWeight: '800', color: '#fff' },
});
