import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { TrialBanner } from '@/components/ui/TrialBanner';
import { CheckInHeroCard } from '@/components/ui/CheckInHeroCard';
import { PrivacyBanner } from '@/components/ui/PrivacyBanner';
import { FieldToolkit } from '@/components/ui/FieldToolkit';
import { MetricsGrid } from '@/components/ui/MetricsGrid';
import { ActivityTimeline } from '@/components/ui/ActivityTimeline';
import { ClusterCheckInFeed } from '@/components/ui/ClusterCheckInFeed';
import { ConsentModal } from '@/components/ui/ConsentModal';

/**
 * Mobile Home / Field Dashboard Screen
 * Exact composition from Stitch "FlowHRMS - Mobile Home Screen" & "Mobile App Dashboard".
 * Integrates Respectful Field Utility design language for SME operations.
 */
export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [refreshing, setRefreshing] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [consentVisible, setConsentVisible] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleCheckOut = () => {
    Alert.alert(
      'Confirm Check-Out',
      'Location will be captured at check-out time. Confirm punch out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: () => setIsCheckedIn(false),
        },
      ]
    );
  };

  const handleCheckIn = () => {
    setIsCheckedIn(true);
    Alert.alert(
      'Checked In Successfully',
      'Location geo-fenced & matched at Jaipur Central Warehouse.'
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.surfaceCanvasWarm }]}>
      {/* Free Trial Banner */}
      <TrialBanner
        daysLeft={26}
        endDateStr="27 Oct"
        onChoosePlan={() => router.push('/(tabs)/menu' as any)}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.colors.brandPrimary}
            colors={[t.colors.brandPrimary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Check-in Card */}
        <CheckInHeroCard
          shiftName="SHIFT A"
          shiftHours="09:00 - 18:00"
          employeeName="Ramesh"
          locationName="Jaipur Central Warehouse"
          avatarInitials="RS"
          isCheckedIn={isCheckedIn}
          checkInTime="09:12 AM"
          onCheckOut={handleCheckOut}
          onCheckIn={handleCheckIn}
          onLogFieldVisit={() => router.push('/(tabs)/tasks' as any)}
        />

        {/* 2. Respectful Privacy Banner (Evidence, not surveillance) */}
        <PrivacyBanner />

        {/* 3. Field Operational Toolkit (4-column grid) */}
        <FieldToolkit
          onStockProof={() => router.push('/(tabs)/tasks' as any)}
          onStoreVisit={() => router.push('/(tabs)/tasks' as any)}
          onGatePass={() => router.push('/(tabs)/tasks' as any)}
          onExpense={() =>
            Alert.alert('Field Expense', 'Expense logging sheet opened.')
          }
        />

        {/* 4. Today's Pulse Metrics (2x2 Grid) */}
        <MetricsGrid
          title="TODAY'S PULSE"
          subtitle="Jaipur Hub"
        />

        {/* 5. Today's Schedule & Logs Activity Timeline */}
        <ActivityTimeline
          title="TODAY'S SCHEDULE & LOGS"
          countLabel="3 of 4 logged"
        />

        {/* 6. Cluster Peer Check-in Feed */}
        <ClusterCheckInFeed
          onViewLiveMap={() =>
            Alert.alert('Live Map', 'Regional logistics map opened.')
          }
        />
      </ScrollView>

      {/* DPDP 2023 Consent Modal */}
      <ConsentModal
        visible={consentVisible}
        userName="Rishabh"
        onAgree={() => setConsentVisible(false)}
        onDecline={() => setConsentVisible(false)}
        onClose={() => setConsentVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
});
