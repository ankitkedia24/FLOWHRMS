import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Table,
  Download,
  Calendar,
  Clock,
  CheckCircle2,
  Users,
  CalendarDays,
  CheckSquare,
  FileSpreadsheet,
  Share2,
  Sparkles,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { reportsService } from '@/lib/api-service';

interface ExportRecord {
  id: string;
  name: string;
  generatedAt: string;
  size: string;
  recordsCount: number;
  format: string;
  csvContent?: string;
}

export default function ReportsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [selectedReport, setSelectedReport] = useState<'attendance' | 'employees' | 'leave' | 'tasks'>('attendance');
  const [selectedRange, setSelectedRange] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [recentExports, setRecentExports] = useState<ExportRecord[]>([
    {
      id: 'init-1',
      name: 'FlowHRMS_Employees_Directory.csv',
      generatedAt: 'Live Verified',
      size: '2.4 KB',
      recordsCount: 2,
      format: 'CSV',
    },
  ]);

  const reportOptions = [
    {
      id: 'attendance' as const,
      label: 'Attendance Register',
      desc: 'Punch times, work dates, late minutes & exceptions',
      icon: Clock,
      color: '#4F46E5',
      bg: '#EEF2FF',
    },
    {
      id: 'employees' as const,
      label: 'Staff Directory',
      desc: 'Active roster, employee codes, roles & departments',
      icon: Users,
      color: '#059669',
      bg: '#ECFDF5',
    },
    {
      id: 'leave' as const,
      label: 'Leave Management',
      desc: 'Leave types, date ranges, reasons & approvals',
      icon: CalendarDays,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    {
      id: 'tasks' as const,
      label: 'Tasks & Projects',
      desc: 'Task progress, assignees, priorities & milestones',
      icon: CheckSquare,
      color: '#D97706',
      bg: '#FFFBEB',
    },
  ];

  const datePresets = [
    { id: 'all', label: 'All Records' },
    { id: 'month', label: 'This Month' },
    { id: 'last30', label: 'Last 30 Days' },
    { id: 'today', label: 'Today' },
  ];

  // Helper to trigger physical CSV file download / native share dialog
  const saveAndDeliverCsv = async (filename: string, csvContent: string) => {
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      }

      // Native iOS / Android
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const fileUri = `${baseDir}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isShareAvailable = await Sharing.isAvailableAsync();
      if (isShareAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Save / Download ${filename}`,
          UTI: 'public.comma-separated-values-text',
        });
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.toLowerCase().includes('cancel')) {
        toast.error('File Error', 'Could not save file to device storage.');
      }
      return false;
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportsService.generateExport(selectedReport, selectedRange);
      if (res.ok && res.csvContent && res.filename) {
        // Trigger real file download / save
        await saveAndDeliverCsv(res.filename, res.csvContent);

        // Add to recent exports list
        const newItem: ExportRecord = {
          id: `exp-${Date.now()}`,
          name: res.filename,
          generatedAt: 'Just now',
          size: `${Math.max(1, Math.round((res.csvContent.length / 1024) * 10) / 10)} KB`,
          recordsCount: res.recordsCount || 0,
          format: 'CSV',
          csvContent: res.csvContent,
        };
        setRecentExports((prev) => [newItem, ...prev.slice(0, 4)]);

        toast.success(
          'CSV Download Ready',
          `${res.recordsCount ?? 0} records exported to ${res.filename}.`
        );
      } else {
        toast.error('Export Error', res.error || 'Failed to generate report.');
      }
    } catch (err: unknown) {
      toast.error('Connection Error', 'Please check your connection and retry.');
    } finally {
      setExporting(false);
    }
  };

  const handleReDownload = async (item: ExportRecord) => {
    if (item.csvContent) {
      await saveAndDeliverCsv(item.name, item.csvContent);
      toast.success('File Ready', `Saved ${item.name} to device.`);
    } else {
      // Re-fetch fresh
      setSelectedReport('attendance');
      await handleExport();
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}
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
            Reports & Analytics
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.colors.textSecondary }]}>
            Live CSV Data & Compliance Sheets
          </Text>
        </View>

        <View style={[styles.formatTag, { backgroundColor: t.colors.brandPrimarySubtle }]}>
          <Table size={12} color={t.colors.brandPrimary} />
          <Text style={[styles.formatTagText, { color: t.colors.brandPrimary }]}>
            UTF-8 CSV
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Report Category Selector */}
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionHeading, { color: t.colors.textSecondary }]}>
            SELECT REPORT DATASET
          </Text>

          <View style={styles.optionsGrid}>
            {reportOptions.map((opt) => {
              const active = selectedReport === opt.id;
              const Icon = opt.icon;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.reportOptionCard,
                    {
                      backgroundColor: t.colors.surfaceDefault,
                      borderColor: active ? t.colors.brandPrimary : t.colors.borderDefault,
                      borderWidth: active ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedReport(opt.id)}
                  activeOpacity={0.75}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconCircle, { backgroundColor: opt.bg }]}>
                      <Icon size={18} color={opt.color} strokeWidth={2.2} />
                    </View>
                    {active && <CheckCircle2 size={16} color={t.colors.brandPrimary} />}
                  </View>

                  <Text style={[styles.optLabel, { color: t.colors.textPrimary }]}>
                    {opt.label}
                  </Text>
                  <Text
                    style={[styles.optDesc, { color: t.colors.textTertiary }]}
                    numberOfLines={2}
                  >
                    {opt.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 2. Date Range Filter */}
        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionHeading, { color: t.colors.textSecondary }]}>
            DATE RANGE SCOPE
          </Text>

          <View style={styles.presetsRow}>
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
                        : t.colors.surfaceDefault,
                      borderColor: active
                        ? t.colors.brandPrimary
                        : t.colors.borderDefault,
                    },
                  ]}
                  onPress={() => setSelectedRange(preset.id)}
                  activeOpacity={0.7}
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
          </View>
        </View>

        {/* 3. Primary Export & Download Action */}
        <TouchableOpacity
          style={[styles.exportBtn, { backgroundColor: t.colors.brandPrimary }]}
          onPress={handleExport}
          disabled={exporting}
          activeOpacity={0.85}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Download size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.exportBtnText}>Download & Save CSV File</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 4. Recent Generated Exports Card */}
        <View style={[styles.sectionWrap, { marginTop: 20 }]}>
          <View style={styles.recentHeaderRow}>
            <Text style={[styles.sectionHeading, { color: t.colors.textSecondary, marginBottom: 0 }]}>
              RECENT GENERATED EXPORTS
            </Text>
            <View style={styles.liveTagBadge}>
              <Sparkles size={11} color={t.colors.brandPrimary} />
              <Text style={[styles.liveTagText, { color: t.colors.brandPrimary }]}>
                Live PostgreSQL
              </Text>
            </View>
          </View>

          <Card
            style={[
              styles.recentCard,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            {recentExports.map((item, idx) => {
              const isLast = idx === recentExports.length - 1;
              return (
                <View
                  key={item.id}
                  style={[
                    styles.recentRow,
                    !isLast && {
                      borderBottomWidth: 1,
                      borderBottomColor: t.colors.borderSubtle,
                    },
                  ]}
                >
                  <View style={[styles.fileIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <FileSpreadsheet size={18} color="#4F46E5" />
                  </View>

                  <View style={styles.recentDetails}>
                    <Text
                      style={[styles.recentFilename, { color: t.colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    <Text style={[styles.recentSub, { color: t.colors.textTertiary }]}>
                      {item.size} • {item.recordsCount} rows • {item.generatedAt}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.downloadIconBtn, { backgroundColor: t.colors.surfaceSunken }]}
                    onPress={() => handleReDownload(item)}
                    activeOpacity={0.7}
                    accessibilityLabel="Download file"
                  >
                    <Download size={15} color={t.colors.brandPrimary} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </Card>
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
    marginRight: 6,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
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
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 40,
  },
  sectionWrap: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reportOptionCard: {
    width: '48.4%',
    borderRadius: 16,
    padding: 12,
    minHeight: 102,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  optDesc: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: 'rgba(79, 70, 229, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  liveTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  recentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 0,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recentDetails: {
    flex: 1,
    marginRight: 8,
  },
  recentFilename: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  recentSub: {
    fontSize: 10.5,
    marginTop: 1.5,
  },
  downloadIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
