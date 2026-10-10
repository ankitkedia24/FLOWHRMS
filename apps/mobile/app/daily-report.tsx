import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Share2,
  Users,
  Clock,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Sparkles,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { reportsService } from '@/lib/api-service';
import { useAuth } from '@/lib/auth-context';

interface RosterMember {
  id: string;
  name: string;
  email: string;
  employeeCode: string;
  role: string;
  department: string | null;
  designation: string | null;
  status: 'PRESENT' | 'CHECKED_OUT' | 'LATE' | 'ABSENT';
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number;
  needsReview: boolean;
}

interface DailyPulseData {
  date: string;
  formattedDate: string;
  totalEmployees: number;
  presentCount: number;
  presentRate: number;
  lateCount: number;
  exceptionsCount: number;
  leaveCount: number;
  tasksCompleted: number;
  tasksOpen: number;
  roster: RosterMember[];
}

export default function DailyReportScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [dateOffset, setDateOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportData, setReportData] = useState<DailyPulseData | null>(null);

  // Compute ISO date (YYYY-MM-DD) based on offset
  const getTargetDateIso = useCallback((offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }, []);

  const fetchDailyPulse = useCallback(
    async (isPull = false) => {
      if (isPull) setRefreshing(true);
      else setLoading(true);

      try {
        const dateStr = getTargetDateIso(dateOffset);
        const data = await reportsService.getDailyPulse(dateStr);
        if (data) {
          setReportData(data);
        }
      } catch (err: unknown) {
        toast.error('Network Error', 'Could not refresh daily operations pulse.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateOffset, getTargetDateIso, toast]
  );

  useEffect(() => {
    fetchDailyPulse();
  }, [fetchDailyPulse]);

  const handleShare = async () => {
    if (!reportData) return;

    const workspaceName = user?.tenant?.name || 'FlowHRMS';
    const summaryText = [
      `📊 *${workspaceName} — Daily Operations Digest*`,
      `📅 Date: ${reportData.formattedDate}`,
      '',
      `👥 Headcount: ${reportData.presentCount} of ${reportData.totalEmployees} Present (${reportData.presentRate}%)`,
      `⏰ Late Arrivals: ${reportData.lateCount}`,
      `⚠️ Exceptions & Flags: ${reportData.exceptionsCount}`,
      `🏖️ Leaves Awaiting Action: ${reportData.leaveCount}`,
      `📋 Tasks: ${reportData.tasksCompleted} Completed · ${reportData.tasksOpen} In Progress`,
      '',
      `Generated via FlowHRMS Mobile Enterprise`,
    ].join('\n');

    try {
      await reportsService.shareDailyPulse();
      await Share.share({ message: summaryText });
    } catch {
      toast.info('Digest ready to share.');
    }
  };

  const isToday = dateOffset === 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}
      edges={['top', 'left', 'right']}
    >
      {/* 1. Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderBottomColor: t.colors.borderDefault,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={t.colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Daily Operations Digest
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.colors.textSecondary }]}>
            Live Workforce Snapshot
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <View style={styles.liveBadge}>
            <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.liveText, { color: '#059669' }]}>Live</Text>
          </View>

          <TouchableOpacity
            onPress={handleShare}
            style={[styles.headerShareBtn, { backgroundColor: t.colors.surfaceSunken }]}
            activeOpacity={0.7}
            accessibilityLabel="Share digest"
          >
            <Share2 size={16} color={t.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDailyPulse(true)}
            colors={[t.colors.brandPrimary]}
            tintColor={t.colors.brandPrimary}
          />
        }
      >
        {/* 2. Interactive Date Navigation Bar */}
        <View
          style={[
            styles.dateBar,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.borderDefault,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setDateOffset(dateOffset - 1)}
            style={styles.dateNavBtn}
            activeOpacity={0.7}
            accessibilityLabel="Previous day"
          >
            <ChevronLeft size={18} color={t.colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.dateCenter}>
            <Calendar size={15} color={t.colors.brandPrimary} />
            <Text style={[styles.dateText, { color: t.colors.textPrimary }]}>
              {reportData?.formattedDate || 'Loading date...'}
            </Text>
            {isToday ? (
              <View style={[styles.todayTag, { backgroundColor: t.colors.brandPrimarySubtle }]}>
                <Text style={[styles.todayTagText, { color: t.colors.brandPrimary }]}>
                  Today
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setDateOffset(0)}
                style={[styles.jumpTodayBtn, { backgroundColor: t.colors.surfaceSunken }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.jumpTodayText, { color: t.colors.textSecondary }]}>
                  Reset to Today
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => setDateOffset(dateOffset + 1)}
            style={styles.dateNavBtn}
            activeOpacity={0.7}
            accessibilityLabel="Next day"
          >
            <ChevronRight size={18} color={t.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={t.colors.brandPrimary} />
            <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>
              Loading live snapshot...
            </Text>
          </View>
        ) : (
          <>
            {/* 3. Executive KPI Metric Grid (2x2) */}
            <View style={styles.kpiGrid}>
              {/* Metric 1: Present Headcount */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <View style={styles.kpiCardTop}>
                  <View style={[styles.kpiIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <Users size={16} color="#4F46E5" />
                  </View>
                  <View style={[styles.kpiRatePill, { backgroundColor: '#ECFDF5' }]}>
                    <Text style={[styles.kpiRateText, { color: '#059669' }]}>
                      {reportData?.presentRate ?? 0}% Rate
                    </Text>
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: t.colors.textPrimary }]}>
                  {reportData?.presentCount ?? 0}
                  <Text style={[styles.kpiTotalSub, { color: t.colors.textTertiary }]}>
                    {' '}
                    / {reportData?.totalEmployees ?? 0}
                  </Text>
                </Text>
                <Text style={[styles.kpiLabel, { color: t.colors.textSecondary }]}>
                  Present On Duty
                </Text>
              </View>

              {/* Metric 2: Late Arrivals */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <View style={styles.kpiCardTop}>
                  <View
                    style={[
                      styles.kpiIconBox,
                      {
                        backgroundColor:
                          (reportData?.lateCount ?? 0) > 0 ? '#FEF2F2' : '#F0FDF4',
                      },
                    ]}
                  >
                    <Clock
                      size={16}
                      color={(reportData?.lateCount ?? 0) > 0 ? '#DC2626' : '#16A34A'}
                    />
                  </View>
                </View>
                <Text
                  style={[
                    styles.kpiValue,
                    {
                      color:
                        (reportData?.lateCount ?? 0) > 0 ? '#DC2626' : t.colors.textPrimary,
                    },
                  ]}
                >
                  {reportData?.lateCount ?? 0}
                </Text>
                <Text style={[styles.kpiLabel, { color: t.colors.textSecondary }]}>
                  Late Arrivals
                </Text>
              </View>

              {/* Metric 3: Exceptions / Punches to Review */}
              <View
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <View style={styles.kpiCardTop}>
                  <View
                    style={[
                      styles.kpiIconBox,
                      {
                        backgroundColor:
                          (reportData?.exceptionsCount ?? 0) > 0 ? '#FFFBEB' : '#F8FAFC',
                      },
                    ]}
                  >
                    <AlertCircle
                      size={16}
                      color={(reportData?.exceptionsCount ?? 0) > 0 ? '#D97706' : '#64748B'}
                    />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: t.colors.textPrimary }]}>
                  {reportData?.exceptionsCount ?? 0}
                </Text>
                <Text style={[styles.kpiLabel, { color: t.colors.textSecondary }]}>
                  Exceptions Flagged
                </Text>
              </View>

              {/* Metric 4: Leaves Awaiting Approval */}
              <TouchableOpacity
                style={[
                  styles.kpiCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => router.push('/(tabs)/leave' as any)}
                activeOpacity={0.7}
              >
                <View style={styles.kpiCardTop}>
                  <View style={[styles.kpiIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <CalendarDays size={16} color="#7C3AED" />
                  </View>
                </View>
                <Text style={[styles.kpiValue, { color: t.colors.textPrimary }]}>
                  {reportData?.leaveCount ?? 0}
                </Text>
                <Text style={[styles.kpiLabel, { color: t.colors.textSecondary }]}>
                  Pending Leaves
                </Text>
              </TouchableOpacity>
            </View>

            {/* 4. Live Team Attendance Roster */}
            <View style={styles.rosterSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: t.colors.textPrimary }]}>
                  Team Attendance Roster
                </Text>
                <View
                  style={[
                    styles.rosterCountBadge,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <Text style={[styles.rosterCountText, { color: t.colors.textSecondary }]}>
                    {reportData?.roster.length ?? 0} Members
                  </Text>
                </View>
              </View>

              <Card
                style={[
                  styles.rosterCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                {reportData?.roster.map((member, idx) => {
                  const isLast = idx === (reportData?.roster.length ?? 0) - 1;
                  const initials = member.name
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  let statusBg = t.colors.surfaceSunken;
                  let statusFg = t.colors.textSecondary;
                  let statusLabel = 'ABSENT';

                  if (member.status === 'PRESENT') {
                    statusBg = '#ECFDF5';
                    statusFg = '#059669';
                    statusLabel = 'PRESENT';
                  } else if (member.status === 'CHECKED_OUT') {
                    statusBg = '#EFF6FF';
                    statusFg = '#2563EB';
                    statusLabel = 'CHECKED OUT';
                  } else if (member.status === 'LATE') {
                    statusBg = '#FEF2F2';
                    statusFg = '#DC2626';
                    statusLabel = `LATE (${member.lateMinutes}m)`;
                  }

                  return (
                    <View
                      key={member.id}
                      style={[
                        styles.rosterRow,
                        !isLast && {
                          borderBottomWidth: 1,
                          borderBottomColor: t.colors.borderSubtle,
                        },
                      ]}
                    >
                      {/* Initials Avatar */}
                      <View
                        style={[
                          styles.rosterAvatar,
                          {
                            backgroundColor:
                              member.status === 'PRESENT'
                                ? '#EEF2FF'
                                : t.colors.surfaceSunken,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.rosterAvatarLetters,
                            {
                              color:
                                member.status === 'PRESENT'
                                  ? t.colors.brandPrimary
                                  : t.colors.textSecondary,
                            },
                          ]}
                        >
                          {initials}
                        </Text>
                      </View>

                      {/* Member Info */}
                      <View style={styles.rosterInfo}>
                        <View style={styles.rosterNameRow}>
                          <Text
                            style={[styles.rosterName, { color: t.colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {member.name}
                          </Text>
                          <View
                            style={[
                              styles.rosterRolePill,
                              { backgroundColor: t.colors.surfaceSunken },
                            ]}
                          >
                            <Text
                              style={[
                                styles.rosterRoleText,
                                { color: t.colors.textSecondary },
                              ]}
                            >
                              {member.role}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[styles.rosterCodeSub, { color: t.colors.textTertiary }]}
                        >
                          {member.employeeCode}
                          {member.checkInTime ? ` • In: ${member.checkInTime}` : ' • Not In Yet'}
                        </Text>
                      </View>

                      {/* Status Chip */}
                      <View style={[styles.rosterStatusChip, { backgroundColor: statusBg }]}>
                        <Text style={[styles.rosterStatusText, { color: statusFg }]}>
                          {statusLabel}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </Card>
            </View>

            {/* 5. Tasks & Shift Workload Card */}
            <TouchableOpacity
              style={[
                styles.taskCard,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.borderDefault,
                },
              ]}
              onPress={() => router.push('/(tabs)/tasks' as any)}
              activeOpacity={0.8}
            >
              <View style={styles.taskCardLeft}>
                <View style={[styles.taskIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <CheckSquare size={18} color="#16A34A" />
                </View>
                <View>
                  <Text style={[styles.taskCardTitle, { color: t.colors.textPrimary }]}>
                    Tasks & Operations
                  </Text>
                  <Text style={[styles.taskCardSubtitle, { color: t.colors.textSecondary }]}>
                    {reportData?.tasksCompleted ?? 0} Completed • {reportData?.tasksOpen ?? 0}{' '}
                    In Progress
                  </Text>
                </View>
              </View>

              <View style={[styles.viewTasksBtn, { backgroundColor: t.colors.surfaceSunken }]}>
                <Text style={[styles.viewTasksText, { color: t.colors.brandPrimary }]}>
                  View Tasks
                </Text>
              </View>
            </TouchableOpacity>

            {/* 6. Primary Action: Share Daily Pulse */}
            <TouchableOpacity
              style={[styles.shareActionBtn, { backgroundColor: t.colors.brandPrimary }]}
              onPress={handleShare}
              activeOpacity={0.85}
            >
              <Share2 size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.shareActionBtnText}>Share Daily Digest</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerShareBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  dateNavBtn: {
    padding: 6,
    borderRadius: 8,
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  todayTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  todayTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  jumpTodayBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  jumpTodayText: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48.4%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  kpiCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kpiIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiRatePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  kpiRateText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 6,
  },
  kpiTotalSub: {
    fontSize: 14,
    fontWeight: '600',
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  rosterSection: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  rosterCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  rosterCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
  rosterCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
  },
  rosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rosterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rosterAvatarLetters: {
    fontSize: 12,
    fontWeight: '800',
  },
  rosterInfo: {
    flex: 1,
    marginRight: 8,
  },
  rosterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rosterName: {
    fontSize: 13,
    fontWeight: '700',
  },
  rosterRolePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  rosterRoleText: {
    fontSize: 9,
    fontWeight: '600',
  },
  rosterCodeSub: {
    fontSize: 11,
    marginTop: 1.5,
  },
  rosterStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rosterStatusText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  taskCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  taskIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCardTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  taskCardSubtitle: {
    fontSize: 11,
    marginTop: 1.5,
  },
  viewTasksBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewTasksText: {
    fontSize: 11,
    fontWeight: '700',
  },
  shareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: 'rgba(79, 70, 229, 0.25)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  shareActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
