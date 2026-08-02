import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../lib/constants';

interface NeonBarProps {
  value: number;
  max: number;
  color?: string;
  height?: number;
}

export default function NeonBar({ value, max, color, height = 5 }: NeonBarProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: pct,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const c = color || COLORS.pink;

  return (
    <View style={[styles.bg, { height, borderRadius: height }]}>  
      <Animated.View
        style={[
          styles.fill,
          {
            height,
            borderRadius: height,
            width: animWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      >
        <LinearGradient
          colors={[c, COLORS.pinkGlow]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: height }]}
        />
      </Animated.View>
      {/* Glow dot at the end */}
      {pct > 2 && (
        <Animated.View
          style={[
            styles.glowDot,
            {
              backgroundColor: c,
              left: animWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    overflow: 'hidden',
  },
  glowDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: -1.5,
    marginLeft: -4,
    shadowColor: '#FF60C0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
});
