import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Camera, MapPin, FileText, Receipt } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface FieldToolkitProps {
  onStockProof?: () => void;
  onStoreVisit?: () => void;
  onGatePass?: () => void;
  onExpense?: () => void;
}

/**
 * Field Toolkit Quick Action Grid
 * From Stitch "FlowHRMS - Mobile Home Screen" (§field-quick-actions).
 * Provides one-tap access for field & warehouse operations: Stock Proof, Store Visit, Gate Pass, Expense.
 */
export function FieldToolkit({
  onStockProof,
  onStoreVisit,
  onGatePass,
  onExpense,
}: FieldToolkitProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const tools = [
    {
      label: 'Stock Proof',
      icon: Camera,
      bg: '#EEF2FF',
      color: '#4F46E5',
      onPress: onStockProof,
    },
    {
      label: 'Store Visit',
      icon: MapPin,
      bg: '#FEF3C7',
      color: '#D97706',
      onPress: onStoreVisit,
    },
    {
      label: 'Gate Pass',
      icon: FileText,
      bg: '#ECFDF5',
      color: '#059669',
      onPress: onGatePass,
    },
    {
      label: 'Expense',
      icon: Receipt,
      bg: '#F3E8FF',
      color: '#7C3AED',
      onPress: onExpense,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.heading, { color: t.colors.textSecondary }]}>
        FIELD TOOLKIT
      </Text>

      <View style={styles.grid}>
        {tools.map((item, idx) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.itemCard,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.borderDefault,
                },
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: item.bg },
                ]}
              >
                <Icon size={19} color={item.color} />
              </View>
              <Text
                style={[styles.itemLabel, { color: t.colors.textPrimary }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    gap: 8,
  },
  itemCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default FieldToolkit;
