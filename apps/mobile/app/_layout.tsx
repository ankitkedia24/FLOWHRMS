import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { FlowTheme, FlowThemeDark } from '@/constants/Theme';
import { ToastProvider } from '@/components/ui/Toast';
import { AuthProvider } from '@/lib/auth-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that app initialization starts at the Splash Screen for session verification
  initialRouteName: 'splash',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/**
 * FlowHRMS custom navigation theme.
 * Matches the web's employee surface (warm canvas) in light mode,
 * and the web's [data-theme="dark"] in dark mode.
 */
const FlowLightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: FlowTheme.colors.brandPrimary,
    background: FlowTheme.colors.surfaceCanvasWarm,
    card: FlowTheme.colors.surfaceDefault,
    text: FlowTheme.colors.textPrimary,
    border: FlowTheme.colors.borderDefault,
    notification: FlowTheme.colors.status.error.fg,
  },
};

const FlowDarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: FlowThemeDark.colors.brandPrimary,
    background: FlowThemeDark.colors.surfaceCanvas,
    card: FlowThemeDark.colors.surfaceDefault,
    text: FlowThemeDark.colors.textPrimary,
    border: FlowThemeDark.colors.borderDefault,
    notification: FlowThemeDark.colors.status.error.fg,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <AuthProvider>
      <ThemeProvider value={isDark ? FlowDarkNavTheme : FlowLightNavTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ToastProvider>
          <Stack initialRouteName="splash">
            <Stack.Screen name="splash" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="payroll" options={{ headerShown: false }} />
            <Stack.Screen name="daily-report" options={{ headerShown: false }} />
            <Stack.Screen name="reports" options={{ headerShown: false }} />
            <Stack.Screen name="documents" options={{ headerShown: false }} />
            <Stack.Screen name="payslips" options={{ headerShown: false }} />
            <Stack.Screen name="activity-log" options={{ headerShown: false }} />
            <Stack.Screen name="departments" options={{ headerShown: false }} />
            <Stack.Screen name="designations" options={{ headerShown: false }} />
            <Stack.Screen name="access-levels" options={{ headerShown: false }} />
            <Stack.Screen name="attendance-rules" options={{ headerShown: false }} />
            <Stack.Screen name="module-management" options={{ headerShown: false }} />
            <Stack.Screen name="company-settings" options={{ headerShown: false }} />
            <Stack.Screen name="subscription" options={{ headerShown: false }} />
            <Stack.Screen name="id-card" options={{ headerShown: false }} />
            <Stack.Screen name="account" options={{ headerShown: false }} />
            <Stack.Screen name="consent" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
