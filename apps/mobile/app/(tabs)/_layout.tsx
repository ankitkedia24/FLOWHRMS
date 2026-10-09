import React from 'react';
import { StyleSheet, View, Platform, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Clock,
  Users,
  CheckSquare,
  Menu,
  CalendarDays,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { AppHeader } from '@/components/shell/AppHeader';
import { useAuth } from '@/lib/auth-context';

/**
 * Ultra-Sleek Icon-Only Tab Item (Instagram aesthetic)
 * Clean, minimalist icon with responsive touch target and active indicator dot.
 */
function TabIcon({
  Icon,
  color,
  focused,
}: {
  Icon: any;
  color: ColorValue;
  focused: boolean;
}) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View style={styles.tabItem}>
      <View
        style={[
          styles.iconWrap,
          focused && {
            backgroundColor: t.colors.brandPrimarySubtle,
          },
        ]}
      >
        <Icon
          size={24}
          color={focused ? t.colors.brandPrimary : (color as string)}
          strokeWidth={focused ? 2.5 : 1.8}
        />
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const insets = useSafeAreaInsets();
  const { isAdmin } = useAuth();

  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;
  const barHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: t.colors.brandPrimary,
        tabBarInactiveTintColor: t.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: t.colors.surfaceDefault,
          borderTopColor: t.colors.borderSubtle,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: barHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        headerShadowVisible: false,
        header: () => <AppHeader />,
      }}
    >
      {/* 1. Admin Dashboard OR Employee Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: isAdmin ? 'Dashboard' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={LayoutDashboard} color={color} focused={focused} />
          ),
        }}
      />

      {/* 2. Attendance */}
      <Tabs.Screen
        name="attendance"
        options={{
          title: isAdmin ? 'Attendance' : 'My Punch',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Clock} color={color} focused={focused} />
          ),
        }}
      />

      {/* 3. Employees (Admin only tab) */}
      <Tabs.Screen
        name="employees"
        options={{
          title: 'Employees',
          tabBarItemStyle: !isAdmin ? { display: 'none' } : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Users} color={color} focused={focused} />
          ),
        }}
      />

      {/* 4. Leave (Primary for employees on bottom bar; Admin accesses via Menu -> Leave Management) */}
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leaves',
          tabBarItemStyle: isAdmin ? { display: 'none' } : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={CalendarDays} color={color} focused={focused} />
          ),
        }}
      />

      {/* 5. Tasks */}
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={CheckSquare} color={color} focused={focused} />
          ),
        }}
      />

      {/* 6. Menu */}
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Menu} color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden deep-link route */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
