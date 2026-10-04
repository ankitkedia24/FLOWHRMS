import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  UserCheck,
  Plus,
  Edit2,
  Power,
  X,
  Check,
  Shield,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { orgService } from '@/lib/api-service';

interface Designation {
  id: string;
  name: string;
  accessLevel: string;
  count: number;
  enabled: boolean;
}

/**
 * FlowHRMS - Mobile Designations Screen
 * Stitch Screen: FlowHRMS - Mobile Designations Screen
 */
export default function DesignationsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [designations, setDesignations] = useState<Designation[]>([
    { id: 'des-1', name: 'Employee', accessLevel: 'Employee access', count: 2, enabled: true },
    { id: 'des-2', name: 'Team Leader', accessLevel: 'Team Leader access', count: 0, enabled: true },
    { id: 'des-3', name: 'Manager', accessLevel: 'Manager access', count: 0, enabled: true },
    { id: 'des-4', name: 'HR', accessLevel: 'HR access', count: 0, enabled: true },
    { id: 'des-5', name: 'Admin', accessLevel: 'Admin access', count: 0, enabled: true },
    { id: 'des-6', name: 'Super Admin', accessLevel: 'Super Admin access', count: 1, enabled: true },
    { id: 'des-7', name: 'Viewer', accessLevel: 'Viewer access', count: 0, enabled: false },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formAccess, setFormAccess] = useState('Employee');

  const accessOptions = [
    'Employee',
    'Team Leader',
    'Manager',
    'HR',
    'Admin',
    'Super Admin',
    'Viewer',
  ];

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormName('');
    setFormAccess('Employee');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (d: Designation) => {
    setEditingId(d.id);
    setFormName(d.name);
    setFormAccess(d.accessLevel.replace(' access', ''));
    setIsModalOpen(true);
  };

  const handleToggle = (id: string) => {
    setDesignations(
      designations.map((d) => {
        if (d.id === id) {
          const next = !d.enabled;
          toast.info(`Designation "${d.name}" is now ${next ? 'enabled' : 'turned off'}.`);
          return { ...d, enabled: next };
        }
        return d;
      })
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a designation name.');
      return;
    }
    if (editingId) {
      setDesignations(
        designations.map((d) =>
          d.id === editingId
            ? {
                ...d,
                name: formName.trim(),
                accessLevel: `${formAccess} access`,
              }
            : d
        )
      );
      toast.success(`Designation "${formName.trim()}" updated.`);
    } else {
      const newD: Designation = {
        id: `des-${Date.now()}`,
        name: formName.trim(),
        accessLevel: `${formAccess} access`,
        count: 0,
        enabled: true,
      };
      try {
        await orgService.createDesignation({
          title: newD.name,
          accessLevel: formAccess,
        });
      } catch {
        // Fallback
      }
      setDesignations([...designations, newD]);
      toast.success(`Designation "${newD.name}" added successfully.`);
    }
    setIsModalOpen(false);
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: t.colors.surfaceCanvasWarm },
      ]}
      edges={['top', 'left', 'right']}
    >
      {/* Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderBottomColor: t.colors.borderDefault,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={t.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerSubtitle, { color: t.colors.brandPrimary }]}>
            CONFIGURATION • ROLES
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Designations
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.addHeaderBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={handleOpenAdd}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addHeaderBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Description Banner */}
        <View style={styles.descCard}>
          <Text style={[styles.descText, { color: t.colors.textSecondary }]}>
            Your job titles — Delivery Executive, Store Manager, Accountant — each with the access
            it gives in FlowHRMS. Pick one when you add a person; what they can see follows from it.
          </Text>

          <TouchableOpacity
            style={[
              styles.addBtnCta,
              { backgroundColor: t.colors.brandPrimary },
            ]}
            onPress={handleOpenAdd}
          >
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.addBtnCtaText}>Add a designation</Text>
          </TouchableOpacity>
        </View>

        {/* Designation List Card */}
        <Card style={styles.listCard}>
          {designations.map((d, index) => (
            <View
              key={d.id}
              style={[
                styles.itemRow,
                index < designations.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.borderSubtle,
                },
                !d.enabled && { opacity: 0.6 },
              ]}
            >
              <View style={styles.itemInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.itemName, { color: t.colors.textPrimary }]}>
                    {d.name}
                  </Text>
                  {!d.enabled && (
                    <View style={[styles.offBadge, { backgroundColor: t.colors.surfaceSunken }]}>
                      <Text style={[styles.offBadgeText, { color: t.colors.textTertiary }]}>
                        OFF
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                  {d.accessLevel} • {d.count} people
                </Text>
              </View>

              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={[
                    styles.editBtn,
                    {
                      backgroundColor: t.colors.surfaceDefault,
                      borderColor: t.colors.borderDefault,
                    },
                  ]}
                  onPress={() => handleOpenEdit(d)}
                >
                  <Text style={[styles.editBtnText, { color: t.colors.textPrimary }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.toggleBtn}
                  onPress={() => handleToggle(d.id)}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      { color: d.enabled ? t.colors.brandPrimary : t.colors.accentPositive },
                    ]}
                  >
                    {d.enabled ? 'Turn off' : 'Turn on'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>

      {/* Add / Edit Designation Modal */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: t.colors.surfaceDefault },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: t.colors.borderSubtle }]}>
              <View>
                <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                  {editingId ? 'Edit Designation' : 'Add Designation'}
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                  Set role name and inherited access level
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={t.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Name */}
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: t.colors.textPrimary }]}>
                  Designation Title <Text style={{ color: t.colors.status.error.fg }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      borderColor: t.colors.borderDefault,
                      color: t.colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Senior Delivery Partner, Field Executive"
                  placeholderTextColor={t.colors.textTertiary}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              {/* Inherited Access Level */}
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: t.colors.textPrimary }]}>
                  Inherited Access Level
                </Text>
                <ScrollView style={styles.accessListScroll}>
                  {accessOptions.map((opt) => {
                    const isSelected = formAccess === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.accessOption,
                          {
                            backgroundColor: isSelected
                              ? t.colors.brandPrimarySubtle
                              : t.colors.surfaceCanvas,
                            borderColor: isSelected
                              ? t.colors.brandPrimary
                              : t.colors.borderDefault,
                          },
                        ]}
                        onPress={() => setFormAccess(opt)}
                      >
                        <Text
                          style={[
                            styles.accessOptionText,
                            {
                              color: isSelected
                                ? t.colors.brandPrimary
                                : t.colors.textPrimary,
                            },
                          ]}
                        >
                          {opt} Access
                        </Text>
                        {isSelected && <Check size={14} color={t.colors.brandPrimary} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Actions */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: t.colors.brandPrimary },
                  ]}
                  onPress={handleSave}
                >
                  <Text style={styles.saveBtnText}>Save Designation</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    { borderColor: t.colors.borderDefault },
                  ]}
                  onPress={() => setIsModalOpen(false)}
                >
                  <Text style={[styles.cancelBtnText, { color: t.colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  addHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  descCard: {
    marginBottom: 16,
  },
  descText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  addBtnCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  addBtnCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  listCard: {
    padding: 0,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  itemInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  offBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  offBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  toggleBtn: {
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  toggleBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  modalBody: {
    gap: 16,
  },
  modalField: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  accessListScroll: {
    maxHeight: 180,
  },
  accessOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  accessOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
