import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, runOnJS } from 'react-native-reanimated';
import { useAppContext } from '../context/AppContext';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

export default function Toast() {
  const { toastMessage } = useAppContext();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    if (toastMessage) {
      opacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 1800 }),
        withTiming(0, { duration: 400 })
      );
      translateY.value = withSequence(
        withTiming(0, { duration: 250 }),
        withTiming(0, { duration: 1800 }),
        withTiming(30, { duration: 400 })
      );
    }
  }, [toastMessage]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!toastMessage) return null;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Text style={styles.text}>{toastMessage}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 100, left: 20, right: 20,
    backgroundColor: Colors.overlayDark, borderRadius: 20,
    paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center',
    zIndex: 999, shadowColor: Colors.navy, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 10,
  },
  text: { color: '#fff', ...Typography.body, fontWeight: '700' },
});