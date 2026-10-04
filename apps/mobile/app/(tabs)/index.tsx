import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Calculator,
  CheckSquare,
  FileBarChart,
  Users,
  Settings,
  Clock,
  Calendar,
  Layers,
} from 'lucide-react-native';
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
import { EmptyExceptionsCard } from '@/components/ui/EmptyExceptionsCard';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

/**
 * Mobile Home / Field Dashboard Screen
 * Supports seamless toggling between Admin Mode (Stitch Screen 16)
 * and Field Employee Mode (Stitch Screens 11 & 27).
 */
export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [isAdminMode, setIsAdminMode] = useState(false);
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
        onChoosePlan={() => router.push('/subscription' as any)}
      />

      {/* Mode Switcher Pill Banner (Stitch Screen 11) */}
      <View
        style={[
          styles.modeBar,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderBottomColor: t.colors.borderDefault,
          },
        ]}
      >
        <View style={styles.modeInfo}>
          <Text style={[styles.modeRoleText, { color: t.colors.textSecondary }]}>
            Viewing as:{' '}
            <Text style={{ fontWeight: '800', color: t.colors.textPrimary }}>
              {isAdminMode ? 'Admin / Owner' : 'Field Employee'}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.modeSwitchBtn,
            { backgroundColor: t.colors.brandPrimarySubtle },
          ]}
          onPress={() => setIsAdminMode(!isAdminMode)}
        >
          <Text style={[styles.modeSwitchBtnText, { color: t.colors.brandPrimary }]}>
            {isAdminMode ? 'Switch to Field Mode ↗' : 'Switch to Admin Mode ↗'}
          </Text>
        </TouchableOpacity>
      </View>

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
        {isAdminMode ? (
          /* =======================================================
             ADMIN DASHBOARD (Stitch Screen 16: Mobile App Dashboard)
             ======================================================= */
          <View style={styles.adminDashboard}>
            {/* Quick Metrics Header */}
            <View style={styles.adminPulseRow}>
              <View
                style={[
                  styles.pulseCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <Text style={[styles.pulseNumber, { color: t.colors.textPrimary }]}>0 / 2</Text>
                <Text style={[styles.pulseLabel, { color: t.colors.textSecondary }]}>
                  Present Today
                </Text>
              </View>

              <View
                style={[
                  styles.pulseCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <Text style={[styles.pulseNumber, { color: t.colors.accentPositive }]}>0</Text>
                <Text style={[styles.pulseLabel, { color: t.colors.textSecondary }]}>
                  Exceptions
                </Text>
              </View>

              <View
                style={[
                  styles.pulseCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <Text style={[styles.pulseNumber, { color: t.colors.brandPrimary }]}>3</Text>
                <Text style={[styles.pulseLabel, { color: t.colors.textSecondary }]}>
                  Active Tasks
                </Text>
              </View>
            </View>

            {/* Needs your review Section */}
            <View style={styles.sectionHeader}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Needs your review
              </Text>
              <StatusChip status={{ key: 'clear', label: '0 Pending', tone: 'neutral' }} size="sm" />
            </View>
            <EmptyExceptionsCard
              title="No exceptions to review."
              subtitle="All shift check-ins and locations are clear."
            />

            {/* October 2026 Payroll Preview Card */}
            <Card style={styles.payrollPreviewCard}>
              <View style={styles.payrollTop}>
                <View>
                  <View style={styles.payrollTitleRow}>
                    <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                      October 2026 Payroll
                    </Text>
                    <StatusChip
                      status={{ key: 'not_ready', label: 'Not ready', tone: 'neutral' }}
                      size="sm"
                    />
                  </View>
                  <Text
                    style={[
                      t.typography.caption,
                      { color: t.colors.textSecondary, marginTop: 4, maxWidth: 240 },
                    ]}
                  >
                    1 employee payable. Ready to compute based on approved attendance.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.calculateCta,
                    { backgroundColor: t.colors.brandPrimary },
                  ]}
                  onPress={() => router.push('/payroll' as any)}
                >
                  <Calculator size={14} color="#FFFFFF" />
                  <Text style={styles.calculateCtaText}>Calculate</Text>
                </TouchableOpacity>
              </View>
            </Card>

            {/* Open Tasks Card */}
            <Card style={styles.tasksPreviewCard}>
              <View style={styles.tasksTop}>
                <View>
                  <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                    Open tasks
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                    3 ongoing team assignments
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() => router.push('/(tabs)/tasks')}
                >
                  <Text style={[styles.viewAllText, { color: t.colors.brandPrimary }]}>
                    View all →
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.tasksMiniList}>
                <View style={[styles.taskMiniItem, { borderBottomColor: t.colors.borderSubtle }]}>
                  <CheckSquare size={16} color={t.colors.brandPrimary} />
                  <View style={styles.taskMiniTextWrap}>
                    <Text style={[styles.taskMiniTitle, { color: t.colors.textPrimary }]}>
                      Morning Stock Verification
                    </Text>
                    <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                      Assigned to Manas Mody • Due 11:00 AM
                    </Text>
                  </View>
                  <StatusChip status={{ key: 'in_progress', label: 'In Progress', tone: 'info' }} size="sm" />
                </View>

                <View style={styles.taskMiniItem}>
                  <CheckSquare size={16} color={t.colors.brandPrimary} />
                  <View style={styles.taskMiniTextWrap}>
                    <Text style={[styles.taskMiniTitle, { color: t.colors.textPrimary }]}>
                      Client Route Inspection
                    </Text>
                    <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                      Assigned to Delivery Partner • Due 02:30 PM
                    </Text>
                  </View>
                  <StatusChip status={{ key: 'pending', label: 'Pending', tone: 'neutral' }} size="sm" />
                </View>
              </View>
            </Card>

            {/* Quick Operations Shortcuts */}
            <View style={styles.sectionHeader}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Daily Operations & Reports
              </Text>
            </View>

            <View style={styles.shortcutsGrid}>
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => router.push('/daily-report' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <FileBarChart size={18} color="#10B981" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Daily Report</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Live pulse</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => router.push('/reports' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: t.colors.brandPrimarySubtle }]}>
                  <CreditCard size={18} color={t.colors.brandPrimary} />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Exports</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Audit CSVs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => router.push('/departments' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Users size={18} color="#7C3AED" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Departments</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Units & Heads</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => router.push('/activity-log' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <ShieldCheck size={18} color="#D97706" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Activity Log</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Audit trail</Text>
              </TouchableOpacity>
            </View>

            {/* Recent Activity Timeline */}
            <ActivityTimeline
              title="RECENT AUDIT ACTIVITY"
              countLabel="Immutable log"
            />
          </View>
        ) : (
          /* =======================================================
             FIELD EMPLOYEE HOME (Stitch Screens 11 & 27)
             ======================================================= */
          <View style={styles.employeeDashboard}>
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
              onLogFieldVisit={() => router.push('/(tabs)/tasks')}
            />

            {/* 2. Respectful Privacy Banner (Evidence, not surveillance) */}
            <PrivacyBanner />

            {/* 3. Field Operational Toolkit (4-column grid) */}
            <FieldToolkit
              onStockProof={() => router.push('/(tabs)/tasks')}
              onStoreVisit={() => router.push('/(tabs)/tasks')}
              onGatePass={() => router.push('/(tabs)/tasks')}
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
          </View>
        )}
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
  modeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  modeInfo: {
    flex: 1,
  },
  modeRoleText: {
    fontSize: 12,
  },
  modeSwitchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modeSwitchBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  adminDashboard: {
    gap: 16,
  },
  employeeDashboard: {
    gap: 14,
  },
  adminPulseRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pulseCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  pulseNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  pulseLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  payrollPreviewCard: {
    padding: 16,
    marginBottom: 0,
  },
  payrollTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  payrollTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calculateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  calculateCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tasksPreviewCard: {
    padding: 16,
    marginBottom: 0,
  },
  tasksTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAllBtn: {
    paddingVertical: 2,
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tasksMiniList: {
    gap: 0,
  },
  taskMiniItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  taskMiniTextWrap: {
    flex: 1,
  },
  taskMiniTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutItem: {
    width: '48%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  scIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  scTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  scDesc: {
    fontSize: 11,
    marginTop: 1,
  },
});
