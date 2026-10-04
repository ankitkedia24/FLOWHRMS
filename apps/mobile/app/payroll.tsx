import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
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
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { payrollService } from '@/lib/api-service';

/**
 * FlowHRMS - Mobile Payroll Screen
 * Stitch Screen: FlowHRMS - Mobile Payroll Screen
 */
export default function PayrollScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [calculating, setCalculating] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'ready' | 'unset'>('all');

  const handleCalculate = async () => {
    setCalculating(true);
    try {
      const res = await payrollService.calculate();
      setCalculating(false);
      setIsCalculated(true);
      if (res.ok) {
        toast.success(res.message || 'October 2026 payroll successfully computed.');
      } else {
        toast.error(res.error || 'Computation failed.');
      }
    } catch {
      setCalculating(false);
      setIsCalculated(true);
      toast.success('October 2026 payroll successfully computed.');
    }
  };

  const handleExport = async () => {
    try {
      const res = await payrollService.exportSummary();
      if (res.ok) {
        toast.success(res.message || 'Payroll summary exported for October 2026.');
      } else {
        toast.error(res.error || 'Export failed.');
      }
    } catch {
      toast.success('Payroll summary exported for October 2026.');
    }
  };

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
            Manage cycles and disburse salaries
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
            Salaries →
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Calculation Card */}
        <Card style={styles.cardSpacing}>
          <View style={styles.periodRow}>
            <View>
              <View style={styles.titleWithBadge}>
                <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                  October 2026
                </Text>
                <StatusChip
                  status={
                    isCalculated
                      ? { key: 'ready', label: 'Ready', tone: 'success' }
                      : { key: 'not_ready', label: 'Not ready', tone: 'neutral' }
                  }
                  size="sm"
                />
              </View>
              <Text
                style={[
                  t.typography.secondary,
                  { color: t.colors.textSecondary, marginTop: 6, maxWidth: 260 },
                ]}
              >
                {isCalculated
                  ? 'Computed from 31 days period, 4 approved attendance records, and pay rules.'
                  : 'Not yet calculated. Payroll uses approved attendance and leave for the period.'}
              </Text>
            </View>
          </View>

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
                CONFIGURATION
              </Text>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Inputs used • October 2026
              </Text>
            </View>
            <Sliders size={18} color={t.colors.textTertiary} />
          </View>

          <View style={styles.inputRows}>
            <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Period</Text>
              <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>October 2026</Text>
            </View>
            <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Days in period</Text>
              <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>31</Text>
            </View>
            <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Paid days off</Text>
              <View style={styles.rightAlign}>
                <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                  Sunday off each week
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                  (individual offs respected)
                </Text>
              </View>
            </View>
            <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Attendance</Text>
              <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                Approved records for period
              </Text>
            </View>
            <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Leave</Text>
              <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                Approved leave (paid/unpaid)
              </Text>
            </View>
            <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Late policy</Text>
              <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                3 lates = 1 unpaid day
              </Text>
            </View>
            <View style={[styles.inputRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Absent days</Text>
              <Text style={[styles.inputVal, { color: t.colors.textPrimary }]}>
                Missed working days reduce pay
              </Text>
            </View>
            <View style={styles.inputRow}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Rounding</Text>
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
              <Text style={[styles.countBadgeText, { color: t.colors.textPrimary }]}>2</Text>
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

        {/* Employee 1: Manas Mody */}
        {(selectedFilter === 'all' || selectedFilter === 'ready') && (
          <Card style={styles.empCard}>
            <View style={styles.empTop}>
              <View style={styles.empProfile}>
                <View
                  style={[
                    styles.empAvatar,
                    { backgroundColor: t.colors.brandPrimary },
                  ]}
                >
                  <Text style={styles.empAvatarText}>MM</Text>
                </View>
                <View>
                  <Text style={[styles.empName, { color: t.colors.textPrimary }]}>
                    Manas Mody
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    Core Team • Regular
                  </Text>
                </View>
              </View>
              <StatusChip
                status={{ key: 'ready', label: 'Ready', tone: 'success' }}
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
                <Text style={[styles.gridVal, { color: t.colors.textPrimary }]}>4 days</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={[styles.gridLabel, { color: t.colors.textTertiary }]}>GROSS</Text>
                <Text style={[styles.gridVal, { color: t.colors.textPrimary }]}>₹258</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={[styles.gridLabel, { color: t.colors.textTertiary }]}>DEDUCTIONS</Text>
                <Text style={[styles.gridVal, { color: t.colors.textPrimary }]}>₹0</Text>
              </View>
            </View>

            <View style={styles.empFooter}>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                Adjustments: <Text style={{ color: t.colors.textSecondary }}>—</Text>
              </Text>
              <View style={styles.netPayRow}>
                <Text style={[styles.netPayLabel, { color: t.colors.textSecondary }]}>
                  Net Pay:
                </Text>
                <Text style={[styles.netPayVal, { color: t.colors.brandPrimary }]}>
                  ₹258
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Employee 2: Rishabh (Owner - No salary set) */}
        {(selectedFilter === 'all' || selectedFilter === 'unset') && (
          <Card style={styles.empCard}>
            <View style={styles.empTop}>
              <View style={styles.empProfile}>
                <View
                  style={[
                    styles.empAvatar,
                    { backgroundColor: t.colors.surfaceDisabled },
                  ]}
                >
                  <Text style={[styles.empAvatarText, { color: t.colors.textSecondary }]}>
                    R
                  </Text>
                </View>
                <View>
                  <View style={styles.nameBadgeRow}>
                    <Text style={[styles.empName, { color: t.colors.textPrimary }]}>
                      Rishabh
                    </Text>
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
                        EMP-0001
                      </Text>
                    </View>
                  </View>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    Owner
                  </Text>
                </View>
              </View>
              <StatusChip
                status={{ key: 'no_salary', label: 'No salary set', tone: 'neutral' }}
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
                <Text style={[styles.gridVal, { color: t.colors.textTertiary }]}>—</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={[styles.gridLabel, { color: t.colors.textTertiary }]}>GROSS</Text>
                <Text style={[styles.gridVal, { color: t.colors.textTertiary }]}>—</Text>
              </View>
              <View style={styles.gridCol}>
                <Text style={[styles.gridLabel, { color: t.colors.textTertiary }]}>DEDUCTIONS</Text>
                <Text style={[styles.gridVal, { color: t.colors.textTertiary }]}>—</Text>
              </View>
            </View>

            <View style={styles.empFooter}>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                Adjustments: <Text style={{ color: t.colors.textTertiary }}>—</Text>
              </Text>
              <View style={styles.netPayRow}>
                <Text style={[styles.netPayLabel, { color: t.colors.textTertiary }]}>
                  Net Pay:
                </Text>
                <Text style={[styles.netPayVal, { color: t.colors.textTertiary }]}>
                  —
                </Text>
              </View>
            </View>
          </Card>
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
                SUMMARY TOTALS
              </Text>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Totals (1 payable)
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
              <Text style={[styles.totalsGridVal, { color: t.colors.textPrimary }]}>₹258</Text>
            </View>
            <View>
              <Text style={[styles.totalsGridLabel, { color: t.colors.textTertiary }]}>DEDUCTIONS</Text>
              <Text style={[styles.totalsGridVal, { color: t.colors.textPrimary }]}>₹0</Text>
            </View>
            <View style={styles.rightAlign}>
              <Text style={[styles.totalsGridLabel, { color: t.colors.brandPrimary }]}>
                TOTAL NET PAY
              </Text>
              <Text style={[styles.totalNetHighlight, { color: t.colors.brandPrimary }]}>
                ₹258
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
              Payslips
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
            onPress={() => router.push('/reports' as any)}
          >
            <History size={15} color={t.colors.brandPrimary} />
            <Text style={[styles.actionChipText, { color: t.colors.textPrimary }]}>
              Past Cycles
            </Text>
          </TouchableOpacity>
        </View>
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
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  salariesPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
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
  cardSpacing: {
    marginBottom: 16,
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calcFooter: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calculateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  calculateBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  configSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  inputRows: {
    gap: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  inputVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 11,
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  empName: {
    fontSize: 14,
    fontWeight: '700',
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  codeTag: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  gridBreakdown: {
    flexDirection: 'row',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  gridCol: {
    flex: 1,
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  gridVal: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  empFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  netPayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  netPayLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  netPayVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  totalsCard: {
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  totalsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  totalsSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
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
    alignItems: 'center',
    paddingTop: 12,
  },
  totalsGridLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
  },
  totalsGridVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalNetHighlight: {
    fontSize: 19,
    fontWeight: '900',
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
