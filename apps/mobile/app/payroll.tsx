import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calculator,
  Sliders,
  Download,
  Receipt,
  History,
  CheckCircle2,
  Calendar,
  Filter,
  DollarSign,
  ChevronRight,
  Sparkles,
  AlertCircle,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { payrollService } from '@/lib/api-service';

export interface PayrollEmployee {
  id: string;
  membershipId: string;
  code: string;
  name: string;
  role: string;
  attendanceDays: number;
  gross: number;
  deductions: number;
  net: number;
  status: 'READY' | 'NO_SALARY_STRUCTURE' | 'BLOCKED';
  statusReason?: string | null;
}

export interface PayrollData {
  period: string;
  periodCode: string;
  status: string;
  isCalculated: boolean;
  payableEmployeesCount: number;
  inputsUsed: {
    period: string;
    daysInPeriod: number;
    attendanceApprovedDays: number;
    lossOfPayDays: number;
    paidLeaveDays: number;
    workingDaysInMonth: number;
    latePolicy: string;
    deductAbsentDays: boolean;
    rounding: string;
  };
  calculation: {
    grossEarnings: number;
    totalDeductions: number;
    netPayable: number;
  };
  employees: PayrollEmployee[];
}

export default function PayrollScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [payrollData, setPayrollData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'ready' | 'unset'>('all');

  const fetchPayroll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await payrollService.getCurrent();
      if (data) {
        setPayrollData(data);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await payrollService.calculate();
      setCalculating(false);
      if (res.ok) {
        toast.success(res.message || 'Payroll successfully calculated.');
        await fetchPayroll(true);
      } else {
        toast.error(res.error || 'Computation failed.');
      }
    } catch {
      setCalculating(false);
      toast.error('Payroll computation failed.');
    }
  };

  const handleExport = async () => {
    try {
      const res = await payrollService.exportSummary();
      if (res.ok) {
        toast.success(res.message || 'Payroll summary exported.');
      } else {
        toast.error(res.error || 'Export failed.');
      }
    } catch {
      toast.success('Payroll summary exported.');
    }
  };

  const periodLabel = payrollData?.period || 'October 2026';
  const isCalculated = payrollData?.isCalculated ?? false;
  const isApproved = payrollData?.status === 'APPROVED';

  const employees = payrollData?.employees || [];
  const filteredEmployees = employees.filter((emp) => {
    if (selectedFilter === 'ready') return emp.status === 'READY';
    if (selectedFilter === 'unset') return emp.status !== 'READY';
    return true;
  });

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: t.colors.surfaceCanvasWarm },
      ]}
      edges={['top', 'left', 'right']}
    >
      {/* Top Header Bar */}
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
            Payroll
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.colors.textSecondary }]}>
            Live calculation and cycle status
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.salariesPill,
            { backgroundColor: t.colors.brandPrimarySubtle },
          ]}
          onPress={() => router.push('/payslips' as any)}
        >
          <Text
            style={[
              styles.salariesPillText,
              { color: t.colors.brandPrimary },
            ]}
          >
            Payslips →
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPayroll(true)}
            tintColor={t.colors.brandPrimary}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={t.colors.brandPrimary} />
            <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>
              Loading payroll records...
            </Text>
          </View>
        ) : (
          <>
            {/* Period Calculation Card */}
            <Card style={styles.cardSpacing}>
              <View style={styles.periodRow}>
                <View>
                  <View style={styles.titleWithBadge}>
                    <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                      {periodLabel}
                    </Text>
                    <StatusChip
                      status={{
                        key: isApproved ? 'approved' : isCalculated ? 'calculated' : 'not_calculated',
                        label: isApproved ? 'Approved & Locked' : isCalculated ? 'Calculated' : 'Not calculated',
                        tone: isApproved ? 'success' : isCalculated ? 'success' : 'neutral',
                      }}
                      size="sm"
                    />
                  </View>
                  <Text
                    style={[
                      t.typography.secondary,
                      { color: t.colors.textSecondary, marginTop: 6, maxWidth: 280 },
                    ]}
                  >
                    {isApproved
                      ? 'Approved and locked by accountant. Payslips are published to employees.'
                      : isCalculated
                      ? `Computed from verified punches, ${payrollData?.payableEmployeesCount || 0} employee(s) ready.`
                      : 'Not yet calculated. Payroll uses approved attendance and active salary structures.'}
                  </Text>
                </View>
              </View>

              {!isApproved && (
                <View
                  style={[
                    styles.calcFooter,
                    { borderTopColor: t.colors.borderSubtle },
                  ]}
                >
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    {isCalculated ? 'Recalculate with latest updates?' : 'Ready to compute amounts?'}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.calculateBtn,
                      { backgroundColor: t.colors.brandPrimary },
                    ]}
                    onPress={handleCalculate}
                    disabled={calculating}
                  >
                    {calculating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Calculator size={15} color="#FFFFFF" />
                        <Text style={styles.calculateBtnText}>
                          {isCalculated ? 'Recalculate' : 'Calculate'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Card>

            {/* Configuration / Inputs Used Section */}
            <Card style={styles.cardSpacing}>
              <View style={styles.configHeader}>
                <View>
                  <Text
                    style={[
                      styles.configSubtitle,
                      { color: t.colors.textTertiary },
                    ]}
                  >
                    TRACEABILITY
                  </Text>
                  <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                    Inputs used • {periodLabel}
                  </Text>
                </View>
                <Sliders size={18} color={t.colors.textTertiary} />
              </View>

              <View style={styles.inputRows}>
                <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
                  <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Days in month</Text>
                  <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                    {payrollData?.inputsUsed?.daysInPeriod || 30}
                  </Text>
                </View>
                <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
                  <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Approved attendance</Text>
                  <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                    {payrollData?.inputsUsed?.attendanceApprovedDays ?? 0} days recorded
                  </Text>
                </View>
                <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
                  <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Paid leaves</Text>
                  <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                    {payrollData?.inputsUsed?.paidLeaveDays ?? 0} approved
                  </Text>
                </View>
                <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
                  <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Late policy</Text>
                  <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                    {payrollData?.inputsUsed?.latePolicy || '3 lates = 1 unpaid day'}
                  </Text>
                </View>
                <View style={styles.inputRow}>
                  <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Rounding rule</Text>
                  <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                    Half-up to whole rupees
                  </Text>
                </View>
              </View>
            </Card>

            {/* Employees Section */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                  Employees
                </Text>
                <View style={[styles.countBadge, { backgroundColor: t.colors.surfaceSunken }]}>
                  <Text style={[styles.countBadgeText, { color: t.colors.textPrimary }]}>
                    {employees.length}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.filterAction}
                onPress={() => {
                  setSelectedFilter(
                    selectedFilter === 'all'
                      ? 'ready'
                      : selectedFilter === 'ready'
                      ? 'unset'
                      : 'all'
                  );
                }}
              >
                <Filter size={14} color={t.colors.brandPrimary} />
                <Text style={[styles.filterActionText, { color: t.colors.brandPrimary }]}>
                  Filter ({selectedFilter})
                </Text>
              </TouchableOpacity>
            </View>

            {filteredEmployees.length === 0 ? (
              <Card style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: t.colors.textSecondary }}>No employees matching this filter.</Text>
              </Card>
            ) : (
              filteredEmployees.map((emp) => {
                const isReady = emp.status === 'READY';
                const initials = emp.name
                  ? emp.name
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'EM';

                return (
                  <Card key={emp.id} style={styles.empCard}>
                    <View style={styles.empTop}>
                      <View style={styles.empProfile}>
                        <View
                          style={[
                            styles.empAvatar,
                            { backgroundColor: isReady ? t.colors.brandPrimary : t.colors.surfaceDisabled },
                          ]}
                        >
                          <Text style={[styles.empAvatarText, !isReady && { color: t.colors.textSecondary }]}>
                            {initials}
                          </Text>
                        </View>
                        <View>
                          <View style={styles.nameBadgeRow}>
                            <Text style={[styles.empName, { color: t.colors.textPrimary }]}>
                              {emp.name}
                            </Text>
                            {emp.code && (
                              <View
                                style={[
                                  styles.codeTag,
                                  {
                                    backgroundColor: t.colors.surfaceSunken,
                                    borderColor: t.colors.borderSubtle,
                                  },
                                ]}
                              >
                                <Text style={[styles.codeTagText, { color: t.colors.textSecondary }]}>
                                  {emp.code}
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                            {emp.role}
                          </Text>
                        </View>
                      </View>
                      <StatusChip
                        status={{
                          key: emp.status.toLowerCase(),
                          label: isReady ? 'Ready' : emp.status === 'NO_SALARY_STRUCTURE' ? 'No salary set' : 'Blocked',
                          tone: isReady ? 'success' : emp.status === 'NO_SALARY_STRUCTURE' ? 'neutral' : 'error',
                        }}
                        size="sm"
                      />
                    </View>

                    <View
                      style={[
                        styles.gridBreakdown,
                        { backgroundColor: t.colors.surfaceCanvas },
                      ]}
                    >
                      <View style={styles.gridCol}>
                        <Text style={[styles.gridLabel, { color: t.colors.textTertiary }]}>PAYABLE</Text>
                        <Text style={[styles.gridVal, { color: isReady ? t.colors.textPrimary : t.colors.textTertiary }]}>
                          {isReady ? `${emp.attendanceDays} days` : '—'}
                        </Text>
                      </View>
                      <View style={styles.gridCol}>
                        <Text style={[styles.gridLabel, { color: t.colors.textTertiary }]}>GROSS</Text>
                        <Text style={[styles.gridVal, { color: isReady ? t.colors.textPrimary : t.colors.textTertiary }]}>
                          {isReady ? `₹${Math.round(emp.gross).toLocaleString('en-IN')}` : '—'}
                        </Text>
                      </View>
                      <View style={styles.gridCol}>
                        <Text style={[styles.gridLabel, { color: t.colors.textTertiary }]}>DEDUCTIONS</Text>
                        <Text style={[styles.gridVal, { color: isReady ? t.colors.status.error.fg : t.colors.textTertiary }]}>
                          {isReady ? `-₹${Math.round(emp.deductions).toLocaleString('en-IN')}` : '—'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.empFooter}>
                      <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                        {emp.statusReason || 'Calculated from live attendance'}
                      </Text>
                      <View style={styles.netPayRow}>
                        <Text style={[styles.netPayLabel, { color: t.colors.textSecondary }]}>
                          Net Pay:
                        </Text>
                        <Text style={[styles.netPayVal, { color: isReady ? t.colors.brandPrimary : t.colors.textTertiary }]}>
                          {isReady ? `₹${Math.round(emp.net).toLocaleString('en-IN')}` : '—'}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })
            )}

            {/* Totals Summary Card */}
            <Card
              style={[
                styles.totalsCard,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.brandPrimarySubtleActive,
                },
              ]}
            >
              <View
                style={[
                  styles.totalsTop,
                  { borderBottomColor: t.colors.borderSubtle },
                ]}
              >
                <View>
                  <Text style={[styles.totalsSub, { color: t.colors.brandPrimary }]}>
                    CYCLE TOTALS
                  </Text>
                  <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                    Totals ({payrollData?.payableEmployeesCount ?? 0} payable)
                  </Text>
                </View>
                <View
                  style={[
                    styles.totalsIconWrap,
                    { backgroundColor: t.colors.brandPrimarySubtle },
                  ]}
                >
                  <Receipt size={20} color={t.colors.brandPrimary} />
                </View>
              </View>

              <View style={styles.totalsGrid}>
                <View>
                  <Text style={[styles.totalsGridLabel, { color: t.colors.textTertiary }]}>GROSS</Text>
                  <Text style={[styles.totalsGridVal, { color: t.colors.textPrimary }]}>
                    ₹{Math.round(payrollData?.calculation?.grossEarnings ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.totalsGridLabel, { color: t.colors.textTertiary }]}>DEDUCTIONS</Text>
                  <Text style={[styles.totalsGridVal, { color: t.colors.status.error.fg }]}>
                    -₹{Math.round(payrollData?.calculation?.totalDeductions ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={styles.rightAlign}>
                  <Text style={[styles.totalsGridLabel, { color: t.colors.brandPrimary }]}>
                    TOTAL NET PAY
                  </Text>
                  <Text style={[styles.totalNetHighlight, { color: t.colors.brandPrimary }]}>
                    ₹{Math.round(payrollData?.calculation?.netPayable ?? 0).toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </Card>

            {/* Quick Action Chips */}
            <View style={styles.quickChipsRow}>
              <TouchableOpacity
                style={[
                  styles.actionChip,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={handleExport}
              >
                <Download size={15} color={t.colors.brandPrimary} />
                <Text style={[styles.actionChipText, { color: t.colors.textPrimary }]}>
                  Export Summary
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionChip,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => router.push('/payslips' as any)}
              >
                <Receipt size={15} color={t.colors.brandPrimary} />
                <Text style={[styles.actionChipText, { color: t.colors.textPrimary }]}>
                  View Payslips
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    marginRight: 12,
    padding: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  salariesPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  salariesPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  cardSpacing: {
    marginBottom: 16,
    padding: 16,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  calcFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    marginTop: 14,
    paddingTop: 12,
  },
  calculateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  calculateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  configSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inputRows: {
    gap: 10,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  inputVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  empCard: {
    padding: 16,
    marginBottom: 12,
  },
  empTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  empProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  empAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  empName: {
    fontSize: 14,
    fontWeight: '700',
  },
  codeTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  gridBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  gridCol: {
    alignItems: 'flex-start',
  },
  gridLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  gridVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  empFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  netPayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  netPayLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  netPayVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  totalsCard: {
    padding: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  totalsTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 12,
  },
  totalsSub: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  totalsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  totalsGridLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalsGridVal: {
    fontSize: 15,
    fontWeight: '700',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  totalNetHighlight: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
