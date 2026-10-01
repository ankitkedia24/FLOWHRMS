import React from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import {
  LayoutDashboard,
  Clock,
  Users,
  CheckSquare,
  Menu,
  CalendarDays,
  User,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { AppHeader } from '@/components/shell/AppHeader';

/**
 * Mobile Bottom Navigation (Stitch "Respectful Field Utility" 5-tab bar)
 * 5 primary navigation tabs: Dashboard, Attendance, Employees, Tasks, Menu.
 * Active = brand primary colour + 3px top indicator.
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
      {focused && (
        <View
          style={[
            styles.topIndicator,
            { backgroundColor: t.colors.brandPrimary },
          ]}
        />
      )}
      <Icon size={21} color={color as string} strokeWidth={focused ? 2.5 : 2} />
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.colors.brandPrimary,
        tabBarInactiveTintColor: t.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: t.colors.surfaceDefault,
          borderTopColor: t.colors.borderDefault,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 0,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShadowVisible: false,
        header: () => <AppHeader />,
      }}
    >
      {/* 1. Dashboard */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={LayoutDashboard} color={color} focused={focused} />
          ),
        }}
      />

      {/* 2. Attendance */}
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Clock} color={color} focused={focused} />
          ),
        }}
      />

      {/* 3. Employees */}
      <Tabs.Screen
        name="employees"
        options={{
          title: 'Employees',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Users} color={color} focused={focused} />
          ),
        }}
      />

      {/* 4. Tasks */}
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={CheckSquare} color={color} focused={focused} />
          ),
        }}
      />

      {/* 5. Menu */}
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon Icon={Menu} color={color} focused={focused} />
          ),
        }}
      />

      {/* Hidden deep-link routes */}
      <Tabs.Screen
        name="leave"
        options={{
          href: null,
          title: 'Leaves',
        }}
      />
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
    paddingTop: 6,
  },
  topIndicator: {
    position: 'absolute',
    top: 0,
    width: 36,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
});
