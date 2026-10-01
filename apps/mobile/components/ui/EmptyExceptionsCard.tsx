import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface EmptyExceptionsCardProps {
  title?: string;
  subtitle?: string;
  note?: string;
}

/**
 * Empty Exceptions Card
 * Exact empty state illustration from Stitch project:
 * Displays the signature staggered 3-pill FlowHRMS icon and respectful message:
 * "Delivery and field staff often work away from a branch. Exceptions are normal — they are a record to confirm, not a fault to punish."
 */
export function EmptyExceptionsCard({
  title = 'No exceptions to review.',
  subtitle = 'Attendance for today is clear.',
  note = 'Delivery and field staff often work away from a branch. Exceptions are normal — they are a record to confirm, not a fault to punish.',
}: EmptyExceptionsCardProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View style={styles.wrapper}>
      {note ? (
        <Text style={[styles.explanatoryNote, { color: t.colors.textSecondary }]}>
          {note}
        </Text>
      ) : null}

      <View
        style={[
          styles.container,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderColor: t.colors.borderDefault,
          },
        ]}
      >
        {/* Staggered 3-pill FlowHRMS brand mark illustration */}
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: t.colors.brandPrimarySubtle },
          ]}
        >
          <View style={[styles.pill, styles.pillTop, { backgroundColor: '#A5B4FC' }]} />
          <View style={[styles.pill, styles.pillMid, { backgroundColor: '#6366F1' }]} />
          <View style={[styles.pill, styles.pillBottom, { backgroundColor: '#4338CA' }]} />
        </View>

        <Text style={[styles.title, { color: t.colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: t.colors.textTertiary }]}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 4,
  },
  explanatoryNote: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  container: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12,
  },
  pill: {
    height: 6,
    borderRadius: 3,
  },
  pillTop: {
    width: 24,
    transform: [{ translateX: -4 }],
  },
  pillMid: {
    width: 26,
    transform: [{ translateX: 4 }],
  },
  pillBottom: {
    width: 16,
    transform: [{ translateX: 6 }],
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default EmptyExceptionsCard;
