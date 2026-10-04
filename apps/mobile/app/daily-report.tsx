import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
  Lock,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Share2,
  Copy,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { Button } from '@/components/ui/Button';

/**
 * FlowHRMS - Mobile Daily Report Screen
 * Stitch Screen: FlowHRMS - Mobile Daily Report Screen
 */
export default function DailyReportScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [dateOffset, setDateOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const getDateString = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      Alert.alert('Live Snapshot Refreshed', 'Daily pulse metrics are up to date.');
    }, 600);
  };

  const handleShare = async () => {
    const summaryText = `*FlowHRMS Daily Report*\nDate: ${getDateString(dateOffset)}\n\n• Present: 0 of 2\n• Late: 0\n• Exceptions: 0\n• Leave Awaiting Approval: 0\n• Tasks Completed: 0\n• Open Tasks: 3\n\nGenerated via FlowHRMS Mobile`;
    try {
      await Share.share({ message: summaryText });
    } catch {
      // Ignored
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
            Daily report
          </Text>
          <Text style={[styles.headerSubtitle, { color: t.colors.textSecondary }]}>
            Real-time daily operations pulse
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={[styles.pulseDot, { backgroundColor: t.colors.accentPositive }]} />
          <Text style={[styles.liveText, { color: t.colors.accentPositive }]}>Live</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Date Selector Navigation */}
        <View
          style={[
            styles.dateBar,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.borderDefault,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => setDateOffset(dateOffset - 1)}
            style={styles.dateNavBtn}
          >
            <ChevronLeft size={18} color={t.colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.dateCenter}>
            <Calendar size={16} color={t.colors.brandPrimary} />
            <Text style={[styles.dateText, { color: t.colors.textPrimary }]}>
              {getDateString(dateOffset)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setDateOffset(dateOffset + 1)}
            style={styles.dateNavBtn}
          >
            <ChevronRight size={18} color={t.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Notice Banner */}
        <View
          style={[
            styles.noticeBanner,
            {
              backgroundColor: t.colors.status.info.bg,
              borderColor: t.colors.status.info.border,
            },
          ]}
        >
          <Info size={18} color={t.colors.status.info.fg} style={styles.noticeIcon} />
          <View style={styles.noticeTextWrap}>
            <Text style={[styles.noticeTitle, { color: t.colors.status.info.text }]}>
              Scheduled delivery isn't available yet.
            </Text>
            <Text style={[styles.noticeDesc, { color: t.colors.status.info.text }]}>
              The summary below is live — open this page whenever you want today's picture.
              Sending it on a schedule, by email, push, SMS or WhatsApp, isn't available yet.
            </Text>
          </View>
        </View>

        {/* Today's Summary Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryCardHeader}>
            <View>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Today's summary
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                {getDateString(dateOffset)}
              </Text>
            </View>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshBtn}>
              <RefreshCw
                size={16}
                color={refreshing ? t.colors.brandPrimary : t.colors.textTertiary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.metricsList}>
            <View style={[styles.metricRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.metricLabelRow}>
                <View style={[styles.metricDot, { backgroundColor: t.colors.borderStrong }]} />
                <Text style={[t.typography.body, { color: t.colors.textPrimary }]}>
                  Present
                </Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: t.colors.surfaceSunken }]}>
                <Text style={[styles.metricPillText, { color: t.colors.textPrimary }]}>
                  0 of 2
                </Text>
              </View>
            </View>

            <View style={[styles.metricRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.metricLabelRow}>
                <View style={styles.metricDotEmpty} />
                <Text style={[t.typography.body, { color: t.colors.textPrimary }]}>
                  Late
                </Text>
              </View>
              <Text style={[styles.metricVal, { color: t.colors.textPrimary }]}>0</Text>
            </View>

            <View style={[styles.metricRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.metricLabelRow}>
                <View style={styles.metricDotEmpty} />
                <Text style={[t.typography.body, { color: t.colors.textPrimary }]}>
                  Exceptions to review
                </Text>
              </View>
              <Text style={[styles.metricVal, { color: t.colors.textPrimary }]}>0</Text>
            </View>

            <View style={[styles.metricRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.metricLabelRow}>
                <View style={styles.metricDotEmpty} />
                <Text style={[t.typography.body, { color: t.colors.textPrimary }]}>
                  Leave awaiting approval
                </Text>
              </View>
              <Text style={[styles.metricVal, { color: t.colors.textPrimary }]}>0</Text>
            </View>

            <View style={[styles.metricRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.metricLabelRow}>
                <View style={styles.metricDotEmpty} />
                <Text style={[t.typography.body, { color: t.colors.textPrimary }]}>
                  Tasks completed
                </Text>
              </View>
              <Text style={[styles.metricVal, { color: t.colors.textPrimary }]}>0</Text>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricLabelRow}>
                <View style={styles.metricDotEmpty} />
                <Text style={[t.typography.body, { color: t.colors.textPrimary }]}>
                  Tasks open
                </Text>
              </View>
              <Text style={[styles.metricVal, { color: t.colors.textPrimary }]}>3</Text>
            </View>
          </View>

          <View
            style={[
              styles.cardDisclaimer,
              {
                backgroundColor: t.colors.surfaceSunken,
                borderTopColor: t.colors.borderSubtle,
              },
            ]}
          >
            <Lock size={13} color={t.colors.textTertiary} />
            <Text style={[styles.disclaimerText, { color: t.colors.textTertiary }]}>
              Payroll figures are excluded from daily summaries by design.
            </Text>
          </View>
        </Card>

        {/* Delivery Channels Card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryCardHeader}>
            <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
              Delivery channels
            </Text>
            <Text style={[styles.automationsText, { color: t.colors.textTertiary }]}>
              AUTOMATIONS
            </Text>
          </View>

          <View style={styles.channelsList}>
            <View style={[styles.channelRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.channelLeft}>
                <View
                  style={[
                    styles.channelIconBox,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <Bell size={16} color={t.colors.textSecondary} />
                </View>
                <Text style={[styles.channelName, { color: t.colors.textPrimary }]}>
                  Push Notifications
                </Text>
              </View>
              <View style={[styles.disabledBadge, { backgroundColor: t.colors.surfaceSunken }]}>
                <Text style={[styles.disabledBadgeText, { color: t.colors.textTertiary }]}>
                  Not available yet
                </Text>
              </View>
            </View>

            <View style={[styles.channelRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.channelLeft}>
                <View
                  style={[
                    styles.channelIconBox,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <Mail size={16} color={t.colors.textSecondary} />
                </View>
                <Text style={[styles.channelName, { color: t.colors.textPrimary }]}>
                  Email
                </Text>
              </View>
              <View style={[styles.disabledBadge, { backgroundColor: t.colors.surfaceSunken }]}>
                <Text style={[styles.disabledBadgeText, { color: t.colors.textTertiary }]}>
                  Not available yet
                </Text>
              </View>
            </View>

            <View style={[styles.channelRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View style={styles.channelLeft}>
                <View
                  style={[
                    styles.channelIconBox,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <MessageSquare size={16} color={t.colors.textSecondary} />
                </View>
                <Text style={[styles.channelName, { color: t.colors.textPrimary }]}>
                  WhatsApp
                </Text>
              </View>
              <View style={[styles.disabledBadge, { backgroundColor: t.colors.surfaceSunken }]}>
                <Text style={[styles.disabledBadgeText, { color: t.colors.textTertiary }]}>
                  Not available yet
                </Text>
              </View>
            </View>

            <View style={styles.channelRow}>
              <View style={styles.channelLeft}>
                <View
                  style={[
                    styles.channelIconBox,
                    { backgroundColor: t.colors.surfaceSunken },
                  ]}
                >
                  <Smartphone size={16} color={t.colors.textSecondary} />
                </View>
                <Text style={[styles.channelName, { color: t.colors.textPrimary }]}>
                  SMS
                </Text>
              </View>
              <View style={[styles.disabledBadge, { backgroundColor: t.colors.surfaceSunken }]}>
                <Text style={[styles.disabledBadgeText, { color: t.colors.textTertiary }]}>
                  Not available yet
                </Text>
              </View>
            </View>
          </View>

          <Text
            style={[
              styles.channelsNotice,
              {
                color: t.colors.textTertiary,
                borderTopColor: t.colors.borderSubtle,
              },
            ]}
          >
            None of these can be switched on yet. Requests and decisions still reach people in the
            app's notifications.
          </Text>
        </Card>

        {/* Share Action */}
        <TouchableOpacity
          style={[
            styles.shareActionBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={handleShare}
        >
          <Share2 size={16} color="#FFFFFF" />
          <Text style={styles.shareActionBtnText}>Share Live Daily Summary</Text>
        </TouchableOpacity>
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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pulseDot: {
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
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  dateNavBtn: {
    padding: 4,
  },
  dateCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '700',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeTextWrap: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  noticeDesc: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  summaryCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  refreshBtn: {
    padding: 6,
  },
  metricsList: {
    paddingHorizontal: 16,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  metricLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 10,
  },
  metricDotEmpty: {
    width: 6,
    height: 6,
    marginRight: 10,
  },
  metricPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardDisclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  disclaimerText: {
    fontSize: 11,
  },
  automationsText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  channelsList: {
    paddingHorizontal: 16,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  channelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  channelIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelName: {
    fontSize: 13,
    fontWeight: '600',
  },
  disabledBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  disabledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  channelsNotice: {
    fontSize: 11,
    lineHeight: 15,
    padding: 16,
    borderTopWidth: 1,
  },
  shareActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
    marginBottom: 20,
  },
  shareActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
