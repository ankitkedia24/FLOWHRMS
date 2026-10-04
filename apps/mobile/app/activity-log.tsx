import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Shield,
  Search,
  Filter,
  Info,
  Clock,
  User,
  Building,
  CheckCircle2,
  LogIn,
  LogOut,
  ToggleLeft,
  ToggleRight,
  FileText,
  ChevronDown,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

interface AuditEvent {
  id: string;
  title: string;
  actor: string;
  role: string;
  timestamp: string;
  category: 'company' | 'designation' | 'attendance' | 'consent' | 'system';
  icon: any;
  tone: 'info' | 'success' | 'warning' | 'neutral';
  details: string;
  metaDiff?: { before?: string; after?: string };
}

/**
 * FlowHRMS - Mobile Activity Log Screen
 * Stitch Screen: FlowHRMS - Mobile Activity Log Screen
 */
export default function ActivityLogScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All (6)' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'designation', label: 'Designation' },
    { id: 'company', label: 'Company' },
    { id: 'consent', label: 'Consent' },
  ];

  const events: AuditEvent[] = [
    {
      id: 'evt-1',
      title: 'Company details changed',
      actor: 'Rishabh',
      role: 'Owner',
      timestamp: 'Today at 09:10',
      category: 'company',
      icon: Building,
      tone: 'info',
      details: 'Updated official workspace profile and contact details.',
      metaDiff: { before: 'FX & Float', after: 'FX & Float Logistics' },
    },
    {
      id: 'evt-2',
      title: 'Designation turned off',
      actor: 'Super Admin',
      role: 'Admin',
      timestamp: 'Yesterday at 16:45',
      category: 'designation',
      icon: ToggleLeft,
      tone: 'warning',
      details: 'Turned off designation "Viewer". Blocked new user assignment.',
    },
    {
      id: 'evt-3',
      title: 'Designation turned on',
      actor: 'Super Admin',
      role: 'Admin',
      timestamp: '2 Oct 2026, 11:20',
      category: 'designation',
      icon: ToggleRight,
      tone: 'success',
      details: 'Enabled designation "Field Executive" with mobile access privileges.',
    },
    {
      id: 'evt-4',
      title: 'Checked out',
      actor: 'Manas Mody',
      role: 'Core Team',
      timestamp: '3 Oct 2026, 18:32',
      category: 'attendance',
      icon: LogOut,
      tone: 'neutral',
      details: 'Verified checkout via GPS geofence. Total duration 9h 04m.',
    },
    {
      id: 'evt-5',
      title: 'Checked in',
      actor: 'Manas Mody',
      role: 'Core Team',
      timestamp: '3 Oct 2026, 09:28',
      category: 'attendance',
      icon: LogIn,
      tone: 'success',
      details: 'Check-in on time at Main Hub. Accuracy: 8m.',
    },
    {
      id: 'evt-6',
      title: 'Consent given',
      actor: 'Rishabh',
      role: 'Owner',
      timestamp: '27 Sep 2026, 10:00',
      category: 'consent',
      icon: Shield,
      tone: 'info',
      details: 'Signed FlowHRMS Terms, Privacy Policy & DPDP Act compliance v1.0.',
    },
  ];

  const filteredEvents = events.filter((e) => {
    const matchCat = activeCategory === 'all' || e.category === activeCategory;
    const matchQuery =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.details.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

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
            CONFIGURATION / AUDIT LOGS
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Activity log
          </Text>
        </View>
        <View style={styles.liveTag}>
          <View style={[styles.liveDot, { backgroundColor: t.colors.accentPositive }]} />
          <Text style={[styles.liveText, { color: t.colors.accentPositive }]}>Live feed</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Immutability Notice Box */}
        <View
          style={[
            styles.immutableBanner,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderLeftColor: t.colors.brandPrimary,
              borderColor: t.colors.borderDefault,
            },
          ]}
        >
          <View style={styles.bannerRow}>
            <Info size={16} color={t.colors.brandPrimary} style={styles.bannerIcon} />
            <View style={styles.bannerText}>
              <Text style={[styles.bannerTitle, { color: t.colors.textPrimary }]}>
                Audit events are immutable
              </Text>
              <Text style={[styles.bannerDesc, { color: t.colors.textSecondary }]}>
                Audit events cannot be edited or deleted. Every entry keeps who acted, what
                changed, when, and the reason given.
              </Text>
            </View>
          </View>
        </View>

        {/* Search Field */}
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.borderDefault,
            },
          ]}
        >
          <Search size={16} color={t.colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: t.colors.textPrimary }]}
            placeholder="Search events, actors, or records..."
            placeholderTextColor={t.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catPill,
                  {
                    backgroundColor: active
                      ? t.colors.brandPrimary
                      : t.colors.surfaceDefault,
                    borderColor: active
                      ? t.colors.brandPrimary
                      : t.colors.borderDefault,
                  },
                ]}
                onPress={() => setActiveCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.catPillText,
                    { color: active ? '#FFFFFF' : t.colors.textSecondary },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Timeline Events List */}
        <View style={styles.timelineList}>
          {filteredEvents.map((evt) => {
            const Icon = evt.icon;
            const isExpanded = expandedId === evt.id;
            return (
              <Card key={evt.id} style={styles.eventCard}>
                <TouchableOpacity
                  onPress={() => setExpandedId(isExpanded ? null : evt.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.eventTop}>
                    <View style={styles.eventLeft}>
                      <View
                        style={[
                          styles.eventIconBox,
                          { backgroundColor: t.colors.brandPrimarySubtle },
                        ]}
                      >
                        <Icon size={18} color={t.colors.brandPrimary} />
                      </View>
                      <View style={styles.eventTitles}>
                        <Text style={[styles.eventTitle, { color: t.colors.textPrimary }]}>
                          {evt.title}
                        </Text>
                        <Text style={[styles.eventMeta, { color: t.colors.textTertiary }]}>
                          {evt.actor} ({evt.role}) • {evt.timestamp}
                        </Text>
                      </View>
                    </View>
                    <ChevronDown
                      size={16}
                      color={t.colors.textTertiary}
                      style={{
                        transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                      }}
                    />
                  </View>

                  <Text
                    style={[
                      styles.eventDetails,
                      { color: t.colors.textSecondary },
                    ]}
                  >
                    {evt.details}
                  </Text>

                  {/* Expanded Diff Metadata */}
                  {isExpanded && evt.metaDiff && (
                    <View
                      style={[
                        styles.diffBox,
                        {
                          backgroundColor: t.colors.surfaceCanvas,
                          borderColor: t.colors.borderSubtle,
                        },
                      ]}
                    >
                      <Text style={[styles.diffLabel, { color: t.colors.textTertiary }]}>
                        METADATA DIFF
                      </Text>
                      {evt.metaDiff.before && (
                        <Text style={[styles.diffBefore, { color: t.colors.status.error.fg }]}>
                          - {evt.metaDiff.before}
                        </Text>
                      )}
                      {evt.metaDiff.after && (
                        <Text style={[styles.diffAfter, { color: t.colors.status.success.fg }]}>
                          + {evt.metaDiff.after}
                        </Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </Card>
            );
          })}
        </View>
      </ScrollView>
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
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  immutableBanner: {
    borderLeftWidth: 4,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bannerIcon: {
    marginTop: 2,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  categoryScroll: {
    marginBottom: 14,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timelineList: {
    gap: 0,
  },
  eventCard: {
    padding: 14,
    marginBottom: 10,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  eventIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitles: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  eventMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  eventDetails: {
    fontSize: 12,
    lineHeight: 16,
  },
  diffBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  diffLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  diffBefore: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  diffAfter: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
});
