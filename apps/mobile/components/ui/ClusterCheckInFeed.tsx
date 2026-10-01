import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

export interface ClusterPeerItem {
  id: string;
  name: string;
  location: string;
  time: string;
  isOnline?: boolean;
}

interface ClusterCheckInFeedProps {
  onViewLiveMap?: () => void;
  peers?: ClusterPeerItem[];
}

/**
 * Cluster Peer Check-in Feed
 * From Stitch "FlowHRMS - Mobile Home Screen" (§peer-checkins).
 * Live audit logs of team members across regional logistics hubs.
 */
export function ClusterCheckInFeed({
  onViewLiveMap,
  peers,
}: ClusterCheckInFeedProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const defaultPeers: ClusterPeerItem[] = [
    {
      id: '1',
      name: 'Deepak Verma',
      location: 'Karol Bagh Store Check-in',
      time: '09:18',
      isOnline: true,
    },
    {
      id: '2',
      name: 'Priya S.',
      location: 'Bhiwandi Hub Check-in',
      time: '09:15',
      isOnline: true,
    },
  ];

  const items = peers || defaultPeers;

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
        <Text style={[styles.title, { color: t.colors.textSecondary }]}>
          CLUSTER CHECK-IN LOG
        </Text>
        <TouchableOpacity onPress={onViewLiveMap} activeOpacity={0.7}>
          <Text style={[styles.mapLink, { color: t.colors.brandPrimary }]}>
            View Live Map
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {items.map((peer, idx) => (
          <View
            key={peer.id}
            style={[
              styles.itemRow,
              idx < items.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: t.colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.leftGroup}>
              <View
                style={[
                  styles.pulseDot,
                  { backgroundColor: t.colors.accentPositive },
                ]}
              />
              <View>
                <Text style={[styles.peerName, { color: t.colors.textPrimary }]}>
                  {peer.name}
                </Text>
                <Text
                  style={[styles.peerLocation, { color: t.colors.textSecondary }]}
                >
                  {peer.location}
                </Text>
              </View>
            </View>

            <Text style={[styles.timestamp, { color: t.colors.textTertiary }]}>
              {peer.time}
            </Text>
          </View>
        ))}
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
    marginBottom: 10,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  mapLink: {
    fontSize: 11,
    fontWeight: '700',
  },
  list: {},
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  peerName: {
    fontSize: 12,
    fontWeight: '700',
  },
  peerLocation: {
    fontSize: 11,
    marginTop: 1,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
});

export default ClusterCheckInFeed;
