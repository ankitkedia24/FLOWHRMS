import React, { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal as RNModal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  type ViewStyle,
} from 'react-native';
import { X } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Sheet / Modal (component-specifications.md §18).
 * On mobile, renders as a bottom sheet with a drag-handle affordance and
 * rounded top corners (radius-sheet: 20px). This matches the web's
 * behaviour below the md breakpoint.
 */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Destructive flows require an explicit choice — disable close button. */
  preventClose?: boolean;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  preventClose = false,
}: SheetProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  return (
    <RNModal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={preventClose ? undefined : onClose}
    >
      <View style={[styles.overlay, { backgroundColor: t.colors.surfaceOverlay }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: t.colors.surfaceRaised,
                borderTopLeftRadius: t.radius.sheet,
                borderTopRightRadius: t.radius.sheet,
              },
            ]}
          >
            {/* Drag-handle affordance */}
            <View style={styles.handleContainer}>
              <View
                style={[
                  styles.handle,
                  { backgroundColor: t.colors.borderStrong },
                ]}
              />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text
                style={[
                  t.typography.h2,
                  { color: t.colors.textPrimary, flex: 1 },
                ]}
              >
                {title}
              </Text>
              {!preventClose && (
                <TouchableOpacity
                  onPress={onClose}
                  style={[
                    styles.closeButton,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <X size={20} color={t.colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Content */}
            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {/* Footer */}
            {footer && (
              <View
                style={[
                  styles.footer,
                  { borderTopColor: t.colors.borderDefault },
                ]}
              >
                {footer}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '90%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    maxHeight: 400,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
});
