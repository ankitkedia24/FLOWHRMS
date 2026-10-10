import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {
  CreditCard,
  Building,
  Award,
  Shield,
  Clock,
  Settings,
  Receipt,
  BarChart3,
  FileCheck,
  ReceiptText,
  ShieldCheck,
  Boxes,
  Lock,
  HelpCircle,
  LogOut,
  ChevronRight,
  Search,
  X,
  FileText,
  Sparkles,
  UserCheck,
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

interface MenuItem {
  title: string;
  subtitle: string;
  icon: any;
  route?: string;
  badge?: string;
  badgeColor?: string;
  onPress?: () => void;
  destructive?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export function NavigationHub({
  userName = 'User',
  userRole = 'Owner',
  employeeCode = 'EMP-0001',
  workspaceName = 'FlowHRMS',
  trialDaysLeft = 26,
  onSignOut,
  onConsentPress,
}: NavigationHubProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const isAdmin =
    userRole.toLowerCase().includes('admin') ||
    userRole.toLowerCase().includes('owner') ||
    userRole.toLowerCase().includes('manager');

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Quick Action Top Shortcuts
  const quickShortcuts = useMemo(() => {
    if (isAdmin) {
      return [
        {
          label: 'ID Badges',
          sub: 'Studio',
          icon: CreditCard,
          route: '/id-card',
          bg: '#EEF2FF',
          fg: '#4F46E5',
        },
        {
          label: 'Payroll',
          sub: 'Engine',
          icon: Receipt,
          route: '/payroll',
          bg: '#ECFDF5',
          fg: '#059669',
        },
        {
          label: 'Reports',
          sub: 'Analytics',
          icon: BarChart3,
          route: '/reports',
          bg: '#F0F9FF',
          fg: '#0284C7',
        },
        {
          label: 'Vault',
          sub: 'KYC Files',
          icon: FileText,
          route: '/documents',
          bg: '#FFFBEB',
          fg: '#D97706',
        },
      ];
    }
    return [
      {
        label: 'ID Card',
        sub: 'My Badge',
        icon: CreditCard,
        route: '/id-card',
        bg: '#EEF2FF',
        fg: '#4F46E5',
      },
      {
        label: 'Payslips',
        sub: 'Monthly',
        icon: Receipt,
        route: '/payslips',
        bg: '#ECFDF5',
        fg: '#059669',
      },
      {
        label: 'Documents',
        sub: 'Personal',
        icon: FileText,
        route: '/documents',
        bg: '#F0F9FF',
        fg: '#0284C7',
      },
      {
        label: 'Profile',
        sub: 'Account',
        icon: UserCheck,
        route: '/(tabs)/profile',
        bg: '#FFFBEB',
        fg: '#D97706',
      },
    ];
  }, [isAdmin]);

  // Structured Categorized Sections
  const adminSections: MenuSection[] = [
    {
      title: 'Workforce & Organization',
      items: [
        {
          title: 'Departments & Units',
          subtitle: 'Branches, divisions, and operational teams',
          icon: Building,
          route: '/departments',
        },
        {
          title: 'Designations & Roles',
          subtitle: 'Job titles, hierarchy levels, and positions',
          icon: Award,
          route: '/designations',
        },
        {
          title: 'Access Levels & Permissions',
          subtitle: 'Security scopes for Admins, Managers & Staff',
          icon: Shield,
          route: '/access-levels',
        },
        {
          title: 'Attendance & Shift Rules',
          subtitle: 'Work hours, punch windows, and grace margins',
          icon: Clock,
          route: '/attendance-rules',
        },
      ],
    },
    {
      title: 'Operations & Finance',
      items: [
        {
          title: 'ID Card Studio',
          subtitle: 'Design smart badges & print 300 DPI templates',
          icon: CreditCard,
          route: '/id-card',
          badge: 'Canvas',
          badgeColor: '#4F46E5',
        },
        {
          title: 'Payroll Engine',
          subtitle: 'Salary registers, allowances, and pay slips',
          icon: Receipt,
          route: '/payroll',
        },
        {
          title: 'Employee Documents Vault',
          subtitle: 'Government IDs, agreements, and KYC documents',
          icon: FileText,
          route: '/documents',
        },
        {
          title: 'Reports & Analytics',
          subtitle: 'Exportable attendance, leaves, and trends',
          icon: BarChart3,
          route: '/reports',
        },
        {
          title: 'Daily Shift Digest',
          subtitle: 'End-of-day attendance summary reports',
          icon: FileCheck,
          route: '/daily-report',
        },
      ],
    },
    {
      title: 'Workspace Administration',
      items: [
        {
          title: 'Company Settings',
          subtitle: 'Organization details, logo, and time preferences',
          icon: Settings,
          route: '/company-settings',
        },
        {
          title: 'Subscription & Invoices',
          subtitle: 'Active plan, billing history, and invoices',
          icon: ReceiptText,
          route: '/subscription',
          badge: 'Pro Tier',
          badgeColor: '#059669',
        },
        {
          title: 'Activity Logs & Audit',
          subtitle: 'Track admin logins, changes, and approvals',
          icon: ShieldCheck,
          route: '/activity-log',
        },
        {
          title: 'Module Management',
          subtitle: 'Toggle optional workspace modules',
          icon: Boxes,
          route: '/module-management',
        },
      ],
    },
    {
      title: 'Account & Security',
      items: [
        {
          title: 'Account & Password',
          subtitle: 'Update credentials and personal security',
          icon: Lock,
          route: '/account',
        },
        {
          title: 'DPDP Privacy & Consent',
          subtitle: 'Statutory compliance & data processing rights',
          icon: ShieldCheck,
          onPress: onConsentPress,
        },
        {
          title: 'Help & Knowledge Base',
          subtitle: 'User manuals, walkthroughs, and support',
          icon: HelpCircle,
          route: '/company-settings',
        },
        {
          title: 'Sign Out',
          subtitle: 'Safely disconnect your account session',
          icon: LogOut,
          onPress: onSignOut,
          destructive: true,
        },
      ],
    },
  ];

  const employeeSections: MenuSection[] = [
    {
      title: 'Employee Self-Service',
      items: [
        {
          title: 'Digital ID Card',
          subtitle: 'View official digital credentials and QR code',
          icon: CreditCard,
          route: '/id-card',
        },
        {
          title: 'Monthly Payslips',
          subtitle: 'Salary statements and payment slips',
          icon: Receipt,
          route: '/payslips',
        },
        {
          title: 'My Documents & KYC',
          subtitle: 'Personal identity cards and verified forms',
          icon: FileText,
          route: '/documents',
        },
      ],
    },
    {
      title: 'Account & Security',
      items: [
        {
          title: 'Account Settings',
          subtitle: 'Password, phone number, and preferences',
          icon: Lock,
          route: '/account',
        },
        {
          title: 'DPDP Privacy & Consent',
          subtitle: 'Statutory privacy terms & declarations',
          icon: ShieldCheck,
          onPress: onConsentPress,
        },
        {
          title: 'Help & Support',
          subtitle: 'FAQs, contact HR, and feedback',
          icon: HelpCircle,
          route: '/company-settings',
        },
        {
          title: 'Sign Out',
          subtitle: 'Disconnect this mobile session',
          icon: LogOut,
          onPress: onSignOut,
          destructive: true,
        },
      ],
    },
  ];

  const sections = isAdmin ? adminSections : employeeSections;

  // Filter items if user is searching
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sections;

    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q)
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [sections, searchQuery]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. Executive Profile Card */}
      <View
        style={[
          styles.profileCard,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderColor: t.colors.borderDefault,
          },
        ]}
      >
        <View style={styles.profileHeaderRow}>
          {/* Avatar with Initials */}
          <View style={[styles.avatarBox, { backgroundColor: t.colors.brandPrimary }]}>
            <Text style={styles.avatarLetters}>{initials || 'U'}</Text>
          </View>

          {/* User Info */}
          <View style={styles.profileDetails}>
            <View style={styles.nameBadgeRow}>
              <Text
                style={[styles.userNameText, { color: t.colors.textPrimary }]}
                numberOfLines={1}
              >
                {userName}
              </Text>
              <View
                style={[
                  styles.rolePill,
                  { backgroundColor: t.colors.brandPrimarySubtle },
                ]}
              >
                <Text style={[styles.rolePillText, { color: t.colors.brandPrimary }]}>
                  {userRole}
                </Text>
              </View>
            </View>

            <Text
              style={[styles.workspaceSubText, { color: t.colors.textSecondary }]}
              numberOfLines={1}
            >
              {employeeCode} • {workspaceName}
            </Text>
          </View>

          {/* Quick Profile Arrow */}
          <TouchableOpacity
            style={[styles.profileArrowBtn, { backgroundColor: t.colors.surfaceSunken }]}
            onPress={() => router.push('/(tabs)/profile' as any)}
            activeOpacity={0.7}
            accessibilityLabel="View profile"
          >
            <ChevronRight size={18} color={t.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Status Pill Footer */}
        <View style={[styles.statusRow, { borderTopColor: t.colors.borderSubtle }]}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.statusText, { color: t.colors.textSecondary }]}>
              {workspaceName} · Active Enterprise
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/subscription' as any)}
            activeOpacity={0.7}
            style={styles.planLink}
          >
            <Sparkles size={12} color={t.colors.brandPrimary} />
            <Text style={[styles.planLinkText, { color: t.colors.brandPrimary }]}>
              Manage Plan
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Sleek Quick Search Bar */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderColor: t.colors.borderDefault,
          },
        ]}
      >
        <Search size={16} color={t.colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: t.colors.textPrimary }]}
          placeholder="Search modules, tools, or settings..."
          placeholderTextColor={t.colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.clearBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={14} color={t.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. Quick Action Toolbar (Shown when not searching) */}
      {!searchQuery && (
        <View style={styles.quickGrid}>
          {quickShortcuts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quickCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.quickIconCircle, { backgroundColor: item.bg }]}>
                  <Icon size={18} color={item.fg} strokeWidth={2.2} />
                </View>
                <Text
                  style={[styles.quickCardLabel, { color: t.colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Text
                  style={[styles.quickCardSub, { color: t.colors.textTertiary }]}
                  numberOfLines={1}
                >
                  {item.sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* 4. Categorized Navigation Groups */}
      {filteredSections.map((sec, secIdx) => (
        <View key={secIdx} style={styles.sectionWrap}>
          <Text style={[styles.sectionHeading, { color: t.colors.textSecondary }]}>
            {sec.title}
          </Text>

          <View
            style={[
              styles.sectionCardGroup,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            {sec.items.map((item, itemIdx) => {
              const Icon = item.icon;
              const isLast = itemIdx === sec.items.length - 1;
              return (
                <TouchableOpacity
                  key={itemIdx}
                  style={[
                    styles.menuRow,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: t.colors.borderSubtle,
                    },
                  ]}
                  onPress={() => {
                    if (item.onPress) {
                      item.onPress();
                    } else if (item.route) {
                      router.push(item.route as any);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  {/* Icon */}
                  <View
                    style={[
                      styles.menuIconWrap,
                      {
                        backgroundColor: item.destructive
                          ? t.colors.status.error.bg
                          : t.colors.surfaceSunken,
                      },
                    ]}
                  >
                    <Icon
                      size={18}
                      color={
                        item.destructive
                          ? t.colors.status.error.fg
                          : t.colors.textSecondary
                      }
                      strokeWidth={2}
                    />
                  </View>

                  {/* Texts */}
                  <View style={styles.menuTextWrap}>
                    <View style={styles.menuTitleRow}>
                      <Text
                        style={[
                          styles.menuTitle,
                          {
                            color: item.destructive
                              ? t.colors.status.error.fg
                              : t.colors.textPrimary,
                          },
                        ]}
                      >
                        {item.title}
                      </Text>
                      {item.badge && (
                        <View
                          style={[
                            styles.itemBadgePill,
                            { backgroundColor: `${item.badgeColor || '#4F46E5'}15` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.itemBadgeText,
                              { color: item.badgeColor || '#4F46E5' },
                            ]}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.menuSubtitle, { color: t.colors.textTertiary }]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  </View>

                  {/* Right Chevron */}
                  <ChevronRight
                    size={16}
                    color={
                      item.destructive
                        ? t.colors.status.error.fg
                        : t.colors.textTertiary
                    }
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Empty Search Result */}
      {filteredSections.length === 0 && (
        <View style={styles.emptySearchWrap}>
          <Text style={[styles.emptySearchTitle, { color: t.colors.textPrimary }]}>
            No tools found
          </Text>
          <Text style={[styles.emptySearchSub, { color: t.colors.textTertiary }]}>
            Try searching for &ldquo;Payroll&rdquo;, &ldquo;Badge&rdquo;, or &ldquo;Settings&rdquo;
          </Text>
        </View>
      )}

      {/* 5. Minimalist Footer */}
      <View style={styles.hubFooter}>
        <Text style={[styles.footerBrandText, { color: t.colors.textTertiary }]}>
          FLOWHRMS • Secure Cloud Enterprise
        </Text>
        <Text style={[styles.footerVersionText, { color: t.colors.textDisabled }]}>
          v2.4.2 · Production Verified
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetters: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  profileDetails: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  rolePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  workspaceSubText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  profileArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  planLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  planLinkText: {
    fontSize: 11,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickCardSub: {
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 1,
    textAlign: 'center',
  },
  sectionWrap: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionCardGroup: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemBadgePill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  itemBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  menuSubtitle: {
    fontSize: 11,
    marginTop: 1.5,
  },
  emptySearchWrap: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySearchTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptySearchSub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  hubFooter: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 3,
  },
  footerBrandText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  footerVersionText: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default NavigationHub;
