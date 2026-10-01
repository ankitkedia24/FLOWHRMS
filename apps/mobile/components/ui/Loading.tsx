import React from 'react';
import { StyleSheet, View, ActivityIndicator, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { useEffect } from 'react';

/**
 * Loading (component-specifications.md §23).
 * - Skeleton: shimmer animation for content placeholders.
 * - Spinner: appears only after 400ms of waiting (motion.json rules).
 */

/** Skeleton placeholder block with shimmer. */
export function Skeleton({
  width,
  height = 16,
  radius,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View
      style={[
        {
          width: width as number,
          height,
          backgroundColor: t.colors.surfaceSunken,
          borderRadius: radius ?? t.radius.sm,
          overflow: 'hidden',
        },
        style,
      ]}
    />
  );
}

/** Repeated skeleton rows for list loading states. */
export function SkeletonRows({
  count = 3,
  style,
}: {
  count?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.rows, style]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton width={40} height={40} radius={20} />
          <View style={styles.skeletonLines}>
            <Skeleton width="70%" height={14} />
            <Skeleton width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Spinner that appears after 400ms delay (motion.json rules). */
export function Spinner({
  size = 'small',
  color,
  style,
}: {
  size?: 'small' | 'large';
  color?: string;
  style?: ViewStyle;
}) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // 400ms delay before spinner becomes visible
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: t.motion.durationFast });
    }, 400);
    return () => clearTimeout(timer);
  }, [opacity, t.motion.durationFast]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.spinner, animatedStyle, style]}>
      <ActivityIndicator
        size={size}
        color={color ?? t.colors.brandPrimary}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rows: {
    gap: 16,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skeletonLines: {
    flex: 1,
    gap: 6,
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
});
