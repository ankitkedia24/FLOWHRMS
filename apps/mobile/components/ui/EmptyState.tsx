import React, { ReactNode } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * EmptyState (component-specifications.md §22).
 * Geometric illustration from the FlowHRMS logo bars, rendered as coloured
 * rectangles. "What happened" + "What to do".
 */
export interface EmptyStateProps {
  title: string;
  body: string;
  warm?: boolean;
  action?: ReactNode;
}

export function EmptyState({ title, body, warm = false, action }: EmptyStateProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View style={styles.container}>
      {/* Geometric illustration (logo bars abstraction) */}
      <View style={styles.illustration}>
        <View
          style={[
            styles.bar,
            styles.barLong,
            {
              backgroundColor: warm
                ? t.colors.warmAccentSoft
                : t.colors.brandPrimary,
              opacity: 0.15,
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            styles.barMed,
            {
              backgroundColor: warm
                ? t.colors.warmAccent
                : t.colors.brandPrimaryHover,
              opacity: 0.25,
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            styles.barShort,
            {
              backgroundColor: warm
                ? t.colors.warmAccent
                : t.colors.brandPrimary,
              opacity: 0.35,
            },
          ]}
        />
      </View>

      <Text style={[t.typography.h3, { color: t.colors.textPrimary, textAlign: 'center' }]}>
        {title}
      </Text>
      <Text
        style={[
          t.typography.secondary,
          {
            color: t.colors.textSecondary,
            textAlign: 'center',
            marginTop: 4,
          },
        ]}
      >
        {body}
      </Text>

      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  illustration: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 4,
  },
  bar: {
    borderRadius: 3,
    height: 6,
  },
  barLong: {
    width: 80,
  },
  barMed: {
    width: 56,
  },
  barShort: {
    width: 36,
  },
  action: {
    marginTop: 16,
  },
});
