import React, { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { getTheme, type StatusTone } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Button (component-specifications.md §1).
 * - One primary per screen or per card.
 * - `warmSuccess` is employee-surface only (never on admin).
 * - Loading keeps the button width fixed; the control stays focusable.
 * - A disabled button always states its reason (`disabledReason`).
 */
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'outline'
  | 'danger'
  | 'dangerSubtle'
  | 'warmSuccess';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps {
  children: string | ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Required whenever `disabled` is set — every disabled control states its reason. */
  disabledReason?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  disabledReason,
  leadingIcon,
  trailingIcon,
  style,
  onPress,
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const isDisabled = disabled && !loading;

  const variantStyles: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: t.colors.brandPrimary },
    secondary: { backgroundColor: t.colors.brandPrimarySubtle },
    tertiary: { backgroundColor: 'transparent' },
    outline: {
      backgroundColor: t.colors.surfaceDefault,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
    },
    danger: { backgroundColor: t.colors.status.error.fg },
    dangerSubtle: {
      backgroundColor: t.colors.status.error.bg,
      borderWidth: 1,
      borderColor: t.colors.status.error.border,
    },
    warmSuccess: { backgroundColor: t.colors.warmAccent },
  };

  const textColors: Record<ButtonVariant, string> = {
    primary: t.colors.textOnPrimary,
    secondary: t.colors.brandPrimary,
    tertiary: t.colors.brandPrimary,
    outline: t.colors.textPrimary,
    danger: '#FFFFFF',
    dangerSubtle: t.colors.status.error.text,
    warmSuccess: '#FFFFFF',
  };

  const sizeStyles: Record<ButtonSize, ViewStyle> = {
    sm: { height: 36, paddingHorizontal: 12, borderRadius: t.radius.button },
    md: { height: 44, paddingHorizontal: 20, borderRadius: t.radius.button },
    lg: { height: 48, paddingHorizontal: 24, borderRadius: t.radius.button },
    xl: {
      height: t.layout.touchPrimaryMobileAction,
      paddingHorizontal: 24,
      borderRadius: t.radius.buttonMobilePrimary,
      width: '100%' as unknown as number,
      ...t.shadows.primaryAction,
    },
  };

  const textSizes: Record<ButtonSize, TextStyle> = {
    sm: { fontSize: t.typography.label.fontSize },
    md: { fontSize: t.typography.label.fontSize },
    lg: { fontSize: t.typography.body.fontSize, fontWeight: '600' },
    xl: { fontSize: t.typography.h3.fontSize },
  };

  const {
    flex,
    flexGrow,
    flexShrink,
    margin,
    marginTop,
    marginBottom,
    marginLeft,
    marginRight,
    marginHorizontal,
    marginVertical,
    alignSelf,
    ...innerStyle
  } = (style as any) || {};

  const outerStyle: ViewStyle = {
    ...(flex !== undefined && { flex }),
    ...(flexGrow !== undefined && { flexGrow }),
    ...(flexShrink !== undefined && { flexShrink }),
    ...(margin !== undefined && { margin }),
    ...(marginTop !== undefined && { marginTop }),
    ...(marginBottom !== undefined && { marginBottom }),
    ...(marginLeft !== undefined && { marginLeft }),
    ...(marginRight !== undefined && { marginRight }),
    ...(marginHorizontal !== undefined && { marginHorizontal }),
    ...(marginVertical !== undefined && { marginVertical }),
    ...(alignSelf !== undefined && { alignSelf }),
  };

  return (
    <View style={outerStyle}>
      <TouchableOpacity
        style={[
          styles.base,
          sizeStyles[size],
          isDisabled
            ? { backgroundColor: t.colors.surfaceDisabled }
            : variantStyles[variant],
          flex !== undefined ? { width: '100%' } : null,
          innerStyle,
        ]}
        activeOpacity={0.8}
        disabled={isDisabled || loading}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator
            color={
              variant === 'secondary' || variant === 'outline' || variant === 'tertiary'
                ? t.colors.brandPrimary
                : '#FFF'
            }
          />
        ) : (
          <View style={styles.contentRow}>
            {leadingIcon && <View style={styles.iconGap}>{leadingIcon}</View>}
            {typeof children === 'string' ? (
              <Text
                style={[
                  styles.textBase,
                  textSizes[size],
                  {
                    color: isDisabled
                      ? t.colors.textDisabled
                      : textColors[variant],
                  },
                ]}
              >
                {children}
              </Text>
            ) : (
              children
            )}
            {trailingIcon && <View style={styles.iconGapRight}>{trailingIcon}</View>}
          </View>
        )}
      </TouchableOpacity>
      {isDisabled && disabledReason ? (
        <Text style={[styles.disabledReason, { color: t.colors.textSecondary }]}>
          {disabledReason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGap: { marginRight: 8 },
  iconGapRight: { marginLeft: 8 },
  textBase: {
    fontWeight: '600',
  },
  disabledReason: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
});
