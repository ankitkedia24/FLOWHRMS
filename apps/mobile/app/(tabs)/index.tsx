import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Clock, Calendar, CheckCircle2, AlertCircle, ArrowUpRight, ShieldCheck } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.tint} />}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.tabIconDefault }]}>Good day,</Text>
          <Text style={[styles.userName, { color: theme.text }]}>Welcome Back 👋</Text>
        </View>
        <View style={[styles.liveBadge, { backgroundColor: isCheckedIn ? '#0FA57E20' : '#E0525220' }]}>
          <View style={[styles.liveDot, { backgroundColor: isCheckedIn ? '#0FA57E' : '#E05252' }]} />
          <Text style={[styles.liveText, { color: isCheckedIn ? '#0FA57E' : '#E05252' }]}>
            {isCheckedIn ? 'ON DUTY' : 'OFF DUTY'}
          </Text>
        </View>
      </View>

      {/* Clock & Today's Shift Card */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconCircle}>
            <Clock size={20} color="#7166F3" />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Today's Shift</Text>
            <Text style={[styles.cardSub, { color: theme.tabIconDefault }]}>General (09:00 AM - 06:00 PM)</Text>
          </View>
        </View>

        <View style={styles.clockContainer}>
          <Text style={[styles.clockText, { color: theme.text }]}>{currentTime}</Text>
          <Text style={[styles.clockDate, { color: theme.tabIconDefault }]}>
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: isCheckedIn ? '#E05252' : '#7166F3' }]}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/attendance')}
        >
          <Text style={styles.buttonText}>
            {isCheckedIn ? 'Proceed to Check-Out' : 'Punch In with GPS'}
          </Text>
          <ArrowUpRight size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.statNumber, { color: '#0FA57E' }]}>21</Text>
          <Text style={[styles.statLabel, { color: theme.tabIconDefault }]}>Days Present</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.statNumber, { color: '#7166F3' }]}>4</Text>
          <Text style={[styles.statLabel, { color: theme.tabIconDefault }]}>Leaves Left</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>2</Text>
          <Text style={[styles.statLabel, { color: theme.tabIconDefault }]}>Active Tasks</Text>
        </View>
      </View>

      {/* Quick Action Tiles */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Actions</Text>
      
      <TouchableOpacity
        style={[styles.actionTile, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => router.push('/(tabs)/leave')}
      >
        <View style={[styles.tileIcon, { backgroundColor: '#7166F315' }]}>
          <Calendar size={20} color="#7166F3" />
        </View>
        <View style={styles.tileInfo}>
          <Text style={[styles.tileTitle, { color: theme.text }]}>Apply for Leave</Text>
          <Text style={[styles.tileSub, { color: theme.tabIconDefault }]}>Request paid, sick, or casual leave</Text>
        </View>
        <ArrowUpRight size={18} color={theme.tabIconDefault} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.actionTile, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => router.push('/(tabs)/attendance')}
      >
        <View style={[styles.tileIcon, { backgroundColor: '#0FA57E15' }]}>
          <ShieldCheck size={20} color="#0FA57E" />
        </View>
        <View style={styles.tileInfo}>
          <Text style={[styles.tileTitle, { color: theme.text }]}>Geofence Status</Text>
          <Text style={[styles.tileSub, { color: theme.tabIconDefault }]}>Verify branch radius & location accuracy</Text>
        </View>
        <ArrowUpRight size={18} color={theme.tabIconDefault} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 14, fontWeight: '500' },
  userName: { fontSize: 22, fontWeight: '700', marginTop: 2 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  card: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7166F315',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSub: { fontSize: 12, marginTop: 2 },
  clockContainer: { alignItems: 'center', paddingVertical: 12 },
  clockText: { fontSize: 36, fontWeight: '800', letterSpacing: 1 },
  clockDate: { fontSize: 13, marginTop: 4 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statNumber: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: '500' },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  actionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileInfo: { flex: 1 },
  tileTitle: { fontSize: 15, fontWeight: '600' },
  tileSub: { fontSize: 12, marginTop: 2 },
});
