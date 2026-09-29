import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { MapPin, Navigation, CheckCircle2, AlertTriangle, History, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getAccuratePosition, AccuratePosition } from '@/lib/location';

export default function AttendanceScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const theme = Colors[colorScheme];

  const [loadingLocation, setLoadingLocation] = useState(false);
  const [position, setPosition] = useState<AccuratePosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [punchState, setPunchState] = useState<'IDLE' | 'CHECKED_IN'>('IDLE');

  const handleFetchLocation = async () => {
    setLoadingLocation(true);
    setLocationError(null);
    const { position: pos, error } = await getAccuratePosition();
    setLoadingLocation(false);

    if (error || !pos) {
      setLocationError(error || 'Could not resolve accurate location');
      return;
    }
    setPosition(pos);
  };

  const handlePunch = async () => {
    if (!position) {
      await handleFetchLocation();
    }

    if (position && position.accuracy && position.accuracy > 200) {
      Alert.alert(
        'GPS Accuracy Too Low',
        `Current accuracy is ${Math.round(position.accuracy)}m. FlowHRMS policy requires accuracy better than 200m.`
      );
      return;
    }

    if (punchState === 'IDLE') {
      setPunchState('CHECKED_IN');
      Alert.alert('Success', 'Punch In recorded successfully at Main Office Branch!');
    } else {
      setPunchState('IDLE');
      Alert.alert('Success', 'Punch Out recorded successfully. Have a great evening!');
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      {/* Geofence & Location Status Card */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: '#0FA57E15' }]}>
            <MapPin size={22} color="#0FA57E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.branchName, { color: theme.text }]}>Headquarters - Branch A</Text>
            <Text style={[styles.geofenceText, { color: '#0FA57E' }]}>Within 300m designated perimeter</Text>
          </View>
        </View>

        {position ? (
          <View style={styles.locationDetails}>
            <View style={styles.locRow}>
              <Navigation size={14} color={theme.tabIconDefault} />
              <Text style={[styles.locCoords, { color: theme.tabIconDefault }]}>
                {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
              </Text>
            </View>
            <View style={[styles.accuracyBadge, { backgroundColor: '#0FA57E15' }]}>
              <Text style={[styles.accuracyText, { color: '#0FA57E' }]}>
                Accuracy: ±{Math.round(position.accuracy ?? 10)}m
              </Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.resolveLocButton, { borderColor: theme.border }]}
            onPress={handleFetchLocation}
            disabled={loadingLocation}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color={theme.tint} />
            ) : (
              <>
                <Navigation size={14} color={theme.tint} />
                <Text style={[styles.resolveText, { color: theme.tint }]}>Verify GPS Location</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {locationError && (
          <View style={styles.errorBanner}>
            <AlertTriangle size={14} color="#E05252" />
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        )}
      </View>

      {/* Main Punch Action */}
      <View style={styles.punchSection}>
        <TouchableOpacity
          style={[
            styles.punchButton,
            { backgroundColor: punchState === 'CHECKED_IN' ? '#E05252' : '#7166F3' }
          ]}
          activeOpacity={0.85}
          onPress={handlePunch}
        >
          <Text style={styles.punchActionText}>
            {punchState === 'CHECKED_IN' ? 'TAP TO PUNCH OUT' : 'TAP TO PUNCH IN'}
          </Text>
          <Text style={styles.punchSubText}>
            {punchState === 'CHECKED_IN' ? 'End shift & record departure' : 'Starts work timer with GPS verification'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Recent Punch Activity */}
      <View style={styles.historyHeader}>
        <History size={18} color={theme.text} />
        <Text style={[styles.historyTitle, { color: theme.text }]}>Today's Log</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0 }]}>
        <View style={[styles.logRow, { borderBottomColor: theme.border }]}>
          <View style={[styles.logIcon, { backgroundColor: '#0FA57E15' }]}>
            <ArrowDownLeft size={16} color="#0FA57E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.logTitle, { color: theme.text }]}>Check-In Recorded</Text>
            <Text style={[styles.logSub, { color: theme.tabIconDefault }]}>Verified at Branch A Geofence</Text>
          </View>
          <Text style={[styles.logTime, { color: theme.text }]}>09:05 AM</Text>
        </View>

        <View style={styles.logRow}>
          <View style={[styles.logIcon, { backgroundColor: '#7166F315' }]}>
            <ArrowUpRight size={16} color="#7166F3" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.logTitle, { color: theme.text }]}>Expected Check-Out</Text>
            <Text style={[styles.logSub, { color: theme.tabIconDefault }]}>Standard 9-hour shift</Text>
          </View>
          <Text style={[styles.logTime, { color: theme.tabIconDefault }]}>06:00 PM</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  card: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  branchName: { fontSize: 16, fontWeight: '700' },
  geofenceText: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  locationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF10',
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locCoords: { fontSize: 12, fontFamily: 'monospace' },
  accuracyBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  accuracyText: { fontSize: 11, fontWeight: '700' },
  resolveLocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 14,
  },
  resolveText: { fontSize: 13, fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#E0525215',
  },
  errorText: { color: '#E05252', fontSize: 12 },
  punchSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  punchButton: {
    width: '100%',
    paddingVertical: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  punchActionText: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  punchSubText: { color: '#FFFFFFCC', fontSize: 12, marginTop: 4 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  historyTitle: { fontSize: 16, fontWeight: '700' },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  logIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logTitle: { fontSize: 14, fontWeight: '600' },
  logSub: { fontSize: 11, marginTop: 2 },
  logTime: { fontSize: 13, fontWeight: '700' },
});
