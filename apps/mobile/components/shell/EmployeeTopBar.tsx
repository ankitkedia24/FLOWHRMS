import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { FlowacordMark } from '@/components/brand/FlowacordMark';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface EmployeeTopBarProps {
  title?: string;
  subtitle?: string;
  unreadCount?: number;
  onNotificationPress?: () => void;
}

export function EmployeeTopBar({
  title = 'FlowHRMS',
  subtitle = 'Field',
  unreadCount = 2,
  onNotificationPress,
}: EmployeeTopBarProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.colors.surfaceDefault,
          borderBottomColor: t.colors.borderDefault,
          paddingTop: insets.top,
          height: 56 + insets.top,
        },
      ]}
    >
      <View style={styles.brandRow}>
        <FlowacordMark size={24} />
        <View style={styles.titleWrap}>
          <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[t.typography.caption, { color: t.colors.brandPrimary, fontWeight: '700', marginLeft: 6 }]}>
              · {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <TouchableOpacity
        style={styles.bellButton}
        onPress={onNotificationPress}
        activeOpacity={0.7}
        accessibilityLabel="Notifications"
      >
        <Bell size={20} color={t.colors.textPrimary} />
        {unreadCount > 0 && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: t.colors.status.error.fg,
                borderColor: t.colors.surfaceDefault,
              },
            ]}
          >
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
