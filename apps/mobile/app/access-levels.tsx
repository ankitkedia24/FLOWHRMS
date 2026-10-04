import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Shield,
  Info,
  ChevronDown,
  Check,
  Lock,
  UserCheck,
  Users,
  Eye,
  Sliders,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

interface RoleLevel {
  id: string;
  name: string;
  badge: string;
  scope: string;
  description: string;
  permissions: { module: string; access: string }[];
}

/**
 * FlowHRMS - Mobile Access Levels Screen
 * Stitch Screen: FlowHRMS - Mobile Access Levels Screen
 */
export default function AccessLevelsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [expandedRole, setExpandedRole] = useState<string | null>('owner');

  const roles: RoleLevel[] = [
    {
      id: 'owner',
      name: 'Owner',
      badge: 'All Permissions',
      scope: 'Entire Organization',
      description: 'Full unrestricted control of workspace, billing, company settings, and data retention.',
      permissions: [
        { module: 'Company Settings & Billing', access: 'Full Control' },
        { module: 'Payroll Approval & Disbursement', access: 'Full Control' },
        { module: 'Attendance & Exceptions', access: 'Approve & Edit All' },
        { module: 'Employee Data & Salary', access: 'Full Access' },
        { module: 'Audit Logs & Retention', access: 'Full Export & Audit' },
      ],
    },
    {
      id: 'super_admin',
      name: 'Super Admin',
      badge: 'System Admin',
      scope: 'All Modules (Except Ownership)',
      description: 'Manages company policies, rules, roles, and operational workflows across all branches.',
      permissions: [
        { module: 'Attendance & Pay Rules', access: 'Manage & Version' },
        { module: 'Payroll Calculations', access: 'Compute & Review' },
        { module: 'Module Management', access: 'Toggle Workspace Features' },
        { module: 'Department & Designations', access: 'Full Management' },
      ],
    },
    {
      id: 'admin',
      name: 'Admin',
      badge: 'Operations',
      scope: 'Assigned Departments / All',
      description: 'Day-to-day administrative oversight of attendance logs, employee onboarding, and shifts.',
      permissions: [
        { module: 'Attendance & Punch Logs', access: 'View & Edit' },
        { module: 'Leave Requests', access: 'Approve / Reject' },
        { module: 'Reports & Exports', access: 'Export CSV' },
      ],
    },
    {
      id: 'hr',
      name: 'HR',
      badge: 'People Ops',
      scope: 'All Employees',
      description: 'Manages employee profiles, document verification, leave balances, and onboardings.',
      permissions: [
        { module: 'Document Vault', access: 'Verify & Manage' },
        { module: 'Leave Balances', access: 'Adjust & Approve' },
        { module: 'Employee Directory', access: 'Add & Edit Profiles' },
      ],
    },
    {
      id: 'manager',
      name: 'Manager',
      badge: 'Team Approver',
      scope: 'Direct Reports',
      description: 'Sees attendance, leaves, and assigned tasks for members of their reporting tree.',
      permissions: [
        { module: 'Team Attendance', access: 'Review Exceptions' },
        { module: 'Team Leave Requests', access: 'Initial Approval' },
        { module: 'Task Assignments', access: 'Create & Assign' },
      ],
    },
    {
      id: 'team_leader',
      name: 'Team Leader',
      badge: 'Field Ops',
      scope: 'Assigned Shift / Cluster',
      description: 'Monitors real-time field check-ins and dispatches daily operational task checklists.',
      permissions: [
        { module: 'Field Check-in Feed', access: 'View Live Status' },
        { module: 'Shift Tasks', access: 'Monitor & Sign-off' },
      ],
    },
    {
      id: 'employee',
      name: 'Employee',
      badge: 'Self-Service',
      scope: 'Own Records Only',
      description: 'Check-in/out with location, apply for leaves, upload documents, and download payslips.',
      permissions: [
        { module: 'Attendance Punch', access: 'Check-in & Check-out' },
        { module: 'Leave Application', access: 'Submit Requests' },
        { module: 'My Documents & Payslips', access: 'Upload & Download' },
      ],
    },
  ];

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
            CONFIGURATION • ACCESS
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Access levels
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.rolesBtn,
            { backgroundColor: t.colors.brandPrimarySubtle },
          ]}
          onPress={() => router.push('/designations' as any)}
        >
          <Text style={[styles.rolesBtnText, { color: t.colors.brandPrimary }]}>
            Designations ↗
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scope Callout Card */}
        <View
          style={[
            styles.calloutCard,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.brandPrimarySubtleActive,
            },
          ]}
        >
          <View style={styles.calloutTop}>
            <View
              style={[
                styles.calloutIconBox,
                { backgroundColor: t.colors.brandPrimarySubtle },
              ]}
            >
              <Info size={16} color={t.colors.brandPrimary} />
            </View>
            <View style={styles.calloutTextWrap}>
              <Text style={[styles.calloutTitle, { color: t.colors.textPrimary }]}>
                Record scope is applied before every permission
              </Text>
              <Text style={[styles.calloutDesc, { color: t.colors.textSecondary }]}>
                An Admin can be given access to all departments or only their own. A Manager only
                ever sees their direct reports. Record scopes guarantee data segregation.
              </Text>
            </View>
          </View>
        </View>

        {/* Roles List */}
        <View style={styles.rolesList}>
          {roles.map((role) => {
            const isExpanded = expandedRole === role.id;
            return (
              <Card key={role.id} style={styles.roleCard}>
                <TouchableOpacity
                  onPress={() => setExpandedRole(isExpanded ? null : role.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.roleHeaderRow}>
                    <View style={styles.roleHeaderLeft}>
                      <View
                        style={[
                          styles.roleIconBox,
                          {
                            backgroundColor:
                              role.id === 'owner'
                                ? t.colors.brandPrimarySubtle
                                : t.colors.surfaceSunken,
                          },
                        ]}
                      >
                        <Shield
                          size={18}
                          color={
                            role.id === 'owner'
                              ? t.colors.brandPrimary
                              : t.colors.textSecondary
                          }
                        />
                      </View>
                      <View>
                        <View style={styles.roleTitleBadge}>
                          <Text style={[styles.roleName, { color: t.colors.textPrimary }]}>
                            {role.name}
                          </Text>
                          <View
                            style={[
                              styles.scopeTag,
                              { backgroundColor: t.colors.surfaceSunken },
                            ]}
                          >
                            <Text style={[styles.scopeTagText, { color: t.colors.textSecondary }]}>
                              {role.badge}
                            </Text>
                          </View>
                        </View>
                        <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                          Scope: {role.scope}
                        </Text>
                      </View>
                    </View>

                    <ChevronDown
                      size={18}
                      color={t.colors.textTertiary}
                      style={{
                        transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                      }}
                    />
                  </View>

                  <Text style={[styles.roleDesc, { color: t.colors.textSecondary }]}>
                    {role.description}
                  </Text>

                  {/* Expanded Permissions Breakdown */}
                  {isExpanded && (
                    <View
                      style={[
                        styles.permissionsBox,
                        {
                          borderTopColor: t.colors.borderSubtle,
                          backgroundColor: t.colors.surfaceCanvas,
                        },
                      ]}
                    >
                      <Text style={[styles.permHeading, { color: t.colors.textTertiary }]}>
                        PERMISSIONS & CAPABILITIES
                      </Text>
                      {role.permissions.map((p, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.permRow,
                            idx < role.permissions.length - 1 && {
                              borderBottomColor: t.colors.borderSubtle,
                              borderBottomWidth: 1,
                            },
                          ]}
                        >
                          <Text style={[styles.permModule, { color: t.colors.textPrimary }]}>
                            {p.module}
                          </Text>
                          <View style={styles.permPill}>
                            <Check size={12} color={t.colors.accentPositive} />
                            <Text style={[styles.permPillText, { color: t.colors.textSecondary }]}>
                              {p.access}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
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
  rolesBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  rolesBtnText: {
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
  calloutCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  calloutTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  calloutIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  calloutTextWrap: {
    flex: 1,
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  calloutDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  rolesList: {
    gap: 12,
  },
  roleCard: {
    padding: 16,
    marginBottom: 0,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  roleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '700',
  },
  scopeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  scopeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  roleDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  permissionsBox: {
    marginTop: 12,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 4,
    borderRadius: 8,
    borderTopWidth: 1,
  },
  permHeading: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  permModule: {
    fontSize: 12,
    fontWeight: '600',
  },
  permPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  permPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
