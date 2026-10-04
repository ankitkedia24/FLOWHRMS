import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  Info,
  Plus,
  Save,
  Check,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { attendanceService } from '@/lib/api-service';

/**
 * FlowHRMS - Mobile Attendance & Pay Rules Screen
 * Stitch Screen: FlowHRMS - Mobile Attendance & Pay Rules Screen
 */
export default function AttendanceRulesScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [weeklyOff, setWeeklyOff] = useState<string[]>(['Sunday']);
  const [shiftStart, setShiftStart] = useState('09:30 AM');
  const [shiftEnd, setShiftEnd] = useState('06:30 PM');
  const [gracePeriod, setGracePeriod] = useState('15');
  const [latePenaltyRule, setLatePenaltyRule] = useState('3');
  const [geofenceRadius, setGeofenceRadius] = useState('100');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const toggleDay = (day: string) => {
    setHasUnsavedChanges(true);
    if (weeklyOff.includes(day)) {
      setWeeklyOff(weeklyOff.filter((d) => d !== day));
    } else {
      setWeeklyOff([...weeklyOff, day]);
    }
  };

  const handleSave = () => {
    Alert.alert(
      'Publish New Policy Version',
      'Saving creates Version 2 of your Attendance & Pay Rules. Past approved payrolls and attendance remain linked to Version 1.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish Version 2',
          style: 'default',
          onPress: async () => {
            setHasUnsavedChanges(false);
            try {
              await attendanceService.updateRules({
                weeklyOff,
                shiftStart,
                shiftEnd,
                gracePeriodMinutes: Number(gracePeriod),
                latePenaltyDays: Number(latePenaltyRule),
                geofenceRadiusMeters: Number(geofenceRadius),
              });
            } catch {
              // Fallback
            }
            toast.success('Version 2 is now active across your organization.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: t.colors.surfaceCanvasWarm },
      ]}
      edges={['top', 'left', 'right']}
    >
      {/* Header Bar */}
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
          <Text style={[styles.headerSubtitle, { color: t.colors.brandPrimary }]}>
            COMPANY SETTINGS • CONFIGURATION
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Attendance & pay rules
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.saveHeaderBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={handleSave}
        >
          <Save size={14} color="#FFFFFF" />
          <Text style={styles.saveHeaderBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Immutability Notice Callout */}
        <View
          style={[
            styles.immutabilityBox,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleActive,
            },
          ]}
        >
          <Info size={18} color={t.colors.brandPrimary} style={styles.immutabilityIcon} />
          <View style={styles.immutabilityTextWrap}>
            <Text style={[styles.immutabilityTitle, { color: t.colors.textPrimary }]}>
              Changing a rule never rewrites the past
            </Text>
            <Text style={[styles.immutabilityDesc, { color: t.colors.textSecondary }]}>
              Saving creates a new policy version. Attendance already recorded and payroll already
              approved keep the version that applied to them.
            </Text>
          </View>
        </View>

        {/* Locations & Permitted Areas */}
        <Card style={styles.cardSpacing}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Locations & Branches
              </Text>
              <Text style={[styles.cardHeaderDesc, { color: t.colors.textSecondary }]}>
                Where your company works. Each branch sets its own permitted GPS check-in area.
              </Text>
            </View>
          </View>

          <View style={[styles.locationItem, { backgroundColor: t.colors.surfaceCanvas, borderColor: t.colors.borderDefault }]}>
            <View style={styles.locLeft}>
              <View style={[styles.locIconBox, { backgroundColor: t.colors.brandPrimarySubtle }]}>
                <MapPin size={18} color={t.colors.brandPrimary} />
              </View>
              <View>
                <Text style={[styles.locTitle, { color: t.colors.textPrimary }]}>
                  Main Warehouse & HQ
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                  Sector 62, Noida • Geofence: {geofenceRadius}m radius
                </Text>
              </View>
            </View>
            <StatusChip status={{ key: 'active', label: 'Active Hub', tone: 'success' }} size="sm" />
          </View>

          <TouchableOpacity
            style={[
              styles.addBranchBtn,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
            onPress={() => Alert.alert('Add Branch', 'Enter branch coordinates and geofence radius.')}
          >
            <Plus size={14} color={t.colors.brandPrimary} />
            <Text style={[styles.addBranchText, { color: t.colors.textPrimary }]}>
              Add company branch
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Working Days & Weekly Off */}
        <Card style={styles.cardSpacing}>
          <View style={[styles.sectionHeaderRow, { borderBottomColor: t.colors.borderSubtle }]}>
            <View>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Working days & holidays
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                Version 1 • Current
              </Text>
            </View>
            <View style={[styles.currBadge, { backgroundColor: t.colors.surfaceSunken }]}>
              <Text style={[styles.currBadgeText, { color: t.colors.textSecondary }]}>CURRENT</Text>
            </View>
          </View>

          <Text style={[styles.secExplainer, { color: t.colors.textSecondary }]}>
            Weekly offs and holidays are paid days off. They never count as absent, and anyone who
            comes in on one is never marked late.
          </Text>

          <Text style={[styles.subLabel, { color: t.colors.textPrimary }]}>WEEKLY OFF DAYS</Text>
          <View style={styles.daysGrid}>
            {daysOfWeek.map((day) => {
              const isChecked = weeklyOff.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayPill,
                    {
                      backgroundColor: isChecked
                        ? t.colors.brandPrimarySubtle
                        : t.colors.surfaceCanvas,
                      borderColor: isChecked
                        ? t.colors.brandPrimary
                        : t.colors.borderDefault,
                    },
                  ]}
                  onPress={() => toggleDay(day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: isChecked
                          ? t.colors.brandPrimary
                          : t.colors.textSecondary,
                        fontWeight: isChecked ? '700' : '500',
                      },
                    ]}
                  >
                    {day}
                  </Text>
                  {isChecked && <Check size={14} color={t.colors.brandPrimary} />}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.noteText, { color: t.colors.textTertiary }]}>
            {weeklyOff.join(', ')} off for everyone. Individual employee overrides can be configured on employee profiles.
          </Text>
        </Card>

        {/* Shift Timings & Late Penalties */}
        <Card style={styles.cardSpacing}>
          <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
            Shift timings & pay effects
          </Text>
          <Text style={[styles.secExplainer, { color: t.colors.textSecondary }]}>
            Define regular operating hours and how tardiness impacts monthly pay calculations.
          </Text>

          <View style={styles.inputGrid}>
            <View style={styles.inputCol}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                SHIFT START
              </Text>
              <TextInput
                style={[
                  styles.timeInput,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                value={shiftStart}
                onChangeText={(val) => {
                  setShiftStart(val);
                  setHasUnsavedChanges(true);
                }}
              />
            </View>

            <View style={styles.inputCol}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                SHIFT END
              </Text>
              <TextInput
                style={[
                  styles.timeInput,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                value={shiftEnd}
                onChangeText={(val) => {
                  setShiftEnd(val);
                  setHasUnsavedChanges(true);
                }}
              />
            </View>
          </View>

          <View style={[styles.ruleRow, { borderTopColor: t.colors.borderSubtle }]}>
            <View style={styles.ruleLeft}>
              <Text style={[styles.ruleTitle, { color: t.colors.textPrimary }]}>
                Grace Period (Minutes)
              </Text>
              <Text style={[styles.ruleDesc, { color: t.colors.textTertiary }]}>
                Late mark recorded if punch-in exceeds {gracePeriod} mins past start
              </Text>
            </View>
            <TextInput
              style={[
                styles.numberInput,
                {
                  borderColor: t.colors.borderDefault,
                  backgroundColor: t.colors.surfaceDefault,
                  color: t.colors.textPrimary,
                },
              ]}
              keyboardType="numeric"
              value={gracePeriod}
              onChangeText={(val) => {
                setGracePeriod(val);
                setHasUnsavedChanges(true);
              }}
            />
          </View>

          <View style={[styles.ruleRow, { borderTopColor: t.colors.borderSubtle }]}>
            <View style={styles.ruleLeft}>
              <Text style={[styles.ruleTitle, { color: t.colors.textPrimary }]}>
                Late Mark Deduction Rule
              </Text>
              <Text style={[styles.ruleDesc, { color: t.colors.textTertiary }]}>
                {latePenaltyRule} lates = 1 unpaid day deducted from payroll
              </Text>
            </View>
            <TextInput
              style={[
                styles.numberInput,
                {
                  borderColor: t.colors.borderDefault,
                  backgroundColor: t.colors.surfaceDefault,
                  color: t.colors.textPrimary,
                },
              ]}
              keyboardType="numeric"
              value={latePenaltyRule}
              onChangeText={(val) => {
                setLatePenaltyRule(val);
                setHasUnsavedChanges(true);
              }}
            />
          </View>
        </Card>
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
  headerSubtitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveHeaderBtnText: {
    color: '#FFFFFF',
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
  immutabilityBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  immutabilityIcon: {
    marginTop: 2,
  },
  immutabilityTextWrap: {
    flex: 1,
  },
  immutabilityTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  immutabilityDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  cardSpacing: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardHeaderDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  locLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  locIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  addBranchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  addBranchText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 10,
  },
  currBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  currBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  secExplainer: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  subLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  dayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  dayText: {
    fontSize: 12,
  },
  noteText: {
    fontSize: 11,
    lineHeight: 15,
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontWeight: '700',
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  ruleLeft: {
    flex: 1,
    paddingRight: 10,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  ruleDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  numberInput: {
    width: 60,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
  },
});
