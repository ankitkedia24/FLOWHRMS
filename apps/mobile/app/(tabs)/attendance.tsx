import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { TrialBanner } from '@/components/ui/TrialBanner';
import { EmptyExceptionsCard } from '@/components/ui/EmptyExceptionsCard';
import { EmployeeCard, EmployeeData } from '@/components/ui/EmployeeCard';

const ATTENDANCE_EMPLOYEES: EmployeeData[] = [
  {
    id: '1',
    name: 'Rishabh',
    code: 'EMP-0001',
    role: 'Owner',
    email: 'rishabh17704@gmail.com',
    status: 'active',
    attendanceStatus: 'not_recorded',
    location: 'Works across locations',
    initials: 'R',
  },
  {
    id: '2',
    name: 'Manas Mody',
    role: 'Field Ops',
    phone: '+917829910939',
    status: 'active',
    attendanceStatus: 'not_recorded',
    location: 'Jaipur Central Warehouse',
    initials: 'M',
  },
];

/**
 * Mobile Attendance Screen
 * Faithful implementation of Stitch "FlowHRMS - Mobile Attendance Screen".
 * Features date navigator, 2x2 summary metrics, exceptions card, filter pills, and live employee roster.
 */
export default function AttendanceScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const [activeFilter, setActiveFilter] = useState<'all' | 'not_recorded' | 'present' | 'late'>('all');
  const [employees, setEmployees] = useState<EmployeeData[]>(ATTENDANCE_EMPLOYEES);

  const presentCount = employees.filter((e) => e.attendanceStatus === 'present').length;
  const lateCount = employees.filter((e) => e.attendanceStatus === 'late').length;
  const notRecordedCount = employees.filter((e) => e.attendanceStatus === 'not_recorded').length;
  const needsReviewCount = employees.filter((e) => e.attendanceStatus === 'needs_review').length;

  const handleCheckInEmployee = (id: string) => {
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, attendanceStatus: 'present' } : e
      )
    );
    Alert.alert('Checked In', 'Employee check-in logged with geofence stamp.');
  };

  const handleRemindEmployee = (name: string) => {
    Alert.alert('Reminder Sent', `Notification ping dispatched to ${name}.`);
  };

  const filteredEmployees = employees.filter((e) => {
    if (activeFilter === 'not_recorded') return e.attendanceStatus === 'not_recorded';
    if (activeFilter === 'present') return e.attendanceStatus === 'present';
    if (activeFilter === 'late') return e.attendanceStatus === 'late';
    return true;
  });

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.surfaceCanvasWarm }]}>
      {/* Free Trial Banner */}
      <TrialBanner daysLeft={26} endDateStr="27 Oct" />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Screen Header & Date Navigator */}
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: t.colors.brandNavy }]}>
            Attendance
          </Text>

          {/* Quick Date Pill */}
          <View
            style={[
              styles.datePill,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <TouchableOpacity style={styles.navChevron} activeOpacity={0.7}>
              <ChevronLeft size={14} color={t.colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.dateLabelRow}>
              <Calendar size={12} color={t.colors.brandPrimary} />
              <Text style={[styles.dateText, { color: t.colors.textPrimary }]}>
                Today, 14 Oct
              </Text>
            </View>

            <TouchableOpacity
              style={styles.navChevron}
              activeOpacity={0.7}
              disabled
            >
              <ChevronRight size={14} color={t.colors.textDisabled} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2x2 Metric Summary Cards Grid */}
        <View style={styles.metricsGrid}>
          {/* 1. Present */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <View
                style={[
                  styles.metricDot,
                  { backgroundColor: t.colors.accentPositive },
                ]}
              />
              <Text style={[styles.metricLabel, { color: t.colors.textSecondary }]}>
                Present
              </Text>
            </View>
            <View>
              <Text style={[styles.metricNumber, { color: t.colors.textPrimary }]}>
                {presentCount}
              </Text>
              <Text style={[styles.metricSub, { color: t.colors.textTertiary }]}>
                of {employees.length} employees
              </Text>
            </View>
          </View>

          {/* 2. Late */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <View
                style={[
                  styles.metricDot,
                  { backgroundColor: '#F59E0B' },
                ]}
              />
              <Text style={[styles.metricLabel, { color: t.colors.textSecondary }]}>
                Late
              </Text>
            </View>
            <View>
              <Text style={[styles.metricNumber, { color: t.colors.textPrimary }]}>
                {lateCount}
              </Text>
              <Text style={[styles.metricSub, { color: t.colors.textTertiary }]}>
                of {employees.length} employees
              </Text>
            </View>
          </View>

          {/* 3. Not Recorded (Prominent) */}
          <View
            style={[
              styles.metricCard,
              styles.highlightCard,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.brandPrimarySubtleHover,
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <View
                style={[
                  styles.metricDot,
                  { backgroundColor: t.colors.brandPrimary },
                ]}
              />
              <Text
                style={[
                  styles.metricLabel,
                  { color: t.colors.brandNavy, fontWeight: '700' },
                ]}
              >
                Not recorded
              </Text>
            </View>
            <View>
              <Text style={[styles.metricNumber, { color: t.colors.brandNavy }]}>
                {notRecordedCount}
              </Text>
              <Text style={[styles.metricSub, { color: t.colors.brandPrimary }]}>
                of {employees.length} employees
              </Text>
            </View>
          </View>

          {/* 4. Needs Review */}
          <View
            style={[
              styles.metricCard,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <View style={styles.metricHeader}>
              <View
                style={[
                  styles.metricDot,
                  { backgroundColor: '#B45309' },
                ]}
              />
              <Text style={[styles.metricLabel, { color: t.colors.textSecondary }]}>
                Needs review
              </Text>
            </View>
            <View>
              <Text style={[styles.metricNumber, { color: t.colors.textPrimary }]}>
                {needsReviewCount}
              </Text>
              <Text style={[styles.metricSub, { color: t.colors.textTertiary }]}>
                of {employees.length} employees
              </Text>
            </View>
          </View>
        </View>

        {/* Review Exceptions Section */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionTitle, { color: t.colors.brandNavy }]}>
            Review exceptions (0)
          </Text>
          <EmptyExceptionsCard />
        </View>

        {/* Today's Attendance List Section */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: t.colors.brandNavy }]}>
              Today
            </Text>
            <Text style={[styles.totalCountText, { color: t.colors.textTertiary }]}>
              Total: {employees.length} members
            </Text>
          </View>

          {/* Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {(
              [
                { id: 'all', label: `All (${employees.length})` },
                { id: 'not_recorded', label: `Not recorded (${notRecordedCount})` },
                { id: 'present', label: `Present (${presentCount})` },
                { id: 'late', label: `Late (${lateCount})` },
              ] as const
            ).map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterPill,
                    isActive
                      ? { backgroundColor: t.colors.brandNavy }
                      : {
                          backgroundColor: t.colors.surfaceDefault,
                          borderColor: t.colors.borderDefault,
                        },
                  ]}
                  onPress={() => setActiveFilter(filter.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      isActive
                        ? { color: '#FFFFFF' }
                        : { color: t.colors.textSecondary },
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Employee Roster Cards */}
          <View style={styles.rosterList}>
            {filteredEmployees.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employee={emp}
                quickActionLabel={
                  emp.attendanceStatus === 'present' ? undefined : 'Check in'
                }
                onQuickAction={() => handleCheckInEmployee(emp.id)}
              />
            ))}
          </View>

          {/* Verified Helper Banner */}
          <View
            style={[
              styles.helperBox,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderSubtle,
              },
            ]}
          >
            <Text style={[styles.helperText, { color: t.colors.textTertiary }]}>
              Records update instantly when staff check in via app or GPS geo-fence.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button: Manual Entry */}
      <TouchableOpacity
        style={[
          styles.fab,
          { backgroundColor: t.colors.brandPrimary },
        ]}
        activeOpacity={0.85}
        onPress={() =>
          Alert.alert('Manual Entry', 'Manual attendance entry modal opened.')
        }
      >
        <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={styles.fabText}>Manual Entry</Text>
      </TouchableOpacity>
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
    paddingBottom: 80,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  navChevron: {
    padding: 2,
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricCard: {
    width: '48.8%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  highlightCard: {
    borderWidth: 1.5,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  metricSub: {
    fontSize: 11,
    marginTop: 1,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalCountText: {
    fontSize: 12,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rosterList: {
    gap: 8,
    marginTop: 4,
  },
  helperBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 6,
  },
  helperText: {
    fontSize: 11,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowColor: 'rgba(99, 102, 241, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
