import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Boxes,
  Info,
  Users,
  Clock,
  Calendar,
  CreditCard,
  CheckSquare,
  FileBarChart,
  MapPin,
  Receipt,
  ChevronRight,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

interface ModuleConfig {
  id: string;
  name: string;
  desc: string;
  icon: any;
  enabled: boolean;
  isCore?: boolean;
  featureControls?: { key: string; label: string; enabled: boolean }[];
}

/**
 * FlowHRMS - Mobile Module Management Screen
 * Stitch Screen: FlowHRMS - Mobile Module Management Screen
 */
export default function ModuleManagementScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [modules, setModules] = useState<ModuleConfig[]>([
    {
      id: 'employees',
      name: 'Employee Management',
      desc: 'Profiles, employment information, reporting manager, documents, status and timeline.',
      icon: Users,
      enabled: true,
      isCore: true,
    },
    {
      id: 'attendance',
      name: 'Attendance',
      desc: 'Check-in/out, time and location capture, shifts, exceptions, calendar, late rules.',
      icon: Clock,
      enabled: true,
      featureControls: [
        { key: 'geofence', label: 'Permitted-area check', enabled: true },
        { key: 'any_loc', label: 'Check in at any company location', enabled: false },
        { key: 'multi_punch', label: 'Multiple punches per day', enabled: false },
      ],
    },
    {
      id: 'leave',
      name: 'Leave',
      desc: 'Request, approve or reject, half-day and emergency leave, and payroll effect.',
      icon: Calendar,
      enabled: true,
    },
    {
      id: 'payroll',
      name: 'Payroll',
      desc: 'Manage cycles, compute salaries, generate payslips and record deductions.',
      icon: CreditCard,
      enabled: true,
    },
    {
      id: 'tasks',
      name: 'Tasks',
      desc: 'Dispatch task checklists, field duties, priorities and track live completion.',
      icon: CheckSquare,
      enabled: true,
    },
    {
      id: 'daily_report',
      name: 'Daily Reporting',
      desc: 'Automated executive snapshot of workforce attendance and active tasks.',
      icon: FileBarChart,
      enabled: true,
    },
    {
      id: 'field_visits',
      name: 'Field Visits',
      desc: 'Client site check-ins, geo-tagged route tracking and travel allowances.',
      icon: MapPin,
      enabled: false,
    },
    {
      id: 'expenses',
      name: 'Expense Reimbursements',
      desc: 'Employee expense claims, receipt attachments and manager sign-offs.',
      icon: Receipt,
      enabled: false,
    },
  ]);

  const toggleModule = (id: string) => {
    setModules(
      modules.map((m) => {
        if (m.id === id) {
          if (m.isCore) {
            Alert.alert(
              'Core Module',
              'Employee Management is required by the FlowHRMS platform and cannot be turned off.'
            );
            return m;
          }
          const next = !m.enabled;
          Alert.alert(
            next ? `Enabled ${m.name}` : `Turned Off ${m.name}`,
            next
              ? `${m.name} is now enabled across the mobile app and web workspace.`
              : `Turning off ${m.name} removes it from navigation. No past data is deleted.`
          );
          return { ...m, enabled: next };
        }
        return m;
      })
    );
  };

  const toggleSubControl = (moduleId: string, controlKey: string) => {
    setModules(
      modules.map((m) => {
        if (m.id === moduleId && m.featureControls) {
          const updatedControls = m.featureControls.map((fc) =>
            fc.key === controlKey ? { ...fc, enabled: !fc.enabled } : fc
          );
          return { ...m, featureControls: updatedControls };
        }
        return m;
      })
    );
  };

  const activeCount = modules.filter((m) => m.enabled).length;

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
            CONFIGURATION
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Module Management
          </Text>
        </View>
        <View style={[styles.activeTag, { backgroundColor: t.colors.surfaceSunken }]}>
          <Text style={[styles.activeTagText, { color: t.colors.textPrimary }]}>
            {activeCount}/{modules.length}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Callout */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleActive,
            },
          ]}
        >
          <Info size={18} color={t.colors.brandPrimary} style={styles.infoIcon} />
          <View style={styles.infoTextWrap}>
            <Text style={[styles.infoTitle, { color: t.colors.textPrimary }]}>
              How module changes behave
            </Text>
            <Text style={[styles.infoDesc, { color: t.colors.textSecondary }]}>
              Turning a module off removes it from navigation, blocks it in the app, stops its
              notifications and scheduled jobs, and is recorded in the activity log. No business
              data is deleted.
            </Text>
          </View>
        </View>

        {/* Modules List */}
        <View style={styles.sectionHeadingRow}>
          <View style={styles.sectionHeadingLeft}>
            <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
              V1 modules
            </Text>
            <View style={[styles.badgePill, { backgroundColor: t.colors.surfaceSunken }]}>
              <Text style={[styles.badgePillText, { color: t.colors.textPrimary }]}>8</Text>
            </View>
          </View>
          <Text style={[styles.secSubtitle, { color: t.colors.textTertiary }]}>
            Core workspace features
          </Text>
        </View>

        <View style={styles.moduleList}>
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Card key={m.id} style={styles.moduleCard}>
                <View style={styles.moduleTop}>
                  <View style={styles.moduleLeft}>
                    <View
                      style={[
                        styles.moduleIconBox,
                        {
                          backgroundColor: m.enabled
                            ? t.colors.brandPrimarySubtle
                            : t.colors.surfaceSunken,
                        },
                      ]}
                    >
                      <Icon
                        size={18}
                        color={m.enabled ? t.colors.brandPrimary : t.colors.textTertiary}
                      />
                    </View>
                    <View style={styles.moduleTextWrap}>
                      <Text style={[styles.moduleName, { color: t.colors.textPrimary }]}>
                        {m.name}
                      </Text>
                      <Text style={[styles.moduleDesc, { color: t.colors.textSecondary }]}>
                        {m.desc}
                      </Text>
                    </View>
                  </View>

                  <StatusChip
                    status={
                      m.enabled
                        ? { key: 'enabled', label: 'Enabled', tone: 'success' }
                        : { key: 'disabled', label: 'Disabled', tone: 'neutral' }
                    }
                    size="sm"
                  />
                </View>

                {/* Toggle Bar */}
                <View
                  style={[
                    styles.toggleBar,
                    { borderTopColor: t.colors.borderSubtle },
                  ]}
                >
                  <Text style={[styles.toggleLabel, { color: t.colors.textSecondary }]}>
                    {m.name} module
                  </Text>
                  <Switch
                    value={m.enabled}
                    onValueChange={() => toggleModule(m.id)}
                    trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {/* Sub Feature Controls (if any) */}
                {m.enabled && m.featureControls && (
                  <View
                    style={[
                      styles.subControlsBox,
                      {
                        backgroundColor: t.colors.surfaceCanvas,
                        borderColor: t.colors.borderSubtle,
                      },
                    ]}
                  >
                    <Text style={[styles.subControlsTitle, { color: t.colors.textTertiary }]}>
                      FEATURE CONTROLS
                    </Text>
                    {m.featureControls.map((fc, idx) => (
                      <View
                        key={fc.key}
                        style={[
                          styles.subControlRow,
                          idx < m.featureControls!.length - 1 && {
                            borderBottomColor: t.colors.borderSubtle,
                            borderBottomWidth: 1,
                          },
                        ]}
                      >
                        <Text style={[styles.subControlLabel, { color: t.colors.textPrimary }]}>
                          {fc.label}
                        </Text>
                        <Switch
                          value={fc.enabled}
                          onValueChange={() => toggleSubControl(m.id, fc.key)}
                          trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                          thumbColor="#FFFFFF"
                        />
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            );
          })}
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
  activeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoTextWrap: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  infoDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  secSubtitle: {
    fontSize: 11,
  },
  moduleList: {
    gap: 12,
  },
  moduleCard: {
    padding: 14,
    marginBottom: 0,
  },
  moduleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  moduleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
  },
  moduleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  moduleTextWrap: {
    flex: 1,
  },
  moduleName: {
    fontSize: 14,
    fontWeight: '700',
  },
  moduleDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
  toggleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  subControlsBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginTop: 10,
  },
  subControlsTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  subControlLabel: {
    fontSize: 11.5,
  },
});
