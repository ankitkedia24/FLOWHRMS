import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Info,
  Receipt,
  FileCheck2,
  Calendar,
  Building,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

/**
 * FlowHRMS - Mobile Payslips Screen
 * Stitch Screen: FlowHRMS - Mobile Payslips Screen (Empty State)
 */
export default function PayslipsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [selectedFy, setSelectedFy] = useState('FY 2026–2027');
  const [hasSample, setHasSample] = useState(false);

  const handleDownload = (month: string) => {
    Alert.alert('Download Payslip', `Downloading official payslip PDF for ${month}.`);
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
            Payslips
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.colors.textSecondary }]}>
            Official monthly salary statements
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.adminBadge,
            { backgroundColor: t.colors.brandPrimarySubtle },
          ]}
          onPress={() => router.push('/payroll' as any)}
        >
          <Text style={[styles.adminBadgeText, { color: t.colors.brandPrimary }]}>
            Payroll ↗
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scope and Filter Strip */}
        <View style={styles.filterStrip}>
          <TouchableOpacity
            style={[
              styles.fyPill,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
            onPress={() => {
              setSelectedFy(
                selectedFy === 'FY 2026–2027' ? 'FY 2025–2026' : 'FY 2026–2027'
              );
            }}
          >
            <Text style={[styles.fyPillText, { color: t.colors.textPrimary }]}>
              {selectedFy}
            </Text>
            <ChevronDown size={14} color={t.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setHasSample(!hasSample)}>
            <Text style={[styles.sampleToggle, { color: t.colors.brandPrimary }]}>
              {hasSample ? 'Show empty view' : 'Show finalized preview'}
            </Text>
          </TouchableOpacity>
        </View>

        {!hasSample ? (
          /* Empty State View - Exact match to Stitch Screen 13 */
          <Card style={styles.emptyCard}>
            {/* Warm Terracotta Staggered Pills Graphic */}
            <View style={styles.terracottaCircle}>
              <View style={[styles.pill, styles.pillTop]} />
              <View style={[styles.pill, styles.pillMid]} />
              <View style={[styles.pill, styles.pillBot]} />
            </View>

            <Text style={[styles.emptyHeadline, { color: t.colors.textPrimary }]}>
              No payslips yet.
            </Text>
            <Text style={[styles.emptyDesc, { color: t.colors.textSecondary }]}>
              Payslips appear here after payroll is approved for a month.
            </Text>

            <View
              style={[
                styles.emptyActionRow,
                { borderTopColor: t.colors.borderSubtle },
              ]}
            >
              <TouchableOpacity
                style={styles.infoLink}
                onPress={() =>
                  Alert.alert(
                    'Understanding Payslips',
                    'FlowHRMS automatically factors approved attendance, paid holidays, and approved leaves into your monthly salary computation.'
                  )
                }
              >
                <Info size={14} color={t.colors.brandPrimary} />
                <Text style={[styles.infoLinkText, { color: t.colors.brandPrimary }]}>
                  Understanding your payslip & deductions
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : (
          /* Populated Payslips list */
          <View style={styles.populatedSection}>
            <Card style={styles.payslipCard}>
              <View style={styles.payslipHeader}>
                <View>
                  <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                    September 2026
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                    Paid on 1 Oct 2026 • Direct Deposit
                  </Text>
                </View>
                <StatusChip
                  status={{ key: 'disbursed', label: 'Disbursed', tone: 'success' }}
                  size="sm"
                />
              </View>

              <View
                style={[
                  styles.salarySummaryBox,
                  { backgroundColor: t.colors.surfaceCanvas },
                ]}
              >
                <View>
                  <Text style={[styles.sumLabel, { color: t.colors.textTertiary }]}>GROSS PAY</Text>
                  <Text style={[styles.sumVal, { color: t.colors.textPrimary }]}>₹35,000</Text>
                </View>
                <View>
                  <Text style={[styles.sumLabel, { color: t.colors.textTertiary }]}>DEDUCTIONS</Text>
                  <Text style={[styles.sumVal, { color: t.colors.status.error.fg }]}>-₹1,800</Text>
                </View>
                <View style={styles.rightAlign}>
                  <Text style={[styles.sumLabel, { color: t.colors.brandPrimary }]}>NET PAYABLE</Text>
                  <Text style={[styles.sumNetVal, { color: t.colors.brandPrimary }]}>₹33,200</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.downloadBtn,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => handleDownload('September 2026')}
              >
                <Download size={15} color={t.colors.brandPrimary} />
                <Text style={[styles.downloadBtnText, { color: t.colors.textPrimary }]}>
                  Download Payslip PDF
                </Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* Advisory Footnote */}
        <View style={styles.footnote}>
          <Text style={[styles.footnoteText, { color: t.colors.textTertiary }]}>
            If something looks wrong, ask HR to review — changes are recorded.
          </Text>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  adminBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  adminBadgeText: {
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
  filterStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  fyPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sampleToggle: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  terracottaCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#FCEDDF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  pill: {
    borderRadius: 4,
  },
  pillTop: {
    width: 30,
    height: 7,
    backgroundColor: '#DFA887',
    alignSelf: 'flex-start',
    marginLeft: 20,
  },
  pillMid: {
    width: 44,
    height: 7,
    backgroundColor: '#CF855D',
  },
  pillBot: {
    width: 32,
    height: 8,
    backgroundColor: '#B7582B',
    alignSelf: 'flex-end',
    marginRight: 20,
  },
  emptyHeadline: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  emptyActionRow: {
    width: '100%',
    borderTopWidth: 1,
    marginTop: 24,
    paddingTop: 16,
    alignItems: 'center',
  },
  infoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  populatedSection: {
    gap: 12,
  },
  payslipCard: {
    padding: 16,
  },
  payslipHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  salarySummaryBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  sumLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  sumVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  sumNetVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  downloadBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footnote: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  footnoteText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
});
