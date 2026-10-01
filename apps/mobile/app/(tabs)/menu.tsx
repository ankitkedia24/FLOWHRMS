import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { NavigationHub } from '@/components/ui/NavigationHub';
import { ConsentModal } from '@/components/ui/ConsentModal';

/**
 * Menu Tab Screen
 * Mounts the NavigationHub component from Stitch.
 */
export default function MenuScreen() {
  const [consentVisible, setConsentVisible] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of FlowHRMS?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => {} },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <NavigationHub
        userName="Rishabh"
        userRole="Owner"
        employeeCode="EMP-0001"
        workspaceName="FX & Float Logistics"
        trialDaysLeft={26}
        onSignOut={handleSignOut}
        onConsentPress={() => setConsentVisible(true)}
      />

      <ConsentModal
        visible={consentVisible}
        userName="Rishabh"
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
