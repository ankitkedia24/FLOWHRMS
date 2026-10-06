import React, { useState, useEffect } from 'react';
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
  Building,
  CalendarDays,
  FileText,
  UserCheck,
  Award,
  Palmtree,
  Bell,
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
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/lib/api-service';
import { useAuth } from '@/lib/auth-context';

/**
 * Role-Based Mobile Home / Dashboard (Screen 4A & 4B)
 *
 * Implements the core architecture rule:
 * - Admin/Owner -> Admin Dashboard (Company/organization overview & Admin Modules)
 * - Employee   -> Employee Home (Employee's personal HRMS overview & Employee Modules)
 *
 * Home and Dashboard are NOT competing generic screens; they are role-resolved experiences.
 */
export default function RoleResolvedDashboardScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();
  const { user, isAdmin, switchRole } = useAuth();

  // Role view defaults directly to the authenticated role
  const [isAdminView, setIsAdminView] = useState(isAdmin);
  const [refreshing, setRefreshing] = useState(false);
  const [isCheckedIn, setIsCheckedIn] = useState(true);
  const [consentVisible, setConsentVisible] = useState(false);

  useEffect(() => {
    setIsAdminView(isAdmin);
  }, [isAdmin]);

  const onRefresh = async () => {
    setRefreshing(true);
    await attendanceService.getToday();
    setRefreshing(false);
    toast.info('Shift and operations synced with Jaipur cluster.');
  };

  const handleCheckOut = async () => {
    Alert.alert(
      'Confirm Check-Out',
      'Location will be captured at check-out time. Confirm punch out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            const res = await attendanceService.punch('check-out');
            setIsCheckedIn(false);
            if (res.ok) {
              toast.info(res.message || 'Checked Out successfully. Shift ended.');
            } else {
              toast.error(res.error || 'Failed to register check-out.');
            }
          },
        },
      ]
    );
  };

  const handleCheckIn = async () => {
    const res = await attendanceService.punch('check-in');
    setIsCheckedIn(true);
    if (res.ok) {
      toast.success(res.message || 'Checked In successfully. Jaipur Central Warehouse (35m).');
    } else {
      toast.error(res.error || 'Failed to punch in.');
    }
  };

  const handleTogglePreview = () => {
    const nextMode = !isAdminView;
    setIsAdminView(nextMode);
    switchRole(nextMode ? 'admin' : 'employee');
    toast.info(`Switched view to: ${nextMode ? 'Admin Dashboard' : 'Employee Home'}`);
  };

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.surfaceCanvasWarm }]}>
      {/* Free Trial Banner */}
      <TrialBanner
        daysLeft={26}
        endDateStr="27 Oct"
        onChoosePlan={() => router.push('/subscription' as any)}
      />

      {/* Role Context Bar & Preview Switcher */}
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
            Role:{' '}
            <Text style={{ fontWeight: '800', color: t.colors.textPrimary }}>
              {isAdminView ? 'Admin / Owner' : 'Field Employee'}
            </Text>
            {' · '}
            <Text style={{ color: t.colors.brandPrimary, fontWeight: '600' }}>
              {isAdminView ? 'Admin Dashboard' : 'Employee Home'}
            </Text>
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.modeSwitchBtn,
            { backgroundColor: t.colors.brandPrimarySubtle },
          ]}
          onPress={handleTogglePreview}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeSwitchBtnText, { color: t.colors.brandPrimary }]}>
            {isAdminView ? 'Preview Employee View ↗' : 'Preview Admin View ↗'}
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
        {isAdminView ? (
          /* =======================================================
             4A. ADMIN DASHBOARD (Company & Organization Overview)
             ======================================================= */
          <View style={styles.adminDashboard}>
            {/* Quick Pulse Metrics */}
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
                <Text style={[styles.pulseNumber, { color: t.colors.textPrimary }]}>24</Text>
                <Text style={[styles.pulseLabel, { color: t.colors.textSecondary }]}>
                  Total Employees
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
                <Text style={[styles.pulseNumber, { color: t.colors.accentPositive }]}>22</Text>
                <Text style={[styles.pulseLabel, { color: t.colors.textSecondary }]}>
                  On Duty Today
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
                <Text style={[styles.pulseNumber, { color: t.colors.brandPrimary }]}>1</Text>
                <Text style={[styles.pulseLabel, { color: t.colors.textSecondary }]}>
                  Pending Leave
                </Text>
              </View>
            </View>

            {/* Exceptions / Pending Review */}
            <View style={styles.sectionHeader}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Attendance Exceptions & Audits
              </Text>
              <StatusChip status={{ key: 'clear', label: '0 Pending', tone: 'neutral' }} size="sm" />
            </View>
            <EmptyExceptionsCard
              title="No exceptions to review."
              subtitle="All shift check-ins and locations are clear across Jaipur hub."
            />

            {/* Admin Modules (The 7 Core Admin Modules) */}
            <View style={styles.sectionHeader}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Admin Modules
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                Company Operations
              </Text>
            </View>

            <View style={styles.shortcutsGrid}>
              {/* 1. Employees */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/(tabs)/employees')}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#EEF2FF' }]}>
                  <Users size={18} color="#4F46E5" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Employees</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>24 active roster</Text>
              </TouchableOpacity>

              {/* 2. Attendance */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/(tabs)/attendance')}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Clock size={18} color="#10B981" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Attendance</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Punches & Rules</Text>
              </TouchableOpacity>

              {/* 3. Leave Management */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/(tabs)/leave')}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <CalendarDays size={18} color="#D97706" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Leave Mgmt</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>1 pending review</Text>
              </TouchableOpacity>

              {/* 4. Payroll */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/payroll' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#FDF2F8' }]}>
                  <CreditCard size={18} color="#DB2777" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Payroll</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>October calculation</Text>
              </TouchableOpacity>

              {/* 5. Departments */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/departments' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Building size={18} color="#7C3AED" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Departments</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Logistics & Fleet</Text>
              </TouchableOpacity>

              {/* 6. Reports */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/reports' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <FileBarChart size={18} color="#0284C7" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Reports</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Audit CSVs</Text>
              </TouchableOpacity>

              {/* 7. Settings */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/company-settings' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#F3F4F6' }]}>
                  <Settings size={18} color="#4B5563" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Settings</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Company & DPDP</Text>
              </TouchableOpacity>

              {/* Daily Report Extra */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/daily-report' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <FileText size={18} color="#059669" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Daily Report</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Today's summary</Text>
              </TouchableOpacity>
            </View>

            {/* Payroll Run Preview Card */}
            <Card style={styles.payrollPreviewCard}>
              <View style={styles.payrollTop}>
                <View>
                  <View style={styles.payrollTitleRow}>
                    <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                      October 2026 Payroll
                    </Text>
                    <StatusChip
                      status={{ key: 'not_ready', label: 'Ready to compute', tone: 'info' }}
                      size="sm"
                    />
                  </View>
                  <Text
                    style={[
                      t.typography.caption,
                      { color: t.colors.textSecondary, marginTop: 4, maxWidth: 240 },
                    ]}
                  >
                    24 employees payable. Compliant with wage act & attendance rules.
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

            {/* Cluster Peer Check-in Feed */}
            <ClusterCheckInFeed
              onViewLiveMap={() =>
                Alert.alert('Live Map', 'Regional logistics map opened.')
              }
            />

            {/* Recent Audit Timeline */}
            <ActivityTimeline
              title="RECENT AUDIT ACTIVITY"
              countLabel="Immutable log"
            />
          </View>
        ) : (
          /* =======================================================
             4B. EMPLOYEE HOME (Personal HRMS Overview)
             ======================================================= */
          <View style={styles.employeeDashboard}>
            {/* 1. Hero Check-in Card (My Attendance / Instant Punch) */}
            <CheckInHeroCard
              shiftName="GENERAL SHIFT"
              shiftHours="08:30 - 17:30"
              employeeName={user?.name || 'Ramesh Kumar'}
              locationName={user?.cluster || 'Jaipur Central Warehouse'}
              avatarInitials={user?.name ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2) : 'RK'}
              isCheckedIn={isCheckedIn}
              checkInTime="09:12 AM"
              onCheckOut={handleCheckOut}
              onCheckIn={handleCheckIn}
              onLogFieldVisit={() => router.push('/(tabs)/tasks')}
            />

            {/* 2. Respectful Privacy Banner */}
            <PrivacyBanner />

            {/* 3. Employee Modules (The 6 Personal HRMS Tools) */}
            <View style={styles.sectionHeader}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                My HRMS
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                Personal Hub
              </Text>
            </View>

            <View style={styles.shortcutsGrid}>
              {/* 1. My Attendance */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/(tabs)/attendance')}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#ECFDF5' }]}>
                  <Clock size={18} color="#10B981" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>My Attendance</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>22/24 days present</Text>
              </TouchableOpacity>

              {/* 2. Apply Leave */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/(tabs)/leave')}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#FEF3C7' }]}>
                  <CalendarDays size={18} color="#D97706" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Apply Leave</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>4 casual balance</Text>
              </TouchableOpacity>

              {/* 3. My Payroll */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/payslips' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#EEF2FF' }]}>
                  <CreditCard size={18} color="#4F46E5" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>My Payroll</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Download payslips</Text>
              </TouchableOpacity>

              {/* 4. Holidays */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() =>
                  Alert.alert(
                    'Upcoming Holidays 2026',
                    '• Diwali: 1 Nov 2026 (Gazetted)\n• Guru Nanak Jayanti: 15 Nov 2026\n• Christmas: 25 Dec 2026'
                  )
                }
              >
                <View style={[styles.scIconBox, { backgroundColor: '#FDF2F8' }]}>
                  <Palmtree size={18} color="#DB2777" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Holidays</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>Diwali · 1 Nov</Text>
              </TouchableOpacity>

              {/* 5. Profile & ID Card */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/id-card' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#EDE9FE' }]}>
                  <Award size={18} color="#7C3AED" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>Digital ID</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>{user?.employeeCode || 'EMP-0428'}</Text>
              </TouchableOpacity>

              {/* 6. Documents Vault */}
              <TouchableOpacity
                style={[
                  styles.shortcutItem,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => router.push('/documents' as any)}
              >
                <View style={[styles.scIconBox, { backgroundColor: '#E0F2FE' }]}>
                  <FileText size={18} color="#0284C7" />
                </View>
                <Text style={[styles.scTitle, { color: t.colors.textPrimary }]}>My Documents</Text>
                <Text style={[styles.scDesc, { color: t.colors.textTertiary }]}>KYC & Aadhaar</Text>
              </TouchableOpacity>
            </View>

            {/* 4. Field Operational Toolkit */}
            <FieldToolkit
              onStockProof={() => router.push('/(tabs)/tasks')}
              onStoreVisit={() => router.push('/(tabs)/tasks')}
              onGatePass={() => router.push('/(tabs)/tasks')}
              onExpense={() =>
                Alert.alert('Field Expense', 'Expense logging sheet opened.')
              }
            />

            {/* 5. Today's Pulse Metrics */}
            <MetricsGrid
              title="MY FIELD PULSE"
              subtitle={user?.cluster || 'Jaipur Hub'}
            />

            {/* 6. Today's Schedule & Logs Activity Timeline */}
            <ActivityTimeline
              title="MY SCHEDULE & PUNCH LOGS"
              countLabel="Today's records"
            />
          </View>
        )}
      </ScrollView>

      {/* DPDP 2023 Consent Modal */}
      <ConsentModal
        visible={consentVisible}
        userName={user?.name || 'Rishabh'}
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
    borderRadius: 6,
  },
  modeSwitchBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  adminDashboard: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  employeeDashboard: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  adminPulseRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pulseCard: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  pulseNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  pulseLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutItem: {
    width: '48%',
    padding: 12,
    borderRadius: 10,
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
    marginTop: 2,
  },
  payrollPreviewCard: {
    padding: 16,
  },
  payrollTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
});
