import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Bell, ChevronDown, Volume2, Shield } from 'lucide-react-native';
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
 * Matches Stitch "FlowHRMS - Mobile Home Screen" & "Mobile App Dashboard" header bar.
 * Contains: FlowHRMS Logo, Workspace Selector, Live Cluster Indicator, Audio & Notification controls.
 */
export function AppHeader({
  workspaceName = 'FX & Float',
  locationCluster = 'Jaipur',
  isLive = true,
  unreadCount = 2,
  onNotificationPress,
  onWorkspacePress,
  onAudioPress,
}: AppHeaderProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.colors.surfaceDefault,
          borderBottomColor: t.colors.borderSubtle,
        },
      ]}
    >
      {/* Brand logo & Workspace selector */}
      <View style={styles.leftGroup}>
        <FlowHRMSLogo width={138} height={26} variant={colorScheme === 'dark' ? 'dark' : 'light'} />

        {/* Workspace Pill */}
        <TouchableOpacity
          style={[
            styles.workspacePill,
            {
              backgroundColor: t.colors.surfaceSunken,
              borderColor: t.colors.borderDefault,
            },
          ]}
          onPress={onWorkspacePress}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.workspaceText, { color: t.colors.textPrimary }]}
            numberOfLines={1}
          >
            {workspaceName}
          </Text>
          <ChevronDown size={13} color={t.colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Right Action Icons: Live cluster pill, Audio toggle, Notification bell */}
      <View style={styles.rightGroup}>
        {isLive && (
          <View
            style={[
              styles.liveBadge,
              {
                backgroundColor: t.colors.accentPositiveBg,
                borderColor: t.colors.accentPositiveBorder,
              },
            ]}
          >
            <View style={styles.pingContainer}>
              <View
                style={[
                  styles.pingDot,
                  { backgroundColor: t.colors.accentPositive },
                ]}
              />
            </View>
            <Text
              style={[
                styles.liveText,
                { color: t.colors.status.success.text },
              ]}
            >
              {locationCluster} • LIVE
            </Text>
          </View>
        )}

        {/* Notification Bell with Badge */}
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
          <Bell size={17} color={t.colors.textSecondary} />
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
    paddingTop: Platform.OS === 'ios' ? 8 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 20,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workspacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  workspaceText: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 90,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  pingContainer: {
    width: 6,
    height: 6,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
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
