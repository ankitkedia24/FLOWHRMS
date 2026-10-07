import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { FlowHRMSLogo } from '@/components/brand/FlowHRMSLogo';

interface AppHeaderProps {
  workspaceName?: string;
  locationCluster?: string;
  isLive?: boolean;
  unreadCount?: number;
  onNotificationPress?: () => void;
  onWorkspacePress?: () => void;
  onAudioPress?: () => void;
}

/**
 * Mobile App Header Component
 * Displays clean FlowHRMS brand logo and notifications.
 * Uses safe area insets to avoid phone clock/battery/status bar overlap.
 */
export function AppHeader({
  unreadCount = 2,
  onNotificationPress,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  // Compute safe top padding so phone's status bar / notch / island never overlaps
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.colors.surfaceDefault,
          borderBottomColor: t.colors.borderSubtle,
          paddingTop: topInset + (Platform.OS === 'web' ? 10 : 8),
          minHeight: 52 + topInset,
        },
      ]}
    >
      {/* Brand logo */}
      <View style={styles.leftGroup}>
        <FlowHRMSLogo width={120} height={23} variant={colorScheme === 'dark' ? 'dark' : 'light'} />
      </View>

      {/* Right Action Icons: Notification bell */}
      <View style={styles.rightGroup}>
        <TouchableOpacity
          style={[
            styles.iconButton,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.borderDefault,
            },
          ]}
          onPress={onNotificationPress}
          activeOpacity={0.7}
          accessibilityLabel="Notifications"
        >
          <Bell size={18} color={t.colors.textSecondary} />
          {unreadCount > 0 && (
            <View
              style={[
                styles.unreadBadge,
                {
                  backgroundColor: t.colors.brandPrimary,
                  borderColor: t.colors.surfaceDefault,
                },
              ]}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 20,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});

export default AppHeader;
