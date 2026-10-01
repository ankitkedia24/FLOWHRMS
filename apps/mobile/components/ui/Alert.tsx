import React, { ReactNode } from 'react';
import { StyleSheet, View, Text, type ViewStyle } from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react-native';
import { getTheme, type StatusTone } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Alert (component-specifications.md §21).
 * info / warning / error / success / consequence — same tone system as chips.
 */
export interface AlertProps {
  tone: StatusTone;
  children: string | ReactNode;
  style?: ViewStyle;
}

const toneIcons: Record<StatusTone, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle2,
  neutral: Info,
};

export function Alert({ tone, children, style }: AlertProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const toneColors = t.colors.status[tone];
  const Icon = toneIcons[tone];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: toneColors.bg,
          borderColor: toneColors.border,
          borderRadius: t.radius.input,
        },
        style,
      ]}
      accessibilityRole="alert"
    >
      <Icon size={18} color={toneColors.fg} style={styles.icon} />
      {typeof children === 'string' ? (
        <Text
          style={[
            t.typography.secondary,
            { color: toneColors.text, flex: 1 },
          ]}
        >
          {children}
        </Text>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  icon: {
    marginTop: 1,
  },
  content: {
    flex: 1,
  },
});
