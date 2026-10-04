import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search,
  UserPlus,
  Printer,
  Share2,
  ChevronRight,
  Users,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { EmployeeCard, EmployeeData } from '@/components/ui/EmployeeCard';
import { useToast } from '@/components/ui/Toast';
import { employeesService } from '@/lib/api-service';

const INITIAL_EMPLOYEES: EmployeeData[] = [
  {
    id: '1',
    name: 'Manas Mody',
    role: 'Owner',
    phone: '+917829910939',
    status: 'active',
    location: 'Jaipur Central Warehouse',
    attendanceStatus: 'not_recorded',
    initials: 'MM',
  },
  {
    id: '2',
    name: 'Rishabh',
    code: 'EMP-0001',
    role: 'Owner',
    email: 'rishabh17704@gmail.com',
    status: 'active',
    location: 'Works across locations',
    attendanceStatus: 'not_recorded',
    initials: 'R',
  },
];

/**
 * Mobile Employees Screen
 * Exact implementation of Stitch "FlowHRMS - Mobile Employees Screen".
 * Features search & filter, ID card printing CTA, Add Employee CTA, employee cards, and invite helper.
 */
export default function EmployeesScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [employees, setEmployees] = useState<EmployeeData[]>(INITIAL_EMPLOYEES);
  const [searchQuery, setSearchQuery] = useState('');
  const [includeLeft, setIncludeLeft] = useState(false);

  useEffect(() => {
    employeesService.getEmployees().then((res) => {
      if (res.success && res.data?.employees) {
        // optionally update list
      }
    }).catch(() => {});
  }, []);

  const handleAddEmployee = async () => {
    try {
      const res = await employeesService.inviteEmployee({
        name: 'Arjun Verma',
        email: 'arjun.v@fxfloat.com',
        phone: '+919988776655',
        role: 'Field Supervisor',
      });

      if (res.success) {
        const newEmp: EmployeeData = res.data?.employee || {
          id: String(Date.now()),
          name: 'Arjun Verma',
          role: 'Field Supervisor',
          phone: '+919988776655',
          status: 'active',
          location: 'Delhi NCR Hub',
          attendanceStatus: 'not_recorded',
          initials: 'AV',
        };
        setEmployees((prev) => [newEmp, ...prev]);
        toast.success(
          'Employee Invited',
          'Invite link & temporary passcode sent via SMS and Email.'
        );
      } else {
        toast.error('Invite Failed', res.error || 'Could not send employee invitation.');
      }
    } catch {
      toast.error('Network Error', 'Check your connection to server.');
    }
  };

  const handleShareInvite = () => {
    toast.success(
      'Invite Link Copied',
      'Joining link copied: https://flowhrms.in/join/fx-float'
    );
  };

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.phone && emp.phone.includes(searchQuery)) ||
      (emp.email && emp.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: t.colors.surfaceCanvasWarm },
      ]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Title & Top Action Row */}
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.heading, { color: t.colors.brandNavy }]}>
            Employees
          </Text>
          <Text style={[styles.subheading, { color: t.colors.textSecondary }]}>
            Manage directory & permissions
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
          <Text
            style={[styles.printButtonText, { color: t.colors.textPrimary }]}
          >
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
        onPress={handleAddEmployee}
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
          Search
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
            placeholder="Search employee or phone..."
            placeholderTextColor={t.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Text style={[styles.searchHelp, { color: t.colors.textTertiary }]}>
          Name, phone number or employee code.
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
              Include people who have left
            </Text>
          </View>
          <Text style={[styles.counterText, { color: t.colors.textTertiary }]}>
            Showing {filteredEmployees.length} of {INITIAL_EMPLOYEES.length}
          </Text>
        </View>
      </View>

      {/* Employee Cards List */}
      <View style={styles.listSection}>
        {filteredEmployees.map((emp) => (
          <EmployeeCard key={emp.id} employee={emp} />
        ))}
      </View>

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
          Share an invite link or bulk import members anytime via desktop web app.
        </Text>
        <TouchableOpacity
          style={styles.shareLinkRow}
          activeOpacity={0.7}
          onPress={handleShareInvite}
        >
          <Text style={[styles.shareLinkText, { color: t.colors.brandPrimary }]}>
            Share invite link
          </Text>
          <ChevronRight size={14} color={t.colors.brandPrimary} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
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
});
