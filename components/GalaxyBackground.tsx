import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, G, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

/* ── Twinkling Star ── */
function Star({ delay, size, x, y, duration, color }: { delay: number; size: number; x: number; y: number; duration: number; color?: string }) {
  const opacity = useRef(new Animated.Value(0.1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: duration * 0.4, delay, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.1, duration: duration * 0.6, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    return () => {};
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color || '#E0D0FF',
      opacity,
      shadowColor: color || '#C8A0FF',
      shadowOpacity: 0.8,
      shadowRadius: size * 2,
      shadowOffset: { width: 0, height: 0 },
    }} />
  );
}

/* ── Floating sparkle with cross shape ── */
function Sparkle({ x, y, delay, size }: { x: number; y: number; delay: number; size: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0.85, duration: 1800, delay, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 1800, delay, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 2200, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.3, duration: 2200, useNativeDriver: true }),
        ]),
        Animated.delay(800),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x - size / 2, top: y - size / 2,
      width: size, height: size, opacity, transform: [{ scale }],
      alignItems: 'center', justifyContent: 'center',
    }}>
      <View style={{ position: 'absolute', width: size, height: 1.5, backgroundColor: '#fff', borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 1.5, height: size, backgroundColor: '#fff', borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: size * 0.6, height: 1, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 1, transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', width: size * 0.6, height: 1, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 1, transform: [{ rotate: '-45deg' }] }} />
    </Animated.View>
  );
}

/* ── Spiral Galaxy ── */
function SpiralGalaxy({ x, y, size, rotation, opacity: opac }: { x: number; y: number; size: number; rotation: number; opacity: number }) {
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 60000, useNativeDriver: true, easing: Easing.linear })
    ).start();
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: [`${rotation}deg`, `${rotation + 360}deg`] });
  return (
    <Animated.View style={{
      position: 'absolute', left: x - size / 2, top: y - size / 2,
      width: size, height: size, opacity: opac,
      transform: [{ rotate }],
    }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id="gx" cx="50" cy="50" r="50">
            <Stop offset="0" stopColor="#C8A0FF" stopOpacity="0.6" />
            <Stop offset="0.3" stopColor="#9060DD" stopOpacity="0.3" />
            <Stop offset="0.6" stopColor="#6030AA" stopOpacity="0.1" />
            <Stop offset="1" stopColor="#6030AA" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#gx)" />
        <Path d="M50 50 Q60 30 75 25 Q90 22 85 40 Q80 55 65 55" stroke="rgba(200,170,255,0.25)" strokeWidth="1.5" fill="none" />
        <Path d="M50 50 Q40 70 25 75 Q10 78 15 60 Q20 45 35 45" stroke="rgba(200,170,255,0.25)" strokeWidth="1.5" fill="none" />
        <Path d="M50 50 Q65 45 78 35 Q88 28 82 48" stroke="rgba(180,140,255,0.15)" strokeWidth="1" fill="none" />
        <Path d="M50 50 Q35 55 22 65 Q12 72 18 52" stroke="rgba(180,140,255,0.15)" strokeWidth="1" fill="none" />
        <Circle cx="50" cy="50" r="3" fill="rgba(255,255,255,0.5)" />
      </Svg>
    </Animated.View>
  );
}

/* ── BTS Logo ── */
function BTSLogo({ x, y, size, opacity: opac }: { x: number; y: number; size: number; opacity: number }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -8, duration: 3000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(float, { toValue: 0, duration: 3000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y, opacity: opac,
      transform: [{ translateY: float }],
    }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <G opacity="0.85">
          <Path d="M32 4 L52 18 L52 42 L32 58 L12 42 L12 18 Z" stroke="rgba(200,170,255,0.6)" strokeWidth="1.5" fill="none" />
          <Path d="M22 18 L32 28 L42 18" stroke="rgba(200,170,255,0.5)" strokeWidth="1.5" fill="none" />
          <Path d="M22 42 L32 32 L42 42" stroke="rgba(200,170,255,0.5)" strokeWidth="1.5" fill="none" />
          <Path d="M32 28 L32 32" stroke="rgba(200,170,255,0.5)" strokeWidth="1.5" fill="none" />
        </G>
      </Svg>
    </Animated.View>
  );
}

/* ── ARMY Bomb (Lightstick) ── */
function ArmyBomb({ x, y, size, opacity: opac }: { x: number; y: number; size: number; opacity: number }) {
  const float = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -10, duration: 3500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(float, { toValue: 0, duration: 3500, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y, opacity: opac,
      transform: [{ translateY: float }],
    }}>
      <Svg width={size} height={size * 1.8} viewBox="0 0 40 72">
        <G opacity="0.8">
          <Circle cx="20" cy="16" r="14" stroke="rgba(200,170,255,0.6)" strokeWidth="1.2" fill="rgba(200,170,255,0.08)" />
          <Path d="M20 30 L20 68" stroke="rgba(200,170,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M16 56 L24 56" stroke="rgba(200,170,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
          <Path d="M16 60 L24 60" stroke="rgba(200,170,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
          <Path d="M20 8 L21.5 13 L27 13 L22.5 16.5 L24 22 L20 18.5 L16 22 L17.5 16.5 L13 13 L18.5 13 Z" fill="rgba(255,255,255,0.3)" />
        </G>
      </Svg>
    </Animated.View>
  );
}

/* ── Borahae Flower ── */
function PurpleFlower({ x, y, size, opacity: opac }: { x: number; y: number; size: number; opacity: number }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -6, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(float, { toValue: 0, duration: 4000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y, opacity: opac,
      transform: [{ translateY: float }],
    }}>
      <Svg width={size} height={size * 1.3} viewBox="0 0 50 65">
        <G opacity="0.75">
          <Ellipse cx="25" cy="15" rx="8" ry="12" fill="none" stroke="rgba(200,170,255,0.5)" strokeWidth="1.2" />
          <Ellipse cx="15" cy="22" rx="8" ry="12" fill="none" stroke="rgba(200,170,255,0.5)" strokeWidth="1.2" transform="rotate(-30, 15, 22)" />
          <Ellipse cx="35" cy="22" rx="8" ry="12" fill="none" stroke="rgba(200,170,255,0.5)" strokeWidth="1.2" transform="rotate(30, 35, 22)" />
          <Ellipse cx="18" cy="32" rx="8" ry="12" fill="none" stroke="rgba(200,170,255,0.4)" strokeWidth="1.2" transform="rotate(-60, 18, 32)" />
          <Ellipse cx="32" cy="32" rx="8" ry="12" fill="none" stroke="rgba(200,170,255,0.4)" strokeWidth="1.2" transform="rotate(60, 32, 32)" />
          <Circle cx="25" cy="24" r="3" fill="rgba(255,200,255,0.3)" />
          <Path d="M25 36 Q25 50 22 60" stroke="rgba(200,170,255,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <Path d="M24 48 Q18 44 15 48 Q18 52 24 48" fill="rgba(200,170,255,0.2)" stroke="rgba(200,170,255,0.3)" strokeWidth="0.8" />
        </G>
      </Svg>
    </Animated.View>
  );
}

/* ── Generate star data ── */
const stars = Array.from({ length: 70 }, (_, i) => ({
  id: i, x: Math.random() * W, y: Math.random() * H,
  size: Math.random() * 2.2 + 0.4,
  delay: Math.random() * 4000,
  duration: Math.random() * 3000 + 2500,
  color: ['#E0D0FF', '#FFD0F0', '#D0D0FF', '#C8A0FF', '#FFB0E0'][Math.floor(Math.random() * 5)],
}));

const sparkles = Array.from({ length: 10 }, (_, i) => ({
  id: i, x: Math.random() * W, y: Math.random() * H,
  delay: Math.random() * 5000,
  size: Math.random() * 10 + 6,
}));

interface Props {
  // Floating icons (spiral galaxies, BTS logo, army bomb, flower) sit at fixed
  // screen coordinates, independent of scroll — on content-dense grids they can
  // drift visually out of place relative to the cards. Off by default there.
  showIcons?: boolean;
}

export default function GalaxyBackground({ showIcons = true }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Base gradient - deep purple to black */}
      <LinearGradient
        colors={['#08001A', '#12003A', '#1A0050', '#10003A', '#08001A']}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Nebula blobs */}
      <View style={[styles.nebula, { top: '50%', left: '-10%', width: 300, height: 300, backgroundColor: 'rgba(180,60,220,0.1)', borderRadius: 150 }]} />
      <View style={[styles.nebula, { top: '30%', right: '-5%', width: 250, height: 250, backgroundColor: 'rgba(100,40,180,0.12)', borderRadius: 125 }]} />
      <View style={[styles.nebula, { top: '65%', right: '10%', width: 280, height: 280, backgroundColor: 'rgba(140,50,200,0.08)', borderRadius: 140 }]} />
      <View style={[styles.nebula, { top: '15%', right: '30%', width: 200, height: 200, backgroundColor: 'rgba(200,80,255,0.06)', borderRadius: 100 }]} />

      {/* Purple haze overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(80,20,140,0.08)', 'rgba(120,40,200,0.05)', 'transparent']}
        locations={[0, 0.3, 0.6, 1]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {showIcons && (
        <>
          {/* Spiral galaxies */}
          <SpiralGalaxy x={W * 0.82} y={H * 0.12} size={70} rotation={15} opacity={0.4} />
          <SpiralGalaxy x={W * 0.08} y={H * 0.72} size={55} rotation={-30} opacity={0.3} />
          <SpiralGalaxy x={W * 0.7} y={H * 0.58} size={45} rotation={45} opacity={0.25} />

          {/* BTS themed icons */}
          <BTSLogo x={W * 0.42} y={H * 0.32} size={42} opacity={0.35} />
          <ArmyBomb x={W * 0.12} y={H * 0.38} size={32} opacity={0.3} />
          <PurpleFlower x={W * 0.55} y={H * 0.48} size={38} opacity={0.3} />
        </>
      )}

      {/* Stars */}
      {stars.map(s => (
        <Star key={s.id} x={s.x} y={s.y} size={s.size} delay={s.delay} duration={s.duration} color={s.color} />
      ))}

      {/* Sparkles */}
      {sparkles.map(s => (
        <Sparkle key={s.id} x={s.x} y={s.y} delay={s.delay} size={s.size} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nebula: {
    position: 'absolute',
  },
});
