import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ReceiptText,
  CreditCard,
  Check,
  Shield,
  Clock,
  Download,
  Building,
  Sparkles,
  ExternalLink,
  ChevronRight,
  FileText,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

type SubscriptionTab = 'plans' | 'checkout' | 'invoices';

/**
 * FlowHRMS - Mobile Subscription Screen
 * Stitch Screens: 09, 10, 22
 */
export default function SubscriptionScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<SubscriptionTab>('plans');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayNow = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      Alert.alert(
        'Payment Successful',
        'Your subscription to FlowHRMS PRO is confirmed. Tax invoice #FL-2026-1002 has been generated.'
      );
      setActiveTab('invoices');
    }, 1500);
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
            FX & FLOAT • BILLING
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Subscription
          </Text>
        </View>
        <View style={[styles.trialTag, { backgroundColor: t.colors.surfaceSunken }]}>
          <Clock size={11} color={t.colors.textSecondary} />
          <Text style={[styles.trialTagText, { color: t.colors.textSecondary }]}>23d left</Text>
        </View>
      </View>

      {/* 3 Segments Tab Navigation */}
      <View
        style={[
          styles.tabsBar,
          {
            backgroundColor: t.colors.surfaceDefault,
            borderBottomColor: t.colors.borderDefault,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'plans' && {
              borderBottomColor: t.colors.brandPrimary,
              borderBottomWidth: 2.5,
            },
          ]}
          onPress={() => setActiveTab('plans')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'plans' ? t.colors.brandPrimary : t.colors.textSecondary,
                fontWeight: activeTab === 'plans' ? '700' : '500',
              },
            ]}
          >
            Plans
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'checkout' && {
              borderBottomColor: t.colors.brandPrimary,
              borderBottomWidth: 2.5,
            },
          ]}
          onPress={() => setActiveTab('checkout')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'checkout' ? t.colors.brandPrimary : t.colors.textSecondary,
                fontWeight: activeTab === 'checkout' ? '700' : '500',
              },
            ]}
          >
            Checkout
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            activeTab === 'invoices' && {
              borderBottomColor: t.colors.brandPrimary,
              borderBottomWidth: 2.5,
            },
          ]}
          onPress={() => setActiveTab('invoices')}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'invoices' ? t.colors.brandPrimary : t.colors.textSecondary,
                fontWeight: activeTab === 'invoices' ? '700' : '500',
              },
            ]}
          >
            Invoices & Receipts
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Trial Banner */}
        <View
          style={[
            styles.trialBanner,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleActive,
            },
          ]}
        >
          <Clock size={16} color={t.colors.brandPrimary} style={styles.trialIcon} />
          <View style={styles.trialTextWrap}>
            <Text style={[styles.trialTitle, { color: t.colors.textPrimary }]}>
              Free trial — 23 days left
            </Text>
            <Text style={[styles.trialDesc, { color: t.colors.textSecondary }]}>
              Your trial runs until <Text style={{ fontWeight: '700' }}>27 Oct 2026</Text>. Choose a
              plan any time — remaining trial days are kept and billing begins after trial ends.
            </Text>
          </View>
        </View>

        {/* TAB 1: PLANS */}
        {activeTab === 'plans' && (
          <View style={styles.plansSection}>
            {/* Cadence Selector */}
            <View style={styles.cadenceWrapper}>
              <View
                style={[
                  styles.cadenceBox,
                  { backgroundColor: t.colors.surfaceCanvas, borderColor: t.colors.borderDefault },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.cadenceBtn,
                    billingCycle === 'monthly' && {
                      backgroundColor: t.colors.surfaceDefault,
                      shadowOpacity: 0.05,
                    },
                  ]}
                  onPress={() => setBillingCycle('monthly')}
                >
                  <Text
                    style={[
                      styles.cadenceBtnText,
                      {
                        color:
                          billingCycle === 'monthly'
                            ? t.colors.textPrimary
                            : t.colors.textTertiary,
                        fontWeight: billingCycle === 'monthly' ? '700' : '500',
                      },
                    ]}
                  >
                    Monthly
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.cadenceBtn,
                    billingCycle === 'yearly' && {
                      backgroundColor: t.colors.surfaceDefault,
                      shadowOpacity: 0.05,
                    },
                  ]}
                  onPress={() => setBillingCycle('yearly')}
                >
                  <Text
                    style={[
                      styles.cadenceBtnText,
                      {
                        color:
                          billingCycle === 'yearly'
                            ? t.colors.textPrimary
                            : t.colors.textTertiary,
                        fontWeight: billingCycle === 'yearly' ? '700' : '500',
                      },
                    ]}
                  >
                    Yearly
                  </Text>
                  <View style={styles.saveTag}>
                    <Text style={styles.saveTagText}>Save 20%</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Plan 1: Starter */}
            <Card
              style={[
                styles.planCard,
                selectedPlan === 'starter' && {
                  borderColor: t.colors.brandPrimary,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={styles.planCardTop}>
                <View>
                  <Text style={[styles.planTitle, { color: t.colors.textPrimary }]}>Starter</Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    Up to 5 employees
                  </Text>
                </View>
                <Text style={[styles.planPrice, { color: t.colors.textPrimary }]}>
                  {billingCycle === 'monthly' ? '₹999' : '₹799'}
                  <Text style={styles.perMo}> /mo</Text>
                </Text>
              </View>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    GPS check-in & check-out
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Leave management & approvals
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Basic monthly salary reports
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.selectPlanBtn,
                  {
                    backgroundColor:
                      selectedPlan === 'starter'
                        ? t.colors.brandPrimary
                        : t.colors.surfaceCanvas,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => setSelectedPlan('starter')}
              >
                <Text
                  style={[
                    styles.selectPlanText,
                    { color: selectedPlan === 'starter' ? '#FFFFFF' : t.colors.textPrimary },
                  ]}
                >
                  {selectedPlan === 'starter' ? 'Selected Plan' : 'Select Starter'}
                </Text>
              </TouchableOpacity>
            </Card>

            {/* Plan 2: PRO (Popular) */}
            <Card
              style={[
                styles.planCard,
                styles.proCard,
                {
                  borderColor: t.colors.brandPrimary,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={[styles.popularBadge, { backgroundColor: t.colors.brandPrimary }]}>
                <Sparkles size={11} color="#FFFFFF" />
                <Text style={styles.popularBadgeText}>MOST POPULAR • CURRENT TRIAL</Text>
              </View>

              <View style={styles.planCardTop}>
                <View>
                  <Text style={[styles.planTitle, { color: t.colors.textPrimary }]}>PRO</Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    Up to 50 active employees
                  </Text>
                </View>
                <Text style={[styles.planPrice, { color: t.colors.brandPrimary }]}>
                  {billingCycle === 'monthly' ? '₹2,999' : '₹2,399'}
                  <Text style={styles.perMo}> /mo</Text>
                </Text>
              </View>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Everything in Starter included
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Automated payroll cycles & payslip PDFs
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Multi-location GPS geofencing & shifts
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Immutable activity logs & audit exports
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.selectPlanBtn,
                  { backgroundColor: t.colors.brandPrimary },
                ]}
                onPress={() => {
                  setSelectedPlan('pro');
                  setActiveTab('checkout');
                }}
              >
                <Text style={[styles.selectPlanText, { color: '#FFFFFF' }]}>
                  Continue to Checkout →
                </Text>
              </TouchableOpacity>
            </Card>

            {/* Plan 3: Enterprise */}
            <Card
              style={[
                styles.planCard,
                selectedPlan === 'enterprise' && {
                  borderColor: t.colors.brandPrimary,
                  borderWidth: 2,
                },
              ]}
            >
              <View style={styles.planCardTop}>
                <View>
                  <Text style={[styles.planTitle, { color: t.colors.textPrimary }]}>
                    Enterprise
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    Unlimited workforce
                  </Text>
                </View>
                <Text style={[styles.planPrice, { color: t.colors.textPrimary }]}>Custom</Text>
              </View>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Dedicated account manager & SLA
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <Check size={14} color={t.colors.accentPositive} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Custom payroll integrations & biometric sync
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.selectPlanBtn,
                  { backgroundColor: t.colors.surfaceCanvas, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => Alert.alert('Contact Sales', 'Call +91 800-FLOW-HRMS for enterprise pricing.')}
              >
                <Text style={[styles.selectPlanText, { color: t.colors.textPrimary }]}>
                  Talk to Sales
                </Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}

        {/* TAB 2: CHECKOUT */}
        {activeTab === 'checkout' && (
          <View style={styles.checkoutSection}>
            <Card style={styles.cardSpacing}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Order Summary
              </Text>
              <Text style={[styles.sectionSubtitle, { color: t.colors.textSecondary }]}>
                Plan: PRO (Up to 50 active users)
              </Text>

              <View style={styles.summaryBreakdown}>
                <View style={[styles.sumRow, { borderBottomColor: t.colors.borderSubtle }]}>
                  <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>
                    Plan Base Price
                  </Text>
                  <Text style={[styles.sumValText, { color: t.colors.textPrimary }]}>
                    ₹2,999.00
                  </Text>
                </View>
                <View style={[styles.sumRow, { borderBottomColor: t.colors.borderSubtle }]}>
                  <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>
                    Integrated GST (18% IGST)
                  </Text>
                  <Text style={[styles.sumValText, { color: t.colors.textPrimary }]}>
                    ₹539.82
                  </Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: t.colors.textPrimary }]}>
                    Total Net Due
                  </Text>
                  <Text style={[styles.totalAmount, { color: t.colors.brandPrimary }]}>
                    ₹3,538.82
                  </Text>
                </View>
              </View>
            </Card>

            <Card style={styles.cardSpacing}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Billing Details
              </Text>
              <Text style={[styles.sectionSubtitle, { color: t.colors.textSecondary }]}>
                Invoice issued to registered business entity
              </Text>

              <View style={styles.fieldList}>
                <View>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    COMPANY NAME
                  </Text>
                  <TextInput
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: t.colors.surfaceCanvas,
                        borderColor: t.colors.borderDefault,
                        color: t.colors.textPrimary,
                      },
                    ]}
                    value="FX & Float Logistics Pvt Ltd"
                    editable={false}
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    GSTIN
                  </Text>
                  <TextInput
                    style={[
                      styles.inputBox,
                      {
                        backgroundColor: t.colors.surfaceCanvas,
                        borderColor: t.colors.borderDefault,
                        color: t.colors.textPrimary,
                      },
                    ]}
                    value="07AAAAA0000A1Z5"
                    editable={false}
                  />
                </View>
              </View>
            </Card>

            <TouchableOpacity
              style={[
                styles.payCta,
                { backgroundColor: t.colors.brandPrimary },
              ]}
              onPress={handlePayNow}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <CreditCard size={18} color="#FFFFFF" />
                  <Text style={styles.payCtaText}>Pay ₹3,538.82 & Activate</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* TAB 3: INVOICES */}
        {activeTab === 'invoices' && (
          <View style={styles.invoicesSection}>
            {/* Utilization Banner */}
            <Card style={styles.utilCard}>
              <View style={styles.utilRow}>
                <View>
                  <Text style={[styles.utilTitle, { color: t.colors.textPrimary }]}>
                    PRO Plan • Active Trial
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                    Current Period: 27 Sep – 27 Oct 2026
                  </Text>
                </View>
                <StatusChip status={{ key: 'trial', label: '23 days left', tone: 'info' }} size="sm" />
              </View>

              <View
                style={[
                  styles.seatBox,
                  { backgroundColor: t.colors.surfaceCanvas },
                ]}
              >
                <Text style={[styles.seatLabel, { color: t.colors.textSecondary }]}>
                  Headcount Utilization: <Text style={{ fontWeight: '800', color: t.colors.textPrimary }}>2 of 50 seats used</Text> (48 free)
                </Text>
              </View>
            </Card>

            {/* Invoices List */}
            <View style={styles.invoicesHeaderRow}>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Tax Invoices & Receipts
              </Text>
              <TouchableOpacity
                onPress={() => Alert.alert('Export Invoices', 'All PDF receipts exported to your work email.')}
              >
                <Text style={[styles.exportAllText, { color: t.colors.brandPrimary }]}>
                  Export All
                </Text>
              </TouchableOpacity>
            </View>

            <Card style={styles.invoiceCard}>
              <View style={styles.invTop}>
                <View>
                  <View style={styles.invNumRow}>
                    <Text style={[styles.invNum, { color: t.colors.textPrimary }]}>
                      #FL-2026-1001
                    </Text>
                    <View style={[styles.schedBadge, { backgroundColor: t.colors.surfaceSunken }]}>
                      <Text style={[styles.schedBadgeText, { color: t.colors.textSecondary }]}>
                        Scheduled
                      </Text>
                    </View>
                  </View>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    27 Oct 2026 • Renewal for 1 Month
                  </Text>
                </View>
                <View style={styles.rightAlign}>
                  <Text style={[styles.invAmount, { color: t.colors.brandPrimary }]}>
                    ₹3,538.82
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                    incl. 18% IGST
                  </Text>
                </View>
              </View>

              <View style={[styles.invDetailRow, { borderTopColor: t.colors.borderSubtle }]}>
                <Text style={[t.typography.caption, { color: t.colors.textSecondary }]}>
                  Plan: PRO (50 Active Users)
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textPrimary, fontWeight: '700' }]}>
                  ₹2,999.00
                </Text>
              </View>
              <View style={styles.invDetailRow}>
                <Text style={[t.typography.caption, { color: t.colors.textSecondary }]}>
                  Integrated GST (IGST 18%)
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textPrimary, fontWeight: '700' }]}>
                  ₹539.82
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.pdfDownloadBtn,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => Alert.alert('Downloading Proforma', 'Downloading official proforma invoice PDF.')}
              >
                <Download size={14} color={t.colors.brandPrimary} />
                <Text style={[styles.pdfDownloadText, { color: t.colors.textPrimary }]}>
                  Download Proforma PDF
                </Text>
              </TouchableOpacity>
            </Card>
          </View>
        )}
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
  trialTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  trialTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 0,
  },
  tabText: {
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  trialIcon: {
    marginTop: 2,
  },
  trialTextWrap: {
    flex: 1,
  },
  trialTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  trialDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  cadenceWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  cadenceBox: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    width: 240,
  },
  cadenceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cadenceBtnText: {
    fontSize: 12,
  },
  saveTag: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  saveTagText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '800',
  },
  plansSection: {
    gap: 14,
  },
  planCard: {
    padding: 16,
    marginBottom: 0,
  },
  proCard: {
    position: 'relative',
    overflow: 'hidden',
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 10,
  },
  popularBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  planCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  planTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '900',
  },
  perMo: {
    fontSize: 11,
    fontWeight: '500',
  },
  featureList: {
    gap: 8,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
  },
  selectPlanBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  selectPlanText: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkoutSection: {
    gap: 14,
  },
  cardSpacing: {
    padding: 16,
    marginBottom: 0,
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    marginBottom: 12,
  },
  summaryBreakdown: {
    gap: 8,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  sumValText: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  totalAmount: {
    fontSize: 19,
    fontWeight: '900',
  },
  fieldList: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  inputBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  payCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  payCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  invoicesSection: {
    gap: 14,
  },
  utilCard: {
    padding: 16,
  },
  utilRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  utilTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  seatBox: {
    padding: 10,
    borderRadius: 8,
  },
  seatLabel: {
    fontSize: 11.5,
  },
  invoicesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  exportAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  invoiceCard: {
    padding: 16,
  },
  invTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  invNum: {
    fontSize: 14,
    fontWeight: '800',
  },
  schedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  schedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  invAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  invDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  pdfDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  pdfDownloadText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
