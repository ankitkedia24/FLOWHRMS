import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHub } from '@/components/ui/NavigationHub';
import { ConsentModal } from '@/components/ui/ConsentModal';
import { useAuth } from '@/lib/auth-context';

import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Menu Tab Screen (Main Navigation - Drawer / Hub)
 * Mounts the NavigationHub component with role-aware context.
 */
export default function MenuScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const { user, signOut } = useAuth();
  const [consentVisible, setConsentVisible] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of FlowHRMS?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const resolvedUserName = user?.name || (user?.email ? user.email.split('@')[0] : 'User');
  const resolvedWorkspace = user?.tenant?.name || 'FlowHRMS';

  return (
    <View style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}>
      <NavigationHub
        userName={resolvedUserName}
        userRole={user?.role || 'Owner'}
        employeeCode={user?.employeeCode || 'EMP-0001'}
        workspaceName={resolvedWorkspace}
        trialDaysLeft={26}
        onSignOut={handleSignOut}
        onConsentPress={() => setConsentVisible(true)}
      />

      <ConsentModal
        visible={consentVisible}
        userName={resolvedUserName}
        onAgree={() => setConsentVisible(false)}
        onDecline={() => setConsentVisible(false)}
        onClose={() => setConsentVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
