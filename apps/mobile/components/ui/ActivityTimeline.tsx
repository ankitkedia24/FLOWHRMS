import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Check } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

export interface TimelineEvent {
  id: string;
  title: string;
  time: string;
  description: string;
  status: 'completed' | 'ongoing' | 'upcoming';
}

interface ActivityTimelineProps {
  title?: string;
  countLabel?: string;
  events?: TimelineEvent[];
}

/**
 * Activity Timeline Component
 * From Stitch "FlowHRMS - Mobile Home Screen" (§timeline-section).
 * Visual operational trail showing geo-stamped check-ins, audits, and pending dispatches.
 */
export function ActivityTimeline({
  title = "TODAY'S SCHEDULE & LOGS",
  countLabel = '3 of 4 logged',
  events,
}: ActivityTimelineProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const defaultEvents: TimelineEvent[] = [
    {
      id: '1',
      title: 'Shift Check-in Verified',
      time: '09:12',
      description: 'Jaipur Warehouse Main Gate • Geofence Valid',
      status: 'completed',
    },
    {
      id: '2',
      title: 'Bay 4 Stock Audit Completed',
      time: '10:45',
      description: 'Proof of count uploaded (12 SKU pallets)',
      status: 'completed',
    },
    {
      id: '3',
      title: 'Store Delivery & Geo-Proof',
      time: '14:00',
      description: 'Karol Bagh Partner Store • Dispatch pending',
      status: 'upcoming',
    },
  ];

  const items = events || defaultEvents;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.colors.surfaceDefault,
          borderColor: t.colors.borderDefault,
        },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.colors.brandNavy }]}>
          {title}
        </Text>
        <Text style={[styles.countLabel, { color: t.colors.textTertiary }]}>
          {countLabel}
        </Text>
      </View>

      <View style={styles.timelineList}>
        {items.map((event, idx) => {
          const isLast = idx === items.length - 1;
          const isCompleted = event.status === 'completed';
          const isUpcoming = event.status === 'upcoming';

          return (
            <View key={event.id} style={styles.eventRow}>
              {/* Left Line & Node */}
              <View style={styles.nodeColumn}>
                <View
                  style={[
                    styles.nodeCircle,
                    isCompleted && { backgroundColor: t.colors.accentPositive },
                    isUpcoming && { backgroundColor: '#F59E0B' },
                  ]}
                >
                  {isCompleted ? (
                    <Check size={10} color="#FFFFFF" strokeWidth={3} />
                  ) : (
                    <View style={styles.dot} />
                  )}
                </View>
                {!isLast && (
                  <View
                    style={[
                      styles.verticalLine,
                      { backgroundColor: t.colors.borderSubtle },
                    ]}
                  />
                )}
              </View>

              {/* Event Content Box */}
              <View
                style={[
                  styles.contentBox,
                  {
                    backgroundColor: isUpcoming
                      ? '#FFFBEB'
                      : t.colors.surfaceSunken,
                    borderColor: isUpcoming
                      ? '#FDE68A'
                      : t.colors.borderSubtle,
                  },
                ]}
              >
                <View style={styles.contentHeader}>
                  <Text
                    style={[
                      styles.eventTitle,
                      { color: t.colors.textPrimary },
                    ]}
                  >
                    {event.title}
                  </Text>
                  <Text
                    style={[
                      styles.eventTime,
                      isUpcoming
                        ? { color: '#B45309', fontWeight: '700' }
                        : { color: t.colors.textTertiary },
                    ]}
                  >
                    {event.time}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.eventDescription,
                    { color: t.colors.textSecondary },
                  ]}
                >
                  {event.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginVertical: 4,
    shadowColor: 'rgba(0, 0, 0, 0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  timelineList: {
    gap: 12,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  nodeColumn: {
    alignItems: 'center',
    width: 22,
    alignSelf: 'stretch',
  },
  nodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  verticalLine: {
    width: 2,
    flex: 1,
    marginTop: -2,
    marginBottom: -12,
  },
  contentBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  eventTime: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  eventDescription: {
    fontSize: 11,
    marginTop: 2,
  },
});

export default ActivityTimeline;
