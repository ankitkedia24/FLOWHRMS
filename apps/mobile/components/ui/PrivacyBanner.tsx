import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface PrivacyBannerProps {
  title?: string;
  description?: string;
}

/**
 * Privacy & Respectful Design Banner
 * Core philosophy token in Stitch "Respectful Field Utility":
 * "Evidence, not surveillance: Location verified at check-in & check-out only. Zero background tracking during your shift."
 */
export function PrivacyBanner({
  title = 'Evidence, not surveillance:',
  description = 'Location verified at check-in & check-out only. Zero background tracking during your shift.',
}: PrivacyBannerProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.colors.brandPrimarySubtle,
          borderColor: t.colors.brandPrimarySubtleHover,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: t.colors.brandPrimary },
        ]}
      >
        <ShieldCheck size={16} color="#FFFFFF" />
      </View>

      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: t.colors.brandNavy }]}>
          {title}{' '}
          <Text style={[styles.description, { color: t.colors.textSecondary }]}>
            {description}
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
  },
  description: {
    fontWeight: '400',
    lineHeight: 17,
  },
});

export default PrivacyBanner;
