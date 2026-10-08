import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MapPin, LogOut, Plus, Check } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface CheckInHeroCardProps {
  shiftName?: string;
  shiftHours?: string;
  employeeName?: string;
  locationName?: string;
  avatarInitials?: string;
  isCheckedIn?: boolean;
  checkInTime?: string;
  onCheckOut?: () => void;
  onCheckIn?: () => void;
  onLogFieldVisit?: () => void;
}

/**
 * Check-In Hero Card
 * From Stitch "FlowHRMS - Mobile Home Screen" (§hero-checkin-card).
 * Features shift pill, vernacular greeting ("Namaste, Ramesh"), geofence-verified check-in status,
 * and quick field operational controls.
 */
export function CheckInHeroCard({
  shiftName = 'SHIFT A',
  shiftHours = '09:00 - 18:00',
  employeeName = 'Employee',
  locationName = 'Office',
  avatarInitials = 'EM',
  isCheckedIn = true,
  checkInTime = '09:12 AM',
  onCheckOut,
  onCheckIn,
  onLogFieldVisit,
}: CheckInHeroCardProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

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
      {/* Top row: Shift, Greeting, Location & Avatar */}
      <View style={styles.topRow}>
        <View style={styles.infoCol}>
          <View style={styles.shiftTagRow}>
            <View
              style={[
                styles.shiftPill,
                { backgroundColor: t.colors.brandPrimarySubtle },
              ]}
            >
              <Text
                style={[
                  styles.shiftPillText,
                  { color: t.colors.brandPrimary },
                ]}
              >
                {shiftName}
              </Text>
            </View>
            <Text style={[styles.shiftHoursText, { color: t.colors.textSecondary }]}>
              {shiftHours}
            </Text>
          </View>

          <Text style={[styles.greetingText, { color: t.colors.brandNavy }]}>
            Namaste, {employeeName}
          </Text>

          <View style={styles.locationRow}>
            <MapPin size={13} color={t.colors.textTertiary} />
            <Text
              style={[styles.locationText, { color: t.colors.textSecondary }]}
              numberOfLines={1}
            >
              {locationName}
            </Text>
          </View>
        </View>

        {/* Avatar Initials Bubble */}
        <View
          style={[
            styles.avatarBubble,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleHover,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: t.colors.brandPrimary }]}>
            {avatarInitials}
          </Text>
        </View>
      </View>

      {/* Verified Status Banner */}
      {isCheckedIn ? (
        <View
          style={[
            styles.statusBanner,
            { backgroundColor: t.colors.accentPositive },
          ]}
        >
          <View style={styles.statusLeft}>
            <View style={styles.checkCircle}>
              <Check size={16} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View>
              <Text style={styles.statusTitle}>Checked In at {checkInTime}</Text>
              <View style={styles.verifiedRow}>
                <View style={styles.verifiedDot} />
                <Text style={styles.verifiedText}>
                  Location geo-fenced & matched
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.dutyBadge}>
            <Text style={styles.dutyBadgeText}>Duty On</Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[
            styles.statusBanner,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={onCheckIn}
          activeOpacity={0.85}
        >
          <View style={styles.statusLeft}>
            <View style={styles.checkCircle}>
              <Plus size={16} color="#FFFFFF" strokeWidth={3} />
            </View>
            <View>
              <Text style={styles.statusTitle}>Tap to Punch In</Text>
              <Text style={styles.verifiedText}>
                GPS Geo-fence ready for verification
              </Text>
            </View>
          </View>

          <View style={styles.dutyBadge}>
            <Text style={[styles.dutyBadgeText, { color: t.colors.brandPrimary }]}>
              Check In
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Action Buttons: Check Out & Log Field Visit */}
      <View style={styles.actionsGrid}>
        {isCheckedIn && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryButton,
              {
                backgroundColor: t.colors.surfaceSunken,
                borderColor: t.colors.borderDefault,
              },
            ]}
            onPress={onCheckOut}
            activeOpacity={0.7}
          >
            <LogOut size={14} color={t.colors.textSecondary} />
            <Text
              style={[
                styles.actionButtonText,
                { color: t.colors.textPrimary },
              ]}
            >
              Check Out
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.primaryButton,
            { backgroundColor: t.colors.brandPrimary },
            !isCheckedIn && { flex: 1 },
          ]}
          onPress={onLogFieldVisit}
          activeOpacity={0.7}
        >
          <Plus size={14} color="#FFFFFF" />
          <Text style={[styles.actionButtonText, { color: '#FFFFFF' }]}>
            Log Field Visit
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowColor: 'rgba(30, 27, 75, 0.05)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoCol: {
    flex: 1,
    paddingRight: 8,
  },
  shiftTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  shiftPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shiftPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  shiftHoursText: {
    fontSize: 12,
    fontWeight: '500',
  },
  greetingText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '400',
  },
  avatarBubble: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBanner: {
    marginTop: 14,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#A7F3D0',
  },
  verifiedText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.88)',
  },
  dutyBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dutyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryButton: {
    shadowColor: 'rgba(99, 102, 241, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default CheckInHeroCard;
