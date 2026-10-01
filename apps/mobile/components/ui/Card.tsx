import React, { ReactNode } from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import { getTheme, type StatusTone } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Card (component-specifications.md §13).
 * Radius follows the employee surface family: 16px (cardEmployee).
 * The warm variant is for employee positive moments only (max one per screen).
 * Status-led cards have a 2px left border in the tone colour.
 */
export interface CardProps {
  statusTone?: StatusTone;
  /** Warm card — employee positive moments only (max one per screen). */
  warm?: boolean;
  /** Remove padding (for tables and lists that manage their own). */
  flush?: boolean;
  style?: ViewStyle;
  children: ReactNode;
}

export function Card({
  statusTone,
  warm = false,
  flush = false,
  style,
  children,
}: CardProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View
      style={[
        styles.card,
        { borderRadius: t.radius.cardEmployee },
        t.shadows.elevation1,
        warm
          ? { backgroundColor: t.colors.warmSubtle, borderColor: t.colors.warmBorder }
          : { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
        statusTone && {
          borderLeftWidth: 2,
          borderLeftColor: t.colors.status[statusTone].fg,
        },
        flush && styles.flush,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({
  title,
  meta,
  action,
}: {
  title: string | ReactNode;
  meta?: string | ReactNode;
  action?: ReactNode;
}) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View style={styles.headerRow}>
      <View style={styles.titleContainer}>
        {typeof title === 'string' ? (
          <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
            {title}
          </Text>
        ) : (
          title
        )}
        {meta &&
          (typeof meta === 'string' ? (
            <Text
              style={[
                t.typography.secondary,
                { color: t.colors.textSecondary, marginTop: 2 },
              ]}
            >
              {meta}
            </Text>
          ) : (
            meta
          ))}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  flush: {
    padding: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
});
