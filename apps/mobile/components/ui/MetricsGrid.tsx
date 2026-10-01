import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

export interface PulseMetricItem {
  title: string;
  value: string | number;
  total?: string | number;
  badgeText?: string;
  badgeVariant?: 'success' | 'indigo' | 'warning' | 'neutral';
  progress?: number; // 0 to 100
  footerText?: string;
  actionText?: string;
  onActionPress?: () => void;
}

interface MetricsGridProps {
  title?: string;
  subtitle?: string;
  metrics?: PulseMetricItem[];
}

/**
 * 2x2 Metrics Grid
 * From Stitch "FlowHRMS - Mobile Home Screen" (§today-pulse-metrics) & "Mobile Attendance Screen".
 * High-legibility numeric display calibrated for sunlight readability.
 */
export function MetricsGrid({
  title = "TODAY'S PULSE",
  subtitle = 'Jaipur Hub',
  metrics,
}: MetricsGridProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const defaultMetrics: PulseMetricItem[] = [
    {
      title: 'Present Today',
      value: '142',
      total: '/ 160',
      progress: 88.7,
      footerText: '88.7% On Floor',
    },
    {
      title: 'Assigned Tasks',
      value: '28',
      total: 'in cluster',
      badgeText: '3 pending',
      badgeVariant: 'indigo',
      footerText: '3 yours today (1 pending)',
    },
    {
      title: 'Leave Balance',
      value: '6',
      total: 'days',
      badgeText: 'Paid',
      badgeVariant: 'success',
      actionText: 'Apply Leave →',
    },
    {
      title: 'Payroll Cut-off',
      value: '6',
      total: 'days left',
      badgeText: 'Cycle 30',
      badgeVariant: 'indigo',
      footerText: 'Logs locked on 30th',
    },
  ];

  const items = metrics || defaultMetrics;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: t.colors.textSecondary }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subText, { color: t.colors.brandPrimary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.grid}>
        {items.map((item, idx) => (
          <View
            key={idx}
            style={[
              styles.card,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text
                style={[styles.cardTitle, { color: t.colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {item.badgeText && (
                <View
                  style={[
                    styles.badge,
                    item.badgeVariant === 'success' && {
                      backgroundColor: t.colors.accentPositiveBg,
                    },
                    item.badgeVariant === 'indigo' && {
                      backgroundColor: t.colors.brandPrimarySubtle,
                    },
                    item.badgeVariant === 'warning' && {
                      backgroundColor: '#FEF3C7',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      item.badgeVariant === 'success' && {
                        color: t.colors.status.success.text,
                      },
                      item.badgeVariant === 'indigo' && {
                        color: t.colors.brandPrimary,
                      },
                      item.badgeVariant === 'warning' && {
                        color: '#B45309',
                      },
                    ]}
                  >
                    {item.badgeText}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.valueRow}>
              <Text style={[styles.valueText, { color: t.colors.brandNavy }]}>
                {item.value}
              </Text>
              {item.total ? (
                <Text
                  style={[styles.totalText, { color: t.colors.textTertiary }]}
                >
                  {item.total}
                </Text>
              ) : null}
            </View>

            {/* Progress Bar if present */}
            {typeof item.progress === 'number' && (
              <View
                style={[
                  styles.progressBarBg,
                  { backgroundColor: t.colors.surfaceSunken },
                ]}
              >
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, item.progress))}%`,
                      backgroundColor: t.colors.accentPositive,
                    },
                  ]}
                />
              </View>
            )}

            {/* Footer Text */}
            {item.footerText ? (
              <Text
                style={[
                  styles.footerText,
                  item.progress
                    ? { color: t.colors.status.success.fg }
                    : { color: t.colors.textTertiary },
                ]}
                numberOfLines={1}
              >
                {item.footerText}
              </Text>
            ) : null}

            {/* Action Link */}
            {item.actionText ? (
              <TouchableOpacity
                onPress={item.onActionPress}
                activeOpacity={0.7}
                style={styles.actionBtn}
              >
                <Text
                  style={[styles.actionText, { color: t.colors.brandPrimary }]}
                >
                  {item.actionText}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subText: {
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  card: {
    width: '48.8%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 104,
    shadowColor: 'rgba(0, 0, 0, 0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  valueText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  totalText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  actionBtn: {
    marginTop: 4,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

export default MetricsGrid;
