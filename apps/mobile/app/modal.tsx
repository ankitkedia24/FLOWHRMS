import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

export default function ModalScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View style={[styles.container, { backgroundColor: t.colors.surfaceRaised }]}>
      <View style={styles.handleContainer}>
        <View style={[styles.handle, { backgroundColor: t.colors.borderStrong }]} />
      </View>
      <Text style={[t.typography.h2, { color: t.colors.textPrimary }]}>
        Modal
      </Text>
      <Text style={[t.typography.secondary, { color: t.colors.textSecondary, marginTop: 8 }]}>
        This modal matches the web's bottom-sheet pattern.
      </Text>
      {/* Use a light status bar on iOS to account for the black space above the modal */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  handleContainer: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
  },
});
