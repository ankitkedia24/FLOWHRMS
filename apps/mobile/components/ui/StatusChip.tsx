import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { getTheme, type StatusTone } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Status chip (component-specifications.md §11).
 * Renders a Status { key, label, tone } — the label is always printed, so a
 * colour-only status is impossible by construction (D-005). Chips carry a
 * specific label ("Late 18 min"), are never truncated, and never animate.
 */
export interface Status {
  key: string;
  label: string;
  tone: StatusTone;
}

export interface StatusChipProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  /** Show the tone dot (default true). Decorative — the label carries meaning. */
  dot?: boolean;
  /** Add the 1px tone border for use on white cards. */
  bordered?: boolean;
  style?: ViewStyle;
}

const sizeMap = {
  sm: { height: 24, paddingHorizontal: 8, fontSize: 12 },
  md: { height: 28, paddingHorizontal: 10, fontSize: 13 },
  lg: { height: 32, paddingHorizontal: 12, fontSize: 14 },
} as const;

export function StatusChip({
  status,
  size = 'md',
  dot = true,
  bordered = false,
  style,
}: StatusChipProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const tone = t.colors.status[status.tone];
  const sz = sizeMap[size];

  return (
    <View
      style={[
        styles.chip,
        {
          height: sz.height,
          paddingHorizontal: sz.paddingHorizontal,
          backgroundColor: tone.bg,
          borderRadius: t.radius.chip,
        },
        bordered && { borderWidth: 1, borderColor: tone.border },
        style,
      ]}
      accessibilityRole="text"
    >
      {dot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: tone.fg },
          ]}
        />
      )}
      <Text
        style={[
          styles.label,
          { fontSize: sz.fontSize, color: tone.text },
        ]}
        numberOfLines={1}
      >
        {status.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginRight: 6,
  },
  label: {
    fontWeight: '600',
  },
});
