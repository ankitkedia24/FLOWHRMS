import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {
  LayoutDashboard,
  Clock,
  Users,
  CalendarDays,
  CheckSquare,
  CreditCard,
  FileBarChart,
  BarChart3,
  Building2,
  Share2,
  Boxes,
  UserCheck,
  Shield,
  FileCheck,
  Building,
  Award,
  Receipt,
  Settings,
  ReceiptText,
  Lock,
  ShieldCheck,
  HelpCircle,
  LogOut,
  ChevronRight,
  Search,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface NavigationHubProps {
  userName?: string;
  userRole?: string;
  employeeCode?: string;
  workspaceName?: string;
  trialDaysLeft?: number;
  onSignOut?: () => void;
  onConsentPress?: () => void;
}

/**
 * Mobile Navigation Hub & Menu Screen
 * Exact implementation of Stitch "FlowHRMS - Mobile Navigation Hub & Menu".
 * Provides access to the 10 Daily Operation modules and 10 Configurations & Administration tools.
 */
export function NavigationHub({
  userName = 'Rishabh',
  userRole = 'Owner',
  employeeCode = 'EMP-0001',
  workspaceName = 'FX & Float Logistics',
  trialDaysLeft = 26,
  onSignOut,
  onConsentPress,
}: NavigationHubProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');

  const dailyModules = [
    {
      title: 'Dashboard',
      icon: LayoutDashboard,
      badge: 'Live',
      badgeVariant: 'success',
      route: '/(tabs)',
    },
    {
      title: 'Attendance',
      icon: Clock,
      badge: '2 unlogged',
      badgeVariant: 'error',
      route: '/(tabs)/attendance',
    },
    {
      title: 'Employees',
      icon: Users,
      badge: '2 Active',
      badgeVariant: 'neutral',
      route: '/(tabs)/employees',
    },
    {
      title: 'Leave',
      icon: CalendarDays,
      badge: '1 Pending',
      badgeVariant: 'indigo',
      route: '/(tabs)/leave',
    },
    {
      title: 'Tasks',
      icon: CheckSquare,
      badge: '3 Ongoing',
      badgeVariant: 'indigo',
      route: '/(tabs)/tasks',
    },
    {
      title: 'Payroll',
      icon: CreditCard,
      badge: 'Oct Calc',
      badgeVariant: 'neutral',
      route: '/payroll',
    },
    {
      title: 'Daily Report',
      icon: FileBarChart,
      badge: 'Today',
      badgeVariant: 'success',
      route: '/daily-report',
    },
    {
      title: 'Reports & Analytics',
      icon: BarChart3,
      route: '/reports',
    },
    {
      title: 'My Workspace',
      icon: Building2,
      route: '/company-settings',
    },
    {
      title: 'Integrations',
      icon: Share2,
      badge: 'API / WA',
      badgeVariant: 'success',
      route: '/module-management',
    },
  ];

  const configModules = [
    { title: 'Module Management', icon: Boxes, route: '/module-management' },
    { title: 'Designations & Roles', icon: UserCheck, route: '/designations' },
    { title: 'Access Level & Permissions', icon: Shield, route: '/access-levels' },
    { title: 'Attendance & Pay Rules', icon: FileCheck, route: '/attendance-rules' },
    { title: 'Departments', icon: Building, route: '/departments' },
    { title: 'ID Card Studio', icon: CreditCard, badge: 'Canvas', route: '/id-card' },
    { title: 'Employee Documents Vault', icon: FileBarChart, route: '/documents' },
    { title: 'Payslips & Statements', icon: Receipt, route: '/payslips' },
    { title: 'Company Settings', icon: Settings, route: '/company-settings' },
    { title: 'Subscription & Billing', icon: ReceiptText, badge: 'Pro Trial', route: '/subscription' },
    { title: 'Activity Logs & Audit Trail', icon: ShieldCheck, route: '/activity-log' },
  ];

  const filteredDaily = dailyModules.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredConfigs = configModules.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: t.colors.surfaceCanvasWarm },
      ]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* User Profile & Context Banner */}
      <View
        style={[
          styles.profileBanner,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderColor: t.colors.borderDefault,
          },
        ]}
      >
        <View style={styles.profileTop}>
          <View style={styles.profileLeft}>
            <View style={styles.avatarWrap}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: t.colors.brandPrimary },
                ]}
              >
                <Text style={styles.avatarLetter}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View
                style={[
                  styles.onlineBadge,
                  { backgroundColor: t.colors.accentPositive },
                ]}
              />
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.userName, { color: t.colors.brandNavy }]}
                >
                  {userName}
                </Text>
                <View
                  style={[
                    styles.roleBadge,
                    { backgroundColor: t.colors.brandPrimarySubtle },
                  ]}
                >
                  <Text
                    style={[
                      styles.roleText,
                      { color: t.colors.brandPrimary },
                    ]}
                  >
                    {userRole}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.userCode, { color: t.colors.textSecondary }]}
              >
                {employeeCode} • {workspaceName}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.settingsBtn,
              { backgroundColor: t.colors.surfaceSunken },
            ]}
            onPress={() => router.push('/company-settings' as any)}
            activeOpacity={0.7}
          >
            <Settings size={18} color={t.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Trial Countdown Row */}
        <View
          style={[
            styles.trialRow,
            { borderTopColor: t.colors.borderSubtle },
          ]}
        >
          <View style={styles.trialLeft}>
            <View
              style={[
                styles.trialDot,
                { backgroundColor: t.colors.accentPositive },
              ]}
            />
            <Text
              style={[
                styles.trialDaysText,
                { color: t.colors.accentPositive },
              ]}
            >
              {trialDaysLeft} days left{' '}
              <Text style={{ color: t.colors.textSecondary }}>
                (Free Trial)
              </Text>
            </Text>
          </View>

          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => router.push('/subscription' as any)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.upgradeText, { color: t.colors.brandPrimary }]}
            >
              Upgrade
            </Text>
            <ChevronRight size={14} color={t.colors.brandPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* In-Menu Quick Search */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderColor: t.colors.borderDefault,
          },
        ]}
      >
        <Search size={18} color={t.colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: t.colors.textPrimary }]}
          placeholder="Search menus, modules, or settings..."
          placeholderTextColor={t.colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <View
          style={[
            styles.cmdKeyPill,
            {
              backgroundColor: t.colors.surfaceSunken,
              borderColor: t.colors.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.cmdKeyText, { color: t.colors.textTertiary }]}>
            ⌘K
          </Text>
        </View>
      </View>

      {/* Section 1: Daily Operations (10 Modules) */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text
            style={[styles.sectionTitle, { color: t.colors.brandPrimary }]}
          >
            Daily Operations
          </Text>
          <View
            style={[
              styles.countPill,
              { backgroundColor: t.colors.brandPrimarySubtle },
            ]}
          >
            <Text
              style={[
                styles.countPillText,
                { color: t.colors.brandPrimary },
              ]}
            >
              10 Modules
            </Text>
          </View>
        </View>
        <Text style={[styles.sectionSub, { color: t.colors.textTertiary }]}>
          Core Shift Workflows
        </Text>
      </View>

      <View style={styles.dailyGrid}>
        {filteredDaily.map((item, idx) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.dailyCard,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.borderDefault,
                },
              ]}
              onPress={() => {
                if (item.route && item.route !== '#') {
                  router.push(item.route as any);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.dailyCardTop}>
                <View
                  style={[
                    styles.dailyIconWrap,
                    { backgroundColor: t.colors.brandPrimarySubtle },
                  ]}
                >
                  <Icon size={18} color={t.colors.brandPrimary} />
                </View>
                {item.badge ? (
                  <View
                    style={[
                      styles.dailyBadge,
                      item.badgeVariant === 'success' && {
                        backgroundColor: t.colors.accentPositiveBg,
                      },
                      item.badgeVariant === 'error' && {
                        backgroundColor: t.colors.status.error.bg,
                      },
                      item.badgeVariant === 'indigo' && {
                        backgroundColor: t.colors.brandPrimarySubtle,
                      },
                      item.badgeVariant === 'neutral' && {
                        backgroundColor: t.colors.surfaceSunken,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dailyBadgeText,
                        item.badgeVariant === 'success' && {
                          color: t.colors.status.success.text,
                        },
                        item.badgeVariant === 'error' && {
                          color: t.colors.status.error.text,
                        },
                        item.badgeVariant === 'indigo' && {
                          color: t.colors.brandPrimary,
                        },
                        item.badgeVariant === 'neutral' && {
                          color: t.colors.textSecondary,
                        },
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={[
                  styles.dailyCardLabel,
                  { color: t.colors.textPrimary },
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Section 2: Configurations & Administration */}
      <View style={[styles.sectionHeader, { marginTop: 18 }]}>
        <View style={styles.sectionTitleRow}>
          <Text
            style={[styles.sectionTitle, { color: t.colors.brandPrimary }]}
          >
            Configurations & Administration
          </Text>
          <View
            style={[
              styles.countPill,
              { backgroundColor: t.colors.surfaceSunken },
            ]}
          >
            <Text
              style={[
                styles.countPillText,
                { color: t.colors.textSecondary },
              ]}
            >
              Owner Access
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[
          styles.listGroup,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderColor: t.colors.borderDefault,
          },
        ]}
      >
        {filteredConfigs.map((item, idx) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.listItem,
                idx < filteredConfigs.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.borderSubtle,
                },
              ]}
              onPress={() => {
                if (item.route) {
                  router.push(item.route as any);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.listItemLeft}>
                <View
                  style={[
                    styles.listIconWrap,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <Icon size={17} color={t.colors.textSecondary} />
                </View>
                <Text
                  style={[styles.listItemText, { color: t.colors.textPrimary }]}
                >
                  {item.title}
                </Text>
                {item.badge ? (
                  <View
                    style={[
                      styles.proBadge,
                      { backgroundColor: t.colors.accentPositiveBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.proBadgeText,
                        { color: t.colors.status.success.text },
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <ChevronRight size={16} color={t.colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Section 3: My Account & Support */}
      <View style={[styles.sectionHeader, { marginTop: 18 }]}>
        <Text style={[styles.sectionTitle, { color: t.colors.brandPrimary }]}>
          My Account & Support
        </Text>
      </View>

      <View
        style={[
          styles.listGroup,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderColor: t.colors.borderDefault,
          },
        ]}
      >
        {/* Account & Security */}
        <TouchableOpacity
          style={styles.listItem}
          onPress={() => router.push('/account' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.listItemLeft}>
            <View
              style={[
                styles.listIconWrap,
                { backgroundColor: t.colors.surfaceSunken },
              ]}
            >
              <Lock size={17} color={t.colors.textSecondary} />
            </View>
            <Text
              style={[styles.listItemText, { color: t.colors.textPrimary }]}
            >
              Account & Security
            </Text>
          </View>
          <ChevronRight size={16} color={t.colors.textTertiary} />
        </TouchableOpacity>

        {/* Privacy & Consent (DPDP 2023) */}
        <TouchableOpacity
          style={[
            styles.listItem,
            { borderTopWidth: 1, borderTopColor: t.colors.borderSubtle },
          ]}
          onPress={onConsentPress}
          activeOpacity={0.7}
        >
          <View style={styles.listItemLeft}>
            <View
              style={[
                styles.listIconWrap,
                { backgroundColor: t.colors.surfaceSunken },
              ]}
            >
              <ShieldCheck size={17} color={t.colors.brandPrimary} />
            </View>
            <Text
              style={[styles.listItemText, { color: t.colors.textPrimary }]}
            >
              Privacy & Consent (DPDP 2023)
            </Text>
          </View>
          <ChevronRight size={16} color={t.colors.textTertiary} />
        </TouchableOpacity>

        {/* Help & Support */}
        <TouchableOpacity
          style={[
            styles.listItem,
            { borderTopWidth: 1, borderTopColor: t.colors.borderSubtle },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.listItemLeft}>
            <View
              style={[
                styles.listIconWrap,
                { backgroundColor: t.colors.surfaceSunken },
              ]}
            >
              <HelpCircle size={17} color={t.colors.textSecondary} />
            </View>
            <Text
              style={[styles.listItemText, { color: t.colors.textPrimary }]}
            >
              Help & Support
            </Text>
            <View
              style={[
                styles.proBadge,
                { backgroundColor: t.colors.accentPositiveBg },
              ]}
            >
              <Text
                style={[
                  styles.proBadgeText,
                  { color: t.colors.status.success.text },
                ]}
              >
                Online
              </Text>
            </View>
          </View>
          <ChevronRight size={16} color={t.colors.textTertiary} />
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity
          style={[
            styles.listItem,
            { borderTopWidth: 1, borderTopColor: t.colors.borderSubtle },
          ]}
          onPress={onSignOut}
          activeOpacity={0.7}
        >
          <View style={styles.listItemLeft}>
            <View
              style={[
                styles.listIconWrap,
                { backgroundColor: t.colors.status.error.bg },
              ]}
            >
              <LogOut size={17} color={t.colors.status.error.fg} />
            </View>
            <Text
              style={[
                styles.listItemText,
                { color: t.colors.status.error.fg, fontWeight: '700' },
              ]}
            >
              Sign Out
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* App Version Footer */}
      <View style={styles.footer}>
        <Text style={[styles.versionText, { color: t.colors.textTertiary }]}>
          FlowHRMS v2.4.1 (Stable Build)
        </Text>
        <Text style={[styles.subFooterText, { color: t.colors.textDisabled }]}>
          Built for Dignified Indian Field Operations
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  profileBanner: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: 'rgba(30, 27, 75, 0.04)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
    marginBottom: 12,
  },
  profileTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  userCode: {
    fontSize: 12,
    marginTop: 2,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  trialLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trialDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trialDaysText: {
    fontSize: 12,
    fontWeight: '700',
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  upgradeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  cmdKeyPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  cmdKeyText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 11,
  },
  dailyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dailyCard: {
    width: '48.8%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  dailyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dailyIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  dailyBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  dailyCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  listGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  proBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 4,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subFooterText: {
    fontSize: 11,
  },
});

export default NavigationHub;
