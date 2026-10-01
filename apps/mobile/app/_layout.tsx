import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { FlowTheme, FlowThemeDark } from '@/constants/Theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
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
    <ThemeProvider value={isDark ? FlowDarkNavTheme : FlowLightNavTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
