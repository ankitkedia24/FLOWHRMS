import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Clock } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface TrialBannerProps {
  daysLeft?: number;
  endDateStr?: string;
  onChoosePlan?: () => void;
}

/**
 * Free Trial Countdown Banner
 * As specified in Stitch designs across Home, Attendance, Employees, and Menu screens.
 */
export function TrialBanner({
  daysLeft = 26,
  endDateStr = '27 Oct',
  onChoosePlan,
}: TrialBannerProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: t.colors.brandPrimarySubtle,
          borderBottomColor: t.colors.brandPrimarySubtleHover,
        },
      ]}
    >
      <View style={styles.leftContent}>
        <View
          style={[
            styles.pulseDot,
            { backgroundColor: t.colors.brandPrimary },
          ]}
        />
        <Text style={[styles.text, { color: t.colors.textSecondary }]}>
          Free trial:{' '}
          <Text style={[styles.boldText, { color: t.colors.textPrimary }]}>
            {daysLeft} days left
          </Text>{' '}
          (ends {endDateStr})
        </Text>
      </View>

      <TouchableOpacity
        onPress={onChoosePlan}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.actionText, { color: t.colors.brandPrimary }]}>
          Choose plan
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default TrialBanner;
