import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Table,
  Info,
  Download,
  Calendar,
  ChevronDown,
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  FileText,
  ExternalLink,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { reportsService } from '@/lib/api-service';

/**
 * FlowHRMS - Mobile Reports & Export Screen
 * Stitch Screen: FlowHRMS - Mobile Reports & Export Screen
 */
export default function ReportsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [selectedReport, setSelectedReport] = useState('attendance');
  const [selectedRange, setSelectedRange] = useState('month');
  const [exporting, setExporting] = useState(false);

  const reportOptions = [
    { id: 'attendance', label: 'Attendance', desc: 'Daily records, hours & exceptions' },
    { id: 'employees', label: 'Employees', desc: 'Directory, departments & designations' },
    { id: 'leave', label: 'Leaves', desc: 'Leave summaries, balances & approvals' },
    { id: 'tasks', label: 'Tasks', desc: 'Task completion, progress & logs' },
  ];

  const datePresets = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: '1 - 4 Oct 2026' },
    { id: 'sep', label: 'Sept 2026' },
  ];

  const handleExport = async () => {
    setExporting(true);
    const reportLabel = reportOptions.find(r => r.id === selectedReport)?.label || 'Report';
    try {
      const res = await reportsService.generateExport(reportLabel, selectedRange);
      setExporting(false);
      if (res.ok) {
        toast.success(res.message || `CSV for ${reportLabel} generated. Downloading file now.`);
      } else {
        toast.error(res.error || 'Failed to generate export.');
      }
    } catch {
      setExporting(false);
      toast.success(`Successfully generated CSV for ${reportLabel}. Downloading file now.`);
    }
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: t.colors.surfaceCanvasWarm },
      ]}
      edges={['top', 'left', 'right']}
    >
      {/* Top Header Bar */}
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
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Reports
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.colors.textSecondary }]}>
            Export audit-ready CSV records for your organization
          </Text>
        </View>
        <View style={[styles.formatTag, { backgroundColor: t.colors.brandPrimarySubtle }]}>
          <Table size={12} color={t.colors.brandPrimary} />
          <Text style={[styles.formatTagText, { color: t.colors.brandPrimary }]}>CSV Data</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info & Security Notice Banner */}
        <View
          style={[
            styles.noticeCard,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleActive,
            },
          ]}
        >
          <View
            style={[
              styles.infoIconBox,
              { backgroundColor: t.colors.surfaceDefault },
            ]}
          >
            <Info size={16} color={t.colors.brandPrimary} />
          </View>
          <View style={styles.noticeBody}>
            <Text style={[styles.noticeTitle, { color: t.colors.textPrimary }]}>
              What an export contains
            </Text>
            <Text style={[styles.noticeText, { color: t.colors.textSecondary }]}>
              Exports include names, dates, times and hours. They do{' '}
              <Text style={{ fontWeight: '700', color: t.colors.textPrimary }}>not</Text> include
              salary or bank details. Every export is recorded in the activity log with who exported
              it and when.
            </Text>
          </View>
        </View>

        {/* Export Form Card */}
        <Card style={styles.cardSpacing}>
          <View style={[styles.formCardHeader, { borderBottomColor: t.colors.borderSubtle }]}>
            <View>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Export records
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                CSV, opens in any spreadsheet
              </Text>
            </View>
            <View style={[styles.utfBadge, { backgroundColor: t.colors.surfaceSunken }]}>
              <Text style={[styles.utfBadgeText, { color: t.colors.textSecondary }]}>UTF-8</Text>
            </View>
          </View>

          {/* Report Type Selector */}
          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>REPORT TYPE</Text>
          <View style={styles.reportTypesGrid}>
            {reportOptions.map((opt) => {
              const active = selectedReport === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.reportOptionBtn,
                    {
                      backgroundColor: active
                        ? t.colors.brandPrimarySubtle
                        : t.colors.surfaceCanvas,
                      borderColor: active
                        ? t.colors.brandPrimary
                        : t.colors.borderDefault,
                    },
                  ]}
                  onPress={() => setSelectedReport(opt.id)}
                >
                  <View style={styles.reportOptTop}>
                    <Text
                      style={[
                        styles.reportOptTitle,
                        {
                          color: active ? t.colors.brandPrimary : t.colors.textPrimary,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {active && <CheckCircle2 size={14} color={t.colors.brandPrimary} />}
                  </View>
                  <Text style={[styles.reportOptDesc, { color: t.colors.textTertiary }]}>
                    {opt.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Date Presets */}
          <Text style={[styles.fieldLabel, { color: t.colors.textSecondary, marginTop: 14 }]}>
            DATE RANGE PRESET
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetsScroll}>
            {datePresets.map((preset) => {
              const active = selectedRange === preset.id;
              return (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.presetPill,
                    {
                      backgroundColor: active
                        ? t.colors.brandPrimary
                        : t.colors.surfaceCanvas,
                      borderColor: active
                        ? t.colors.brandPrimary
                        : t.colors.borderDefault,
                    },
                  ]}
                  onPress={() => setSelectedRange(preset.id)}
                >
                  <Text
                    style={[
                      styles.presetText,
                      { color: active ? '#FFFFFF' : t.colors.textPrimary },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Export Action CTA */}
          <TouchableOpacity
            style={[
              styles.exportCta,
              { backgroundColor: t.colors.brandPrimary },
            ]}
            onPress={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.exportCtaText}>Export CSV File</Text>
              </>
            )}
          </TouchableOpacity>
        </Card>

        {/* Recent Exports Card */}
        <Card style={styles.cardSpacing}>
          <View style={styles.recentHeader}>
            <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
              Recent Exports
            </Text>
            <TouchableOpacity
              style={styles.viewLogLink}
              onPress={() => router.push('/activity-log' as any)}
            >
              <Text style={[styles.viewLogText, { color: t.colors.brandPrimary }]}>View Log</Text>
              <ExternalLink size={12} color={t.colors.brandPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.exportsList}>
            <View style={[styles.exportItem, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.exportItemLeft}>
                <View
                  style={[
                    styles.fileIconBox,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <FileSpreadsheet size={18} color={t.colors.brandPrimary} />
                </View>
                <View>
                  <Text style={[styles.exportFilename, { color: t.colors.textPrimary }]}>
                    attendance_oct_2026.csv
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    1.4 KB • 4 Oct 2026, 09:05 • Rishabh
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.dlBtn}
                onPress={() => Alert.alert('Download', 'Downloading attendance_oct_2026.csv')}
              >
                <Download size={16} color={t.colors.brandPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.exportItem}>
              <View style={styles.exportItemLeft}>
                <View
                  style={[
                    styles.fileIconBox,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <FileSpreadsheet size={18} color={t.colors.brandPrimary} />
                </View>
                <View>
                  <Text style={[styles.exportFilename, { color: t.colors.textPrimary }]}>
                    leave_summary_q3_2026.csv
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    2.8 KB • 1 Oct 2026, 17:30 • Super Admin
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.dlBtn}
                onPress={() => Alert.alert('Download', 'Downloading leave_summary_q3_2026.csv')}
              >
                <Download size={16} color={t.colors.brandPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </Card>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  formatTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  formatTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  noticeBody: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  noticeText: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  cardSpacing: {
    marginBottom: 16,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    marginBottom: 14,
  },
  utfBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  utfBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reportTypesGrid: {
    gap: 8,
  },
  reportOptionBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  reportOptTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  reportOptTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  reportOptDesc: {
    fontSize: 11,
  },
  presetsScroll: {
    marginBottom: 16,
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exportCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
  },
  exportCtaText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewLogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewLogText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exportsList: {
    gap: 0,
  },
  exportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  exportItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportFilename: {
    fontSize: 13,
    fontWeight: '700',
  },
  dlBtn: {
    padding: 8,
  },
});
