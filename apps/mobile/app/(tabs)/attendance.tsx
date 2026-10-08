import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import {
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Users,
  LogOut,
  ShieldCheck,
  Check,
  Briefcase,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { EmployeeCard, EmployeeData } from '@/components/ui/EmployeeCard';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/lib/api-service';
import { useAuth } from '@/lib/auth-context';
import { getAccuratePosition, AccuratePosition } from '@/lib/location';

interface PunchItem {
  id: string;
  sequence: number;
  checkInAt: string;
  checkInTime: string | null;
  checkOutAt: string | null;
  checkOutTime: string | null;
  outcome: string | null;
  distanceM: number | null;
  accuracyM: number | null;
  durationMinutes: number;
}

interface HistoryItem {
  id: string;
  workDate: string;
  dateFormatted: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: string;
  lateMinutes: number;
  outcome: string | null;
  totalHours: number;
  branchName: string;
}

interface TodayData {
  date: string;
  dateFormatted: string;
  isCheckedIn: boolean;
  isCompleted: boolean;
  status: 'PRESENT' | 'LATE' | 'NOT_RECORDED';
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  outcome: string | null;
  distanceM: number | null;
  accuracyM: number | null;
  totalWorkedMinutes: number;
  punches: PunchItem[];
  branch: {
    id?: string;
    name: string;
    address?: string;
    lat: number;
    lng: number;
    radiusM: number;
  };
  shift: {
    id?: string;
    name: string;
    start: string;
    end: string;
    graceMinutes: number;
  };
  history: HistoryItem[];
  isAdmin?: boolean;
  teamMetrics?: {
    total: number;
    present: number;
    checkedOut?: number;
    late: number;
    notRecorded: number;
    needsReview: number;
  };
  teamRoster?: EmployeeData[];
}

export default function AttendanceScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const toast = useToast();
  const { user, isAdmin } = useAuth();

  // Tab mode: "my_punch" for employee clocking; "team" for manager roster
  const [tabMode, setTabMode] = useState<'my_punch' | 'team'>('my_punch');
  const [activeFilter, setActiveFilter] = useState<'all' | 'present' | 'checked_out' | 'not_recorded' | 'late' | 'needs_review'>('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [punching, setPunching] = useState(false);
  const [todayData, setTodayData] = useState<TodayData | null>(null);

  // Live digital clock
  const [currentTime, setCurrentTime] = useState(new Date());

  // GPS Acquisition
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsPosition, setGpsPosition] = useState<AccuratePosition | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Tick clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch GPS position
  const fetchGps = useCallback(async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      const res = await getAccuratePosition();
      if (res.error) {
        setGpsError(res.error);
      } else if (res.position) {
        setGpsPosition(res.position);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'GPS error';
      setGpsError(message);
    } finally {
      setGpsLoading(false);
    }
  }, []);

  // Fetch Attendance data from live PostgreSQL backend
  const loadAttendance = useCallback(async () => {
    try {
      const data = await attendanceService.getToday();
      if (data) {
        setTodayData(data);
      }
    } catch {
      toast.error('Failed to connect', 'Could not refresh attendance from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAttendance();
    fetchGps();
  }, [loadAttendance, fetchGps]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAttendance();
    fetchGps();
  }, [loadAttendance, fetchGps]);

  // Handle Punch In / Punch Out
  const handlePunch = async (action: 'check-in' | 'check-out') => {
    if (punching) return;
    setPunching(true);

    try {
      let coords = gpsPosition;
      if (!coords) {
        const fresh = await getAccuratePosition();
        if (fresh.position) {
          coords = fresh.position;
          setGpsPosition(fresh.position);
        }
      }

      const res = await attendanceService.punch(action, {
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy ?? undefined,
      });

      if (res.success) {
        toast.success(
          action === 'check-in' ? 'Punched In' : 'Punched Out',
          action === 'check-in'
            ? 'Attendance recorded successfully.'
            : 'Day shift attendance concluded.'
        );
        await loadAttendance();
      } else {
        toast.error('Punch Failed', res.error || 'Server rejected punch.');
      }
    } catch {
      toast.error('Network Error', 'Could not communicate with the server.');
    } finally {
      setPunching(false);
    }
  };

  // Handle Admin Quick Punch (In / Out) for an Employee
  const handleAdminPunchEmployee = async (targetEmployeeId: string, action: 'check-in' | 'check-out') => {
    try {
      const res = await attendanceService.punch(
        action,
        gpsPosition
          ? {
              latitude: gpsPosition.latitude,
              longitude: gpsPosition.longitude,
              accuracy: gpsPosition.accuracy ?? undefined,
            }
          : undefined,
        targetEmployeeId
      );

      if (res.success) {
        toast.success(
          action === 'check-in' ? 'Check-in Recorded' : 'Check-out Recorded',
          'Staff attendance updated in database.'
        );
        await loadAttendance();
      } else {
        toast.error('Failed', res.error || 'Could not update staff attendance.');
      }
    } catch {
      toast.error('Error', 'Failed to update attendance for team member.');
    }
  };

  const isCheckedIn = Boolean(todayData?.isCheckedIn);
  const isCompleted = Boolean(todayData?.isCompleted);

  const teamRoster = todayData?.teamRoster ?? [];
  const teamMetrics = {
    total: teamRoster.length,
    present: teamRoster.filter((e) => Boolean(e.isCheckedIn)).length,
    checkedOut: teamRoster.filter((e) => Boolean(e.isCheckedOut)).length,
    notRecorded: teamRoster.filter((e) => !e.isCheckedIn && !e.isCheckedOut).length,
    late: teamRoster.filter((e) => Boolean(e.isLate || (e.lateMinutes && e.lateMinutes > 0))).length,
    needsReview: teamRoster.filter((e) => Boolean(e.needsReview)).length,
  };

  const filteredTeam = teamRoster.filter((e) => {
    if (activeFilter === 'present') return Boolean(e.isCheckedIn);
    if (activeFilter === 'checked_out') return Boolean(e.isCheckedOut);
    if (activeFilter === 'not_recorded') return !e.isCheckedIn && !e.isCheckedOut;
    if (activeFilter === 'late') return Boolean(e.isLate || (e.lateMinutes && e.lateMinutes > 0));
    if (activeFilter === 'needs_review') return Boolean(e.needsReview);
    return true;
  });

  const formattedDate =
    todayData?.dateFormatted ||
    currentTime.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });

  const digitalTimeString = currentTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // Clean branch name without any "placeholder" artifact
  const branchName = (todayData?.branch?.name || 'Main Branch')
    .replace(/\(placeholder\)/gi, '')
    .replace(/placeholder/gi, '')
    .trim() || 'Main Branch';

  if (loading && !todayData) {
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: t.colors.surfaceCanvasWarm }]}>
        <ActivityIndicator size="large" color={t.colors.brandPrimary} />
        <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>
          Loading attendance...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: t.colors.surfaceCanvasWarm }]}>
      {/* Top Segmented Selector if user is Admin / Manager */}
      {isAdmin && (
        <View style={[styles.segmentContainer, { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault }]}>
          <TouchableOpacity
            style={[
              styles.segmentTab,
              tabMode === 'my_punch' && [styles.segmentActive, { backgroundColor: t.colors.brandPrimary }],
            ]}
            onPress={() => setTabMode('my_punch')}
            activeOpacity={0.8}
          >
            <Clock size={15} color={tabMode === 'my_punch' ? '#FFFFFF' : t.colors.textSecondary} />
            <Text
              style={[
                styles.segmentText,
                { color: tabMode === 'my_punch' ? '#FFFFFF' : t.colors.textSecondary },
              ]}
            >
              My Punch
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              tabMode === 'team' && [styles.segmentActive, { backgroundColor: t.colors.brandPrimary }],
            ]}
            onPress={() => setTabMode('team')}
            activeOpacity={0.8}
          >
            <Users size={15} color={tabMode === 'team' ? '#FFFFFF' : t.colors.textSecondary} />
            <Text
              style={[
                styles.segmentText,
                { color: tabMode === 'team' ? '#FFFFFF' : t.colors.textSecondary },
              ]}
            >
              Team Attendance
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[t.colors.brandPrimary]}
            tintColor={t.colors.brandPrimary}
          />
        }
      >
        {/* ===================== VIEW 1: MY PUNCH (Clean Field Employee View) ===================== */}
        {tabMode === 'my_punch' && (
          <>
            {/* Header: Greeting & Date */}
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.subGreeting, { color: t.colors.textSecondary }]}>
                  {user?.name ? `Namaste, ${user.name}` : 'Namaste'}
                </Text>
                <Text style={[styles.heading, { color: t.colors.brandNavy }]}>
                  My Punch
                </Text>
              </View>

              <View
                style={[
                  styles.datePill,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
              >
                <Calendar size={13} color={t.colors.brandPrimary} />
                <Text style={[styles.dateText, { color: t.colors.textPrimary }]}>
                  {formattedDate}
                </Text>
              </View>
            </View>

            {/* Combined Simple Hero Punch Card */}
            <View
              style={[
                styles.heroCard,
                { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
              ]}
            >
              {/* Shift & Branch Info Chips */}
              <View style={styles.shiftChipRow}>
                <View style={styles.chipPill}>
                  <Briefcase size={12} color={t.colors.brandPrimary} />
                  <Text style={[styles.chipText, { color: t.colors.textPrimary }]}>
                    {todayData?.shift?.start || '09:30 AM'} - {todayData?.shift?.end || '06:30 PM'}
                  </Text>
                </View>

                <View style={styles.chipPill}>
                  <MapPin size={12} color={t.colors.textSecondary} />
                  <Text style={[styles.chipText, { color: t.colors.textSecondary }]} numberOfLines={1}>
                    {branchName}
                  </Text>
                </View>
              </View>

              {/* Digital Clock */}
              <Text style={[styles.digitalClock, { color: t.colors.brandNavy }]}>
                {digitalTimeString}
              </Text>

              {/* Current Status Badge */}
              <View style={styles.statusRow}>
                {isCheckedIn ? (
                  <View style={[styles.statusBadge, { backgroundColor: '#DEF7EC' }]}>
                    <View style={[styles.statusDot, { backgroundColor: '#059669' }]} />
                    <Text style={[styles.statusBadgeText, { color: '#03543F' }]}>
                      On Duty (In at {todayData?.checkInTime})
                    </Text>
                  </View>
                ) : isCompleted ? (
                  <View style={[styles.statusBadge, { backgroundColor: '#E1EFFE' }]}>
                    <CheckCircle2 size={13} color="#1E429F" />
                    <Text style={[styles.statusBadgeText, { color: '#1E429F' }]}>
                      Shift Completed for Today
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                    <AlertCircle size={13} color="#92400E" />
                    <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>
                      Not Punched In Yet
                    </Text>
                  </View>
                )}
              </View>

              {/* Big, Clear Punch Button */}
              <TouchableOpacity
                style={[
                  styles.punchButton,
                  isCheckedIn
                    ? { backgroundColor: '#EF4444' }
                    : { backgroundColor: '#10B981' },
                  punching && { opacity: 0.7 },
                ]}
                onPress={() => handlePunch(isCheckedIn ? 'check-out' : 'check-in')}
                activeOpacity={0.85}
                disabled={punching}
              >
                {punching ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : isCheckedIn ? (
                  <>
                    <LogOut size={20} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.punchButtonText}>PUNCH OUT</Text>
                  </>
                ) : (
                  <>
                    <Check size={20} color="#FFFFFF" strokeWidth={3} />
                    <Text style={styles.punchButtonText}>PUNCH IN</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Simplified Reassuring Location Strip */}
              <View style={styles.locationStrip}>
                <View style={styles.locationLeft}>
                  {gpsPosition ? (
                    <>
                      <ShieldCheck size={14} color="#059669" />
                      <Text style={[styles.locationStatusText, { color: '#065F46' }]}>
                        GPS Location Verified
                      </Text>
                    </>
                  ) : gpsLoading ? (
                    <>
                      <ActivityIndicator size="small" color={t.colors.brandPrimary} />
                      <Text style={[styles.locationStatusText, { color: t.colors.textSecondary }]}>
                        Locating...
                      </Text>
                    </>
                  ) : (
                    <>
                      <MapPin size={14} color={t.colors.textTertiary} />
                      <Text style={[styles.locationStatusText, { color: t.colors.textSecondary }]}>
                        GPS Ready
                      </Text>
                    </>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={fetchGps}
                  disabled={gpsLoading}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={12} color={t.colors.brandPrimary} />
                  <Text style={[styles.refreshBtnText, { color: t.colors.brandPrimary }]}>
                    Refresh
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Today's Punch Summary */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: t.colors.brandNavy }]}>
                Today's Summary
              </Text>

              {todayData?.punches && todayData.punches.length > 0 ? (
                <View
                  style={[
                    styles.cardList,
                    { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                  ]}
                >
                  {todayData.punches.map((p, idx) => {
                    const isOutside = p.outcome === 'OUTSIDE';
                    const durationStr =
                      p.durationMinutes > 0
                        ? `${Math.floor(p.durationMinutes / 60)}h ${p.durationMinutes % 60}m`
                        : 'Active';

                    return (
                      <View
                        key={p.id || idx}
                        style={[
                          styles.punchSessionRow,
                          idx > 0 && { borderTopWidth: 1, borderTopColor: t.colors.borderSubtle },
                        ]}
                      >
                        <View style={styles.sessionBadge}>
                          <Text style={styles.sessionNumber}>#{p.sequence}</Text>
                        </View>

                        <View style={styles.sessionDetails}>
                          <Text style={[styles.sessionTimes, { color: t.colors.textPrimary }]}>
                            {p.checkInTime || '--'} → {p.checkOutTime || 'Active'}
                          </Text>
                          <Text style={[styles.sessionSub, { color: t.colors.textTertiary }]}>
                            Duration: {durationStr}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.siteBadge,
                            isOutside
                              ? { backgroundColor: '#FEF3C7' }
                              : { backgroundColor: '#DEF7EC' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.siteBadgeText,
                              isOutside ? { color: '#92400E' } : { color: '#03543F' },
                            ]}
                          >
                            {isOutside ? 'Field Site' : 'Office'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                  ]}
                >
                  <Clock size={22} color={t.colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: t.colors.textSecondary }]}>
                    No punches recorded yet today. Tap PUNCH IN to start your shift.
                  </Text>
                </View>
              )}
            </View>

            {/* Recent Attendance (Last 7 Days) */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionTitle, { color: t.colors.brandNavy }]}>
                Recent Attendance
              </Text>

              {todayData?.history && todayData.history.length > 0 ? (
                <View
                  style={[
                    styles.cardList,
                    { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                  ]}
                >
                  {todayData.history.map((h, idx) => (
                    <View
                      key={h.id || idx}
                      style={[
                        styles.historyRow,
                        idx > 0 && { borderTopWidth: 1, borderTopColor: t.colors.borderSubtle },
                      ]}
                    >
                      <View style={styles.historyLeft}>
                        <Text style={[styles.historyDay, { color: t.colors.textPrimary }]}>
                          {h.dateFormatted}
                        </Text>
                        <Text style={[styles.historyHours, { color: t.colors.textSecondary }]}>
                          {h.checkInTime || '--'} - {h.checkOutTime || '--'}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusPill,
                          h.status === 'PRESENT'
                            ? { backgroundColor: '#DEF7EC' }
                            : h.status === 'LATE'
                            ? { backgroundColor: '#FEF3C7' }
                            : { backgroundColor: '#F3F4F6' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusPillText,
                            h.status === 'PRESENT'
                              ? { color: '#03543F' }
                              : h.status === 'LATE'
                              ? { color: '#92400E' }
                              : { color: '#4B5563' },
                          ]}
                        >
                          {h.status === 'LATE' ? 'Late' : h.status === 'PRESENT' ? 'Present' : 'Not Recorded'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.emptyCard,
                    { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                  ]}
                >
                  <Text style={[styles.emptyText, { color: t.colors.textSecondary }]}>
                    No prior records found for this week.
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ===================== VIEW 2: TEAM ATTENDANCE (Manager / Admin Roster) ===================== */}
        {tabMode === 'team' && (
          <>
            {/* Header */}
            <View style={styles.headerRow}>
              <View>
                <Text style={[styles.subGreeting, { color: t.colors.textSecondary }]}>
                  Live Team Overview
                </Text>
                <Text style={[styles.heading, { color: t.colors.brandNavy }]}>
                  Team Attendance
                </Text>
              </View>

              <View
                style={[
                  styles.datePill,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
              >
                <Calendar size={13} color={t.colors.brandPrimary} />
                <Text style={[styles.dateText, { color: t.colors.textPrimary }]}>
                  {formattedDate}
                </Text>
              </View>
            </View>

            {/* 2x2 Metric Summary Grid */}
            <View style={styles.metricsGrid}>
              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
              >
                <View style={styles.metricHeader}>
                  <View style={[styles.metricDot, { backgroundColor: '#059669' }]} />
                  <Text style={[styles.metricLabel, { color: t.colors.textSecondary }]}>
                    On Duty
                  </Text>
                </View>
                <Text style={[styles.metricNumber, { color: t.colors.textPrimary }]}>
                  {teamMetrics.present}
                </Text>
                <Text style={[styles.metricSub, { color: t.colors.textTertiary }]}>
                  currently clocked in
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
              >
                <View style={styles.metricHeader}>
                  <View style={[styles.metricDot, { backgroundColor: '#3B82F6' }]} />
                  <Text style={[styles.metricLabel, { color: t.colors.textSecondary }]}>
                    Punched Out
                  </Text>
                </View>
                <Text style={[styles.metricNumber, { color: t.colors.textPrimary }]}>
                  {teamMetrics.checkedOut || 0}
                </Text>
                <Text style={[styles.metricSub, { color: t.colors.textTertiary }]}>
                  completed shift today
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
              >
                <View style={styles.metricHeader}>
                  <View style={[styles.metricDot, { backgroundColor: t.colors.brandPrimary }]} />
                  <Text style={[styles.metricLabel, { color: t.colors.textSecondary }]}>
                    Not Clocked In
                  </Text>
                </View>
                <Text style={[styles.metricNumber, { color: t.colors.brandNavy }]}>
                  {teamMetrics.notRecorded}
                </Text>
                <Text style={[styles.metricSub, { color: t.colors.brandPrimary }]}>
                  yet to start duty
                </Text>
              </View>

              <View
                style={[
                  styles.metricCard,
                  { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
                ]}
              >
                <View style={styles.metricHeader}>
                  <View style={[styles.metricDot, { backgroundColor: '#F59E0B' }]} />
                  <Text style={[styles.metricLabel, { color: t.colors.textSecondary }]}>
                    Late Arrivals
                  </Text>
                </View>
                <Text style={[styles.metricNumber, { color: t.colors.textPrimary }]}>
                  {teamMetrics.late}
                </Text>
                <Text style={[styles.metricSub, { color: t.colors.textTertiary }]}>
                  checked in past grace
                </Text>
              </View>
            </View>

            {/* Filter Pills */}
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={[styles.sectionTitle, { color: t.colors.brandNavy }]}>
                    Team Roster ({filteredTeam.length})
                  </Text>
                  <Text style={[styles.sectionSub, { color: t.colors.textTertiary }]}>
                    {activeFilter === 'all'
                      ? `${teamMetrics.total} total members`
                      : `Showing ${filteredTeam.length} of ${teamMetrics.total} members`}
                  </Text>
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterScroll}
              >
                {(
                  [
                    { id: 'all' as const, label: `All (${teamMetrics.total})` },
                    { id: 'present' as const, label: `On Duty (${teamMetrics.present})` },
                    { id: 'checked_out' as const, label: `Punched Out (${teamMetrics.checkedOut})` },
                    { id: 'not_recorded' as const, label: `Not Clocked In (${teamMetrics.notRecorded})` },
                    { id: 'late' as const, label: `Late (${teamMetrics.late})` },
                    ...(teamMetrics.needsReview > 0
                      ? [{ id: 'needs_review' as const, label: `Needs Review (${teamMetrics.needsReview})` }]
                      : []),
                  ]
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
                          isActive ? { color: '#FFFFFF' } : { color: t.colors.textSecondary },
                        ]}
                      >
                        {filter.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Live Employee Roster Cards from PostgreSQL */}
              <View style={styles.rosterList}>
                {filteredTeam.map((emp) => (
                  <EmployeeCard
                    key={emp.id}
                    employee={emp}
                    quickActionLabel={
                      emp.isCheckedIn
                        ? 'Punch out'
                        : emp.attendanceStatus === 'checked_out'
                        ? undefined
                        : 'Check in'
                    }
                    onQuickAction={() =>
                      handleAdminPunchEmployee(
                        emp.id,
                        emp.isCheckedIn ? 'check-out' : 'check-in'
                      )
                    }
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 90,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subGreeting: {
    fontSize: 13,
    fontWeight: '500',
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  shiftChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  digitalClock: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  punchButton: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  punchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  locationStrip: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  refreshBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionBlock: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardList: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  punchSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  sessionBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sessionNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3730A3',
  },
  sessionDetails: {
    flex: 1,
  },
  sessionTimes: {
    fontSize: 13,
    fontWeight: '600',
  },
  sessionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  siteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  siteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  historyLeft: {
    gap: 2,
  },
  historyDay: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyHours: {
    fontSize: 12,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
  },
  metricSub: {
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  rosterList: {
    gap: 10,
    marginTop: 6,
  },
});
