import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { COLORS } from '../lib/constants';
import { useI18n } from '../lib/I18nContext';

/**
 * Visor ampliado de frente / reverso (la "lupa" del modal de la card).
 *
 * NO es un <Modal>: se monta como capa absoluta DENTRO del Modal de la card.
 * Un Modal dentro de otro es justo lo que iOS rechaza en silencio (ver la nota
 * de ImageCropper), y asi se comporta igual en las tres plataformas.
 *
 * Tocar la imagen alterna un zoom x2.5 centrado en el punto tocado; volver a
 * tocar la devuelve a su tamano. En web, Esc cierra y las flechas cambian de
 * lado.
 */

export type ZoomSide = 'front' | 'back';

interface Props {
  /** Lado abierto, o null si el visor esta cerrado. */
  side: ZoomSide | null;
  frontUrl: string | null;
  backUrl: string | null;
  /** @ de quien aporto cada lado; null si no es un aporte o no tiene nombre. */
  frontHandle?: string | null;
  backHandle?: string | null;
  onChangeSide: (side: ZoomSide) => void;
  onClose: () => void;
}

const ASPECT = 2 / 3;
const ZOOM = 2.5;

export default function ImageZoomViewer({
  side, frontUrl, backUrl, frontHandle, backHandle, onChangeSide, onClose,
}: Props) {
  const { t } = useI18n();
  const { width: sw, height: sh } = useWindowDimensions();
  const [zoomAt, setZoomAt] = useState<{ x: number; y: number } | null>(null);

  // Cada lado (y cada apertura) arranca sin zoom.
  useEffect(() => { setZoomAt(null); }, [side]);

  const hasBoth = !!frontUrl && !!backUrl;
  const uri = side === 'back' ? backUrl : side === 'front' ? frontUrl : null;
  const handle = side === 'back' ? backHandle : frontHandle;

  // Lo mas grande que quepa en 2:3, dejando sitio a las pestanas y la X.
  const frame = useMemo(() => {
    let w = Math.min(sw - 32, 560);
    let h = w / ASPECT;
    const maxH = sh - 150;
    if (h > maxH) { h = maxH; w = h * ASPECT; }
    return { w, h };
  }, [sw, sh]);

  // Teclado en web: Esc cierra, flechas cambian de lado.
  useEffect(() => {
    if (Platform.OS !== 'web' || !side) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (hasBoth && e.key === 'ArrowLeft') onChangeSide('front');
      else if (hasBoth && e.key === 'ArrowRight') onChangeSide('back');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [side, hasBoth, onClose, onChangeSide]);

  if (!side || !uri) return null;

  const toggleZoom = (e: GestureResponderEvent) => {
    if (zoomAt) { setZoomAt(null); return; }
    const { locationX, locationY } = e.nativeEvent;
    setZoomAt({
      x: Math.min(frame.w, Math.max(0, locationX)),
      y: Math.min(frame.h, Math.max(0, locationY)),
    });
  };

  // Escalar desde el punto tocado: se traslada para que ese punto quede fijo.
  const zoomStyle = zoomAt
    ? {
        transform: [
          { translateX: (frame.w / 2 - zoomAt.x) * (ZOOM - 1) },
          { translateY: (frame.h / 2 - zoomAt.y) * (ZOOM - 1) },
          { scale: ZOOM },
        ],
      }
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="auto">
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('close')}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel={t('close')}>
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>

        {hasBoth && (
          <View style={styles.tabs}>
            {(['front', 'back'] as const).map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => onChangeSide(s)}
                activeOpacity={0.8}
                style={[styles.tab, side === s && styles.tabActive]}
              >
                <Text style={[styles.tabText, side === s && styles.tabTextActive]}>
                  {t(s === 'front' ? 'sideFront' : 'sideBack')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Pressable propio: tocar la imagen hace zoom, no cierra. */}
        <Pressable
          onPress={toggleZoom}
          style={[styles.frame, { width: frame.w, height: frame.h }, Platform.OS === 'web' && ({ cursor: zoomAt ? 'zoom-out' : 'zoom-in' } as any)]}
        >
          <Image
            source={{ uri }}
            style={[{ width: frame.w, height: frame.h }, zoomStyle]}
            contentFit="contain"
            transition={150}
          />
          {/* Fuera del zoom: la firma no se agranda ni se sale del marco. */}
          {handle ? (
            <View style={styles.handleTag} pointerEvents="none">
              <Text style={styles.handleTagText} numberOfLines={1}>@{handle}</Text>
            </View>
          ) : null}
        </Pressable>

        <Text style={styles.hint}>{t(zoomAt ? 'zoomHintOut' : 'zoomHintIn')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,2,15,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 12,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16, zIndex: 2,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  tabs: {
    flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  tabActive: { backgroundColor: COLORS.purple3 },
  tabText: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.7)' },
  tabTextActive: { color: '#1E0B3B' },
  frame: { overflow: 'hidden', borderRadius: 14 },
  handleTag: {
    position: 'absolute', bottom: 10, left: 10, maxWidth: '80%',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: '#E9D5FF',
  },
  handleTagText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2, color: '#2E1065' },
  hint: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
});
