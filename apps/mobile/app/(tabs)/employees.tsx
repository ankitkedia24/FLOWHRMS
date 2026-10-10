import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  UserPlus,
  Printer,
  Share2,
  ChevronRight,
  Users,
  X,
  Mail,
  Phone,
  Briefcase,
  Building,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { EmployeeCard, EmployeeData } from '@/components/ui/EmployeeCard';
import { useToast } from '@/components/ui/Toast';
import { employeesService } from '@/lib/api-service';
import { useAuth } from '@/lib/auth-context';

export default function EmployeesScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeLeft, setIncludeLeft] = useState(false);

  // Add Employee Modal Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formDepartment, setFormDepartment] = useState('Operations');
  const [formRole, setFormRole] = useState<'Employee' | 'Admin'>('Employee');

  const loadEmployees = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await employeesService.getEmployees(includeLeft);
      if (res.success && Array.isArray(res.data?.employees)) {
        setEmployees(res.data.employees);
      }
    } catch {
      toast.error('Connection Error', 'Could not load staff directory.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [includeLeft, toast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const handleRefresh = () => {
    loadEmployees(true);
  };

  const handleAddEmployeeSubmit = async () => {
    if (!formName.trim()) {
      toast.error('Required Field', 'Please enter employee name.');
      return;
    }
    if (!formEmail.trim() || !formEmail.includes('@')) {
      toast.error('Invalid Email', 'Please enter a valid work email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await employeesService.inviteEmployee({
        name: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        phone: formPhone.trim(),
        designation: formDesignation.trim() || 'Field Specialist',
        department: formDepartment.trim() || 'Operations',
        role: formRole,
      });

      if (res.success) {
        toast.success(
          'Employee Added',
          `${formName} added to directory. Login invitation generated.`
        );
        setIsAddModalOpen(false);
        setFormName('');
        setFormEmail('');
        setFormPhone('');
        setFormDesignation('');
        // Reload list directly from PostgreSQL
        await loadEmployees(true);
      } else {
        toast.error('Failed to Add', res.error || 'Could not add team member.');
      }
    } catch {
      toast.error('Network Error', 'Please check your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShareInvite = () => {
    const slug = user?.tenant?.code?.toLowerCase() || 'demo';
    toast.success(
      'Invite Link Copied',
      `Joining link copied: https://flowhrms.in/join/${slug}`
    );
  };

  const filteredEmployees = employees.filter((emp) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (emp.name && emp.name.toLowerCase().includes(query)) ||
      (emp.phone && emp.phone.includes(query)) ||
      (emp.email && emp.email.toLowerCase().includes(query)) ||
      (emp.code && emp.code.toLowerCase().includes(query)) ||
      (emp.role && emp.role.toLowerCase().includes(query))
    );
  });

  return (
    <View style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={t.colors.brandPrimary}
            colors={[t.colors.brandPrimary]}
          />
        }
      >
        {/* Title & Top Action Row */}
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.heading, { color: t.colors.brandNavy }]}>
              Employees
            </Text>
            <Text style={[styles.subheading, { color: t.colors.textSecondary }]}>
              Live organization directory & presence
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.printButton,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => router.push('/id-card' as any)}
          >
            <Printer size={14} color={t.colors.textSecondary} />
            <Text style={[styles.printButtonText, { color: t.colors.textPrimary }]}>
              Print ID cards
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add Employee Primary CTA */}
        <TouchableOpacity
          style={[
            styles.addEmployeeBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          activeOpacity={0.85}
          onPress={() => setIsAddModalOpen(true)}
        >
          <UserPlus size={16} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.addEmployeeBtnText}>Add employee</Text>
        </TouchableOpacity>

        {/* Search & Filter Card */}
        <View
          style={[
            styles.filterCard,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.borderDefault,
            },
          ]}
        >
          <Text style={[styles.searchLabel, { color: t.colors.textPrimary }]}>
            Search Directory
          </Text>
          <View
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: t.colors.surfaceSunken,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <Search size={16} color={t.colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: t.colors.textPrimary }]}
              placeholder="Search by name, phone, code or email..."
              placeholderTextColor={t.colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={t.colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.searchHelp, { color: t.colors.textTertiary }]}>
            Live match against registered workforce.
          </Text>

          {/* Filter Checkbox */}
          <View
            style={[
              styles.filterRow,
              { borderTopColor: t.colors.borderSubtle },
            ]}
          >
            <View style={styles.switchGroup}>
              <Switch
                value={includeLeft}
                onValueChange={setIncludeLeft}
                trackColor={{
                  false: t.colors.surfaceDisabled,
                  true: t.colors.brandPrimary,
                }}
                thumbColor="#FFFFFF"
              />
              <Text style={[styles.filterText, { color: t.colors.textPrimary }]}>
                Include inactive / departed staff
              </Text>
            </View>
            <Text style={[styles.counterText, { color: t.colors.textTertiary }]}>
              {filteredEmployees.length} of {employees.length}
            </Text>
          </View>
        </View>

        {/* Loading Indicator */}
        {isLoading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={t.colors.brandPrimary} />
            <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>
              Loading team directory...
            </Text>
          </View>
        ) : filteredEmployees.length === 0 ? (
          /* Empty State */
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <Users size={32} color={t.colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: t.colors.textPrimary }]}>
              {searchQuery ? 'No matching employees' : 'No staff members registered'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: t.colors.textSecondary }]}>
              {searchQuery
                ? 'Try searching with a different name, code, or phone number.'
                : 'Tap "Add employee" above to invite your first team member.'}
            </Text>
          </View>
        ) : (
          /* Employee Cards List */
          <View style={styles.listSection}>
            {filteredEmployees.map((emp) => (
              <EmployeeCard key={emp.id} employee={emp} />
            ))}
          </View>
        )}

        {/* Onboarding Invite Helper Card */}
        <View
          style={[
            styles.inviteCard,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleHover,
            },
          ]}
        >
          <View
            style={[
              styles.inviteIconCircle,
              { backgroundColor: t.colors.surfaceDefault },
            ]}
          >
            <Share2 size={16} color={t.colors.brandPrimary} />
          </View>
          <Text style={[styles.inviteTitle, { color: t.colors.brandNavy }]}>
            Need to onboard more staff?
          </Text>
          <Text style={[styles.inviteDesc, { color: t.colors.textSecondary }]}>
            Share an invite link or invite staff directly from this screen.
          </Text>
          <TouchableOpacity
            style={styles.shareLinkRow}
            activeOpacity={0.7}
            onPress={handleShareInvite}
          >
            <Text style={[styles.shareLinkText, { color: t.colors.brandPrimary }]}>
              Share company invite link
            </Text>
            <ChevronRight size={14} color={t.colors.brandPrimary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Employee Interactive Modal */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: t.colors.surfaceDefault },
            ]}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: t.colors.borderSubtle }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.colors.textPrimary }]}>
                  Add Team Member
                </Text>
                <Text style={[styles.modalSubtitle, { color: t.colors.textSecondary }]}>
                  Invite a new employee to your workspace
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={t.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Modal Form Content */}
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: t.colors.textPrimary }]}>
                  Full Name *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: t.colors.surfaceSunken,
                      borderColor: t.colors.borderDefault,
                      color: t.colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor={t.colors.textTertiary}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              {/* Email */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: t.colors.textPrimary }]}>
                  Work Email *
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: t.colors.surfaceSunken,
                      borderColor: t.colors.borderDefault,
                      color: t.colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. ramesh.kumar@example.com"
                  placeholderTextColor={t.colors.textTertiary}
                  value={formEmail}
                  onChangeText={setFormEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Phone */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: t.colors.textPrimary }]}>
                  Phone Number
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: t.colors.surfaceSunken,
                      borderColor: t.colors.borderDefault,
                      color: t.colors.textPrimary,
                    },
                  ]}
                  placeholder="+91 98000 00000"
                  placeholderTextColor={t.colors.textTertiary}
                  value={formPhone}
                  onChangeText={setFormPhone}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Designation */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: t.colors.textPrimary }]}>
                  Job Title / Designation
                </Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: t.colors.surfaceSunken,
                      borderColor: t.colors.borderDefault,
                      color: t.colors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Field Operations Specialist"
                  placeholderTextColor={t.colors.textTertiary}
                  value={formDesignation}
                  onChangeText={setFormDesignation}
                />
              </View>

              {/* Role Toggle */}
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: t.colors.textPrimary }]}>
                  Access Level
                </Text>
                <View style={styles.roleToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      formRole === 'Employee' && {
                        backgroundColor: t.colors.brandPrimary,
                        borderColor: t.colors.brandPrimary,
                      },
                    ]}
                    onPress={() => setFormRole('Employee')}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: formRole === 'Employee' ? '#FFFFFF' : t.colors.textPrimary },
                      ]}
                    >
                      Employee
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      formRole === 'Admin' && {
                        backgroundColor: t.colors.brandPrimary,
                        borderColor: t.colors.brandPrimary,
                      },
                    ]}
                    onPress={() => setFormRole('Admin')}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: formRole === 'Admin' ? '#FFFFFF' : t.colors.textPrimary },
                      ]}
                    >
                      Admin
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Submit CTA */}
              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  { backgroundColor: t.colors.brandPrimary },
                  isSubmitting && { opacity: 0.7 },
                ]}
                onPress={handleAddEmployeeSubmit}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Create Employee Profile</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heading: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  printButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  addEmployeeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: 'rgba(99, 102, 241, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  addEmployeeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  filterCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  searchHelp: {
    fontSize: 11,
    marginTop: 6,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyStateCard: {
    padding: 32,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 260,
  },
  listSection: {
    gap: 10,
  },
  inviteCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  inviteIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  inviteTitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  inviteDesc: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    maxWidth: 280,
  },
  shareLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  shareLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalForm: {
    marginTop: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  formInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  roleToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  roleOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
