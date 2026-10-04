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
  Building,
  Plus,
  HelpCircle,
  Users,
  ChevronDown,
  X,
  Trash2,
  Check,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

interface Department {
  id: string;
  name: string;
  head: string;
  headRole: string;
  employeeCount: number;
}

/**
 * FlowHRMS - Mobile Departments Screen
 * Stitch Screen: FlowHRMS - Mobile Departments Screen
 */
export default function DepartmentsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([
    {
      id: 'dep-1',
      name: 'Operations & Logistics',
      head: 'Sarah Jenkins',
      headRole: 'Lead Ops',
      employeeCount: 2,
    },
  ]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [selectedHead, setSelectedHead] = useState('Rishabh (Owner)');

  const candidateHeads = [
    'Rishabh (Owner)',
    'Sarah Jenkins (Lead Ops)',
    'Alex Rivera (Staff Engineer)',
  ];

  const handleCreateDepartment = () => {
    if (!newDeptName.trim()) {
      Alert.alert('Required', 'Please enter a department name.');
      return;
    }
    const newDept: Department = {
      id: `dep-${Date.now()}`,
      name: newDeptName.trim(),
      head: selectedHead.split('(')[0].trim(),
      headRole: selectedHead.includes('(') ? selectedHead.split('(')[1].replace(')', '') : 'Head',
      employeeCount: 0,
    };
    setDepartments([...departments, newDept]);
    setNewDeptName('');
    setIsModalVisible(false);
    Alert.alert('Department Created', `Department "${newDept.name}" has been created.`);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Department', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDepartments(departments.filter((d) => d.id !== id));
        },
      },
    ]);
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
            CONFIGURATION • SETTINGS
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Departments
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.addHeaderBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={() => setIsModalVisible(true)}
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
        {/* Main Configuration Card */}
        <Card style={styles.cardSpacing}>
          <View style={styles.cardTopHeader}>
            <View>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Departments
              </Text>
              <Text style={[styles.cardDesc, { color: t.colors.textSecondary }]}>
                A department head sees their team's approvals alongside you. This is about who
                decides, not where people work — locations are separate.
              </Text>
            </View>
            <View style={[styles.activeTag, { backgroundColor: t.colors.surfaceSunken }]}>
              <Text style={[styles.activeTagText, { color: t.colors.textPrimary }]}>
                {departments.length} Active
              </Text>
            </View>
          </View>

          {departments.length === 0 ? (
            /* Empty State Container */
            <View style={styles.emptyContainer}>
              <View style={[styles.lavenderCircle, { backgroundColor: t.colors.brandPrimarySubtle }]}>
                <View style={[styles.pillL1, { backgroundColor: '#C4B5FD' }]} />
                <View style={[styles.pillL2, { backgroundColor: '#818CF8' }]} />
                <View style={[styles.pillL3, { backgroundColor: '#4648D4' }]} />
              </View>
              <Text style={[styles.emptyHeadline, { color: t.colors.textPrimary }]}>
                No departments yet.
              </Text>
              <Text style={[styles.emptySub, { color: t.colors.textSecondary }]}>
                You don't need them. Add them when you want a team's approvals to reach their head as
                well as you.
              </Text>

              <TouchableOpacity
                style={[
                  styles.createFirstBtn,
                  {
                    backgroundColor: t.colors.brandPrimarySubtle,
                    borderColor: t.colors.brandPrimarySubtleActive,
                  },
                ]}
                onPress={() => setIsModalVisible(true)}
              >
                <Building size={14} color={t.colors.brandPrimary} />
                <Text style={[styles.createFirstBtnText, { color: t.colors.brandPrimary }]}>
                  Create first department
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Departments List */
            <View style={styles.deptList}>
              {departments.map((dept) => (
                <View
                  key={dept.id}
                  style={[
                    styles.deptRow,
                    {
                      backgroundColor: t.colors.surfaceCanvas,
                      borderColor: t.colors.borderDefault,
                    },
                  ]}
                >
                  <View style={styles.deptLeft}>
                    <View
                      style={[
                        styles.deptIconBox,
                        { backgroundColor: t.colors.brandPrimarySubtle },
                      ]}
                    >
                      <Building size={18} color={t.colors.brandPrimary} />
                    </View>
                    <View style={styles.deptInfo}>
                      <Text style={[styles.deptName, { color: t.colors.textPrimary }]}>
                        {dept.name}
                      </Text>
                      <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                        Head: <Text style={{ color: t.colors.textSecondary }}>{dept.head}</Text> ({dept.headRole})
                      </Text>
                      <Text style={[styles.empCountText, { color: t.colors.textTertiary }]}>
                        {dept.employeeCount} active members
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteDeptBtn}
                    onPress={() => handleDelete(dept.id, dept.name)}
                  >
                    <Trash2 size={16} color={t.colors.status.error.fg} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </Card>

        {/* Hierarchy Explanation Card */}
        <Card
          style={[
            styles.hierarchyCard,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.borderDefault,
            },
          ]}
        >
          <View style={styles.hierarchyTop}>
            <HelpCircle size={18} color={t.colors.brandPrimary} />
            <Text style={[styles.hierarchyTitle, { color: t.colors.textPrimary }]}>
              How does hierarchy work?
            </Text>
          </View>
          <Text style={[styles.hierarchyText, { color: t.colors.textSecondary }]}>
            Employees assigned to a department will submit leave requests, expense reimbursements,
            and attendance adjustments to their designated Head first before reaching the Owner.
          </Text>
        </Card>
      </ScrollView>

      {/* Add Department Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalVisible(false)}
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
                  Add Department
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                  Configure department name and lead approver
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <X size={20} color={t.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Dept Name */}
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: t.colors.textPrimary }]}>
                  Department Name <Text style={{ color: t.colors.status.error.fg }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      borderColor: t.colors.borderDefault,
                      color: t.colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Sales, Marketing, Warehouse"
                  placeholderTextColor={t.colors.textTertiary}
                  value={newDeptName}
                  onChangeText={setNewDeptName}
                />
              </View>

              {/* Dept Head Selector */}
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: t.colors.textPrimary }]}>
                  Department Head <Text style={{ color: t.colors.textTertiary }}>(optional)</Text>
                </Text>
                <View style={styles.headList}>
                  {candidateHeads.map((candidate) => {
                    const isSelected = selectedHead === candidate;
                    return (
                      <TouchableOpacity
                        key={candidate}
                        style={[
                          styles.headOption,
                          {
                            backgroundColor: isSelected
                              ? t.colors.brandPrimarySubtle
                              : t.colors.surfaceCanvas,
                            borderColor: isSelected
                              ? t.colors.brandPrimary
                              : t.colors.borderDefault,
                          },
                        ]}
                        onPress={() => setSelectedHead(candidate)}
                      >
                        <Text
                          style={[
                            styles.headOptionText,
                            {
                              color: isSelected
                                ? t.colors.brandPrimary
                                : t.colors.textPrimary,
                            },
                          ]}
                        >
                          {candidate}
                        </Text>
                        {isSelected && <Check size={14} color={t.colors.brandPrimary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={[styles.headNote, { color: t.colors.textTertiary }]}>
                  Can be assigned or updated at any point later.
                </Text>
              </View>

              {/* Modal Actions */}
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.createBtn,
                    { backgroundColor: t.colors.brandPrimary },
                  ]}
                  onPress={handleCreateDepartment}
                >
                  <Text style={styles.createBtnText}>Save Department</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalCancelBtn,
                    { borderColor: t.colors.borderDefault },
                  ]}
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={[styles.modalCancelText, { color: t.colors.textSecondary }]}>
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
  cardSpacing: {
    padding: 16,
    marginBottom: 16,
  },
  cardTopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 4,
    maxWidth: 260,
  },
  activeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  lavenderCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 14,
  },
  pillL1: { width: 32, height: 7, borderRadius: 4, marginRight: 10 },
  pillL2: { width: 44, height: 7, borderRadius: 4 },
  pillL3: { width: 34, height: 7, borderRadius: 4, marginLeft: 10 },
  emptyHeadline: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 16,
    marginTop: 4,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
  },
  createFirstBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deptList: {
    gap: 10,
  },
  deptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  deptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  deptIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptInfo: {
    flex: 1,
  },
  deptName: {
    fontSize: 14,
    fontWeight: '700',
  },
  empCountText: {
    fontSize: 10,
    marginTop: 2,
  },
  deleteDeptBtn: {
    padding: 8,
  },
  hierarchyCard: {
    padding: 16,
  },
  hierarchyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  hierarchyTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  hierarchyText: {
    fontSize: 11.5,
    lineHeight: 16,
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
  headList: {
    gap: 8,
    marginTop: 4,
  },
  headOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  headOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  headNote: {
    fontSize: 10.5,
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 20,
  },
  createBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
