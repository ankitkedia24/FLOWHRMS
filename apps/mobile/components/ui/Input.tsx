import React, { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Input & TextArea (component-specifications.md §3).
 * - Inputs always reserve space for an error message below (no layout shift).
 * - Focus: border-focus colour.
 * - Error: border-error, error text shown below.
 */
export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  ...rest
}: InputProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[t.typography.label, { color: t.colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          {
            borderColor: error ? t.colors.status.error.fg : t.colors.borderDefault,
            borderRadius: t.radius.input,
            color: t.colors.textPrimary,
            backgroundColor: t.colors.surfaceDefault,
            fontSize: t.typography.body.fontSize,
            lineHeight: t.typography.body.lineHeight,
          },
          style,
        ]}
        placeholderTextColor={t.colors.textTertiary}
        {...rest}
      />
      {/* Reserved space for error message — prevents layout shift */}
      <View style={styles.errorContainer}>
        {error ? (
          <Text style={[t.typography.caption, { color: t.colors.status.error.fg }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function TextArea({
  label,
  error,
  containerStyle,
  style,
  ...rest
}: InputProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[t.typography.label, { color: t.colors.textSecondary, marginBottom: 6 }]}>
          {label}
        </Text>
      )}
      <TextInput
        style={[
          styles.input,
          styles.textArea,
          {
            borderColor: error ? t.colors.status.error.fg : t.colors.borderDefault,
            borderRadius: t.radius.input,
            color: t.colors.textPrimary,
            backgroundColor: t.colors.surfaceDefault,
            fontSize: t.typography.body.fontSize,
          },
          style,
        ]}
        placeholderTextColor={t.colors.textTertiary}
        multiline
        textAlignVertical="top"
        {...rest}
      />
      <View style={styles.errorContainer}>
        {error ? (
          <Text style={[t.typography.caption, { color: t.colors.status.error.fg }]}>
            {error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  textArea: {
    minHeight: 88,
    paddingTop: 12,
  },
  errorContainer: {
    minHeight: 20,
    justifyContent: 'center',
  },
});
