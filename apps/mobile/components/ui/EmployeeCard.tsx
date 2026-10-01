import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { Phone, Mail, MapPin, MoreVertical, ChevronRight } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

export interface EmployeeData {
  id: string;
  name: string;
  code?: string;
  role: string;
  phone?: string;
  email?: string;
  location?: string;
  status: 'active' | 'inactive' | 'on_leave';
  attendanceStatus?: 'present' | 'late' | 'not_recorded' | 'needs_review';
  initials?: string;
}

interface EmployeeCardProps {
  employee: EmployeeData;
  onPress?: () => void;
  onQuickAction?: () => void;
  quickActionLabel?: string;
  onMorePress?: () => void;
}

/**
 * Employee Card Component
 * From Stitch "FlowHRMS - Mobile Employees Screen" (§employee-card).
 * Clean, tactile card showing avatar, role, live active pill, contact CTA, and location metadata.
 */
export function EmployeeCard({
  employee,
  onPress,
  onQuickAction,
  quickActionLabel,
  onMorePress,
}: EmployeeCardProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const initials =
    employee.initials ||
    employee.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

  const handlePhone = () => {
    if (employee.phone) {
      Linking.openURL(`tel:${employee.phone}`);
    }
  };

  const handleEmail = () => {
    if (employee.email) {
      Linking.openURL(`mailto:${employee.email}`);
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.colors.surfaceDefault,
          borderColor: t.colors.borderDefault,
        },
      ]}
    >
      {/* Top Row: Avatar, Name, Role, Status */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={styles.avatarGroup}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: t.colors.brandPrimarySubtle,
                borderColor: t.colors.brandPrimarySubtleHover,
              },
            ]}
          >
            <Text
              style={[styles.avatarText, { color: t.colors.brandPrimary }]}
            >
              {initials}
            </Text>
          </View>

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.nameText, { color: t.colors.textPrimary }]}
                numberOfLines={1}
              >
                {employee.name}
              </Text>
              {employee.code && (
                <View
                  style={[
                    styles.codeBadge,
                    {
                      backgroundColor: t.colors.surfaceSunken,
                      borderColor: t.colors.borderDefault,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.codeText,
                      { color: t.colors.textSecondary },
                    ]}
                  >
                    {employee.code}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.roleRow}>
              <View
                style={[
                  styles.roleBadge,
                  { backgroundColor: t.colors.surfaceSunken },
                ]}
              >
                <Text
                  style={[styles.roleText, { color: t.colors.textPrimary }]}
                >
                  {employee.role}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Status Badge */}
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: t.colors.accentPositiveBg,
              borderColor: t.colors.accentPositiveBorder,
            },
          ]}
        >
          <View
            style={[
              styles.pulseDot,
              { backgroundColor: t.colors.accentPositive },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: t.colors.status.success.text },
            ]}
          >
            Active
          </Text>
        </View>
      </View>

      {/* Location Row (if present) */}
      {employee.location && (
        <View style={styles.locationRow}>
          <MapPin size={12} color={t.colors.textTertiary} />
          <Text
            style={[styles.locationText, { color: t.colors.textSecondary }]}
          >
            {employee.location}
          </Text>
        </View>
      )}

      {/* Divider */}
      <View
        style={[
          styles.divider,
          { backgroundColor: t.colors.borderSubtle },
        ]}
      />

      {/* Bottom Contact & Action Row */}
      <View style={styles.bottomRow}>
        {employee.phone ? (
          <TouchableOpacity
            style={[
              styles.contactBtn,
              {
                backgroundColor: t.colors.surfaceSunken,
                borderColor: t.colors.borderSubtle,
              },
            ]}
            onPress={handlePhone}
            activeOpacity={0.7}
          >
            <Phone size={13} color={t.colors.brandPrimary} />
            <Text
              style={[styles.contactText, { color: t.colors.textPrimary }]}
            >
              {employee.phone}
            </Text>
          </TouchableOpacity>
        ) : employee.email ? (
          <TouchableOpacity
            style={[
              styles.contactBtn,
              {
                backgroundColor: t.colors.surfaceSunken,
                borderColor: t.colors.borderSubtle,
              },
            ]}
            onPress={handleEmail}
            activeOpacity={0.7}
          >
            <Mail size={13} color={t.colors.brandPrimary} />
            <Text
              style={[styles.contactText, { color: t.colors.textPrimary }]}
              numberOfLines={1}
            >
              {employee.email}
            </Text>
          </TouchableOpacity>
        ) : null}

        {quickActionLabel ? (
          <TouchableOpacity
            style={[
              styles.quickActionBtn,
              { backgroundColor: t.colors.brandPrimarySubtle },
            ]}
            onPress={onQuickAction}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.quickActionText,
                { color: t.colors.brandPrimary },
              ]}
            >
              {quickActionLabel}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={onMorePress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={16} color={t.colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginVertical: 4,
    shadowColor: 'rgba(0, 0, 0, 0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
  },
  codeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 9,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingLeft: 2,
  },
  locationText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: '75%',
  },
  contactText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  moreBtn: {
    padding: 4,
  },
});

export default EmployeeCard;
