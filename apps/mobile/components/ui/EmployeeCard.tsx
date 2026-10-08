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
  attendanceStatus?: 'present' | 'late' | 'not_recorded' | 'needs_review' | 'checked_out';
  isCheckedIn?: boolean;
  isCheckedOut?: boolean;
  isLate?: boolean;
  needsReview?: boolean;
  reviewStatus?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  lateMinutes?: number;
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

  // Determine badge styling based on real attendance state
  let badgeBg = t.colors.surfaceSunken;
  let badgeBorder = t.colors.borderDefault;
  let badgeDot = t.colors.textTertiary;
  let badgeText = t.colors.textSecondary;
  let badgeLabel = 'Not Clocked In';

  if (employee.attendanceStatus) {
    if (employee.isCheckedOut || employee.attendanceStatus === 'checked_out') {
      badgeBg = '#EFF6FF';
      badgeBorder = '#BFDBFE';
      badgeDot = '#3B82F6';
      badgeText = '#1D4ED8';
      badgeLabel = 'Punched Out';
    } else if (employee.isCheckedIn || employee.attendanceStatus === 'present' || employee.attendanceStatus === 'late') {
      badgeBg = '#ECFDF5';
      badgeBorder = '#A7F3D0';
      badgeDot = '#10B981';
      badgeText = '#047857';
      badgeLabel = 'On Duty';
    } else {
      badgeBg = '#F3F4F6';
      badgeBorder = '#E5E7EB';
      badgeDot = '#9CA3AF';
      badgeText = '#4B5563';
      badgeLabel = 'Not Clocked In';
    }
  }

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
              {/* {employee.code && (
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
              )} */}
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

        {/* Dynamic Status Badge */}
        {employee.attendanceStatus ? (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: badgeBg, borderColor: badgeBorder },
            ]}
          >
            <View
              style={[
                styles.pulseDot,
                { backgroundColor: badgeDot },
              ]}
            />
            <Text style={[styles.statusText, { color: badgeText }]}>
              {badgeLabel}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  employee.status === 'active'
                    ? t.colors.accentPositiveBg
                    : t.colors.surfaceSunken,
                borderColor:
                  employee.status === 'active'
                    ? t.colors.accentPositiveBorder
                    : t.colors.borderDefault,
              },
            ]}
          >
            <View
              style={[
                styles.pulseDot,
                {
                  backgroundColor:
                    employee.status === 'active'
                      ? t.colors.accentPositive
                      : t.colors.textTertiary,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    employee.status === 'active'
                      ? t.colors.status.success.text
                      : t.colors.textSecondary,
                },
              ]}
            >
              {employee.status === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </View>
        )}
      </View>

      {/* Exception & Late Flags */}
      {(employee.isLate || employee.needsReview) && (
        <View style={styles.flagRow}>
          {employee.needsReview && (
            <View style={styles.reviewFlag}>
              <Text style={styles.reviewFlagText}>Outside Geofence (Review)</Text>
            </View>
          )}
          {employee.isLate && (
            <View style={styles.lateFlag}>
              <Text style={styles.lateFlagText}>
                Late ({employee.lateMinutes}m)
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Location & Shift Timings */}
      {(employee.location || employee.checkInTime) && (
        <View style={styles.locationRow}>
          {employee.location && (
            <View style={styles.metaItem}>
              <MapPin size={11} color={t.colors.textTertiary} />
              <Text
                style={[styles.locationText, { color: t.colors.textSecondary }]}
                numberOfLines={1}
              >
                {employee.location}
              </Text>
            </View>
          )}
          {employee.checkInTime && (
            <Text style={[styles.locationText, { color: t.colors.textTertiary }]}>
              • In: {employee.checkInTime}{employee.checkOutTime ? ` → Out: ${employee.checkOutTime}` : ''}
            </Text>
          )}
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
  flagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  reviewFlag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reviewFlagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  lateFlag: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lateFlagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingLeft: 2,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '500',
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
