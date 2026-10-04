import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert as RNAlert,
  ActivityIndicator,
} from 'react-native';
import { Plus, X, Calendar, AlertCircle, CheckCircle } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input, TextArea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { leaveService } from '@/lib/api-service';

interface LeaveRequestItem {
  id: string;
  type: 'Full Day' | 'Half Day' | 'Emergency';
  dateRange: string;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note: string;
}

/**
 * Leave Screen
 * 1:1 Mirror of Web Employee Leave Page (E10 & E11).
 */
export default function LeaveScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const toast = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<'FULL_DAY' | 'HALF_DAY' | 'EMERGENCY'>('FULL_DAY');
  const [startDate, setStartDate] = useState('2026-10-12');
  const [endDate, setEndDate] = useState('2026-10-14');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([
    {
      id: '1',
      type: 'Full Day',
      dateRange: '12 Oct – 14 Oct 2026',
      days: 3,
      reason: 'Attending family wedding ceremony',
      status: 'PENDING',
      note: 'Sent · waiting for your manager · payroll effect applied after approval',
    },
    {
      id: '2',
      type: 'Emergency',
      dateRange: '18 Sep – 19 Sep 2026',
      days: 2,
      reason: 'Medical emergency consultation',
      status: 'APPROVED',
      note: 'Approved as paid leave. No deduction applied to payroll.',
    },
  ]);

  useEffect(() => {
    // Optionally fetch initial balances
    leaveService.getBalances().then((res) => {
      if (res.success && res.data?.requests) {
        // Can optionally merge fresh requests
      }
    }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Reason Required', 'Please enter a brief explanation for your leave.');
      return;
    }

    setSubmitting(true);
    try {
      const typeLabel = leaveType === 'FULL_DAY' ? 'Full Day' : leaveType === 'HALF_DAY' ? 'Half Day' : 'Emergency';
      const res = await leaveService.applyLeave({
        type: typeLabel,
        startDate,
        endDate,
        reason: reason.trim(),
        days: 3,
      });

      if (res.success) {
        const newReq: LeaveRequestItem = res.data?.request || {
          id: Date.now().toString(),
          type: typeLabel,
          dateRange: `${startDate} – ${endDate}`,
          days: 3,
          reason: reason.trim(),
          status: 'PENDING',
          note: 'Sent · waiting for your manager · payroll effect applied after approval',
        };

        setRequests([newReq, ...requests]);
        setSheetOpen(false);
        setReason('');
        toast.success(
          'Leave Request Submitted',
          'Your leave application has been routed to your reporting manager.'
        );
      } else {
        toast.error('Submission Failed', res.error || 'Failed to submit leave request.');
      }
    } catch (e: any) {
      toast.error('Network Error', 'Could not reach server. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Title + Action */}
      <View style={styles.topHeader}>
        <Text style={[t.typography.h1, { color: t.colors.textPrimary }]}>
          Leave
        </Text>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Plus size={16} color="#FFFFFF" />}
          onPress={() => setSheetOpen(true)}
        >
          Request Leave
        </Button>
      </View>

      {/* ========================================================
          LEAVE BALANCES
         ======================================================== */}
      <View style={styles.balanceGrid}>
        <Card style={{ flex: 1 }}>
          <Text
            style={[
              t.typography.dataLg,
              { color: t.colors.brandPrimary, fontVariant: ['tabular-nums'] },
            ]}
          >
            12
          </Text>
          <Text
            style={[
              t.typography.label,
              { color: t.colors.textPrimary, marginTop: 4 },
            ]}
          >
            Annual Paid
          </Text>
          <Text
            style={[
              t.typography.caption,
              { color: t.colors.textSecondary, marginTop: 2 },
            ]}
          >
            3 used of 15
          </Text>
        </Card>

        <Card style={{ flex: 1 }}>
          <Text
            style={[
              t.typography.dataLg,
              { color: t.colors.status.success.fg, fontVariant: ['tabular-nums'] },
            ]}
          >
            7
          </Text>
          <Text
            style={[
              t.typography.label,
              { color: t.colors.textPrimary, marginTop: 4 },
            ]}
          >
            Sick Leave
          </Text>
          <Text
            style={[
              t.typography.caption,
              { color: t.colors.textSecondary, marginTop: 2 },
            ]}
          >
            1 used of 8
          </Text>
        </Card>

        <Card style={{ flex: 1 }}>
          <Text
            style={[
              t.typography.dataLg,
              { color: t.colors.status.warning.fg, fontVariant: ['tabular-nums'] },
            ]}
          >
            4
          </Text>
          <Text
            style={[
              t.typography.label,
              { color: t.colors.textPrimary, marginTop: 4 },
            ]}
          >
            Casual
          </Text>
          <Text
            style={[
              t.typography.caption,
              { color: t.colors.textSecondary, marginTop: 2 },
            ]}
          >
            0 used of 4
          </Text>
        </Card>
      </View>

      {/* ========================================================
          YOUR REQUESTS (Screen E11)
         ======================================================== */}
      <Text style={[t.typography.h2, { color: t.colors.textPrimary, marginBottom: 12 }]}>
        Your requests
      </Text>

      {requests.map((item) => (
        <Card key={item.id}>
          <View style={styles.requestTopRow}>
            <View>
              <Text
                style={[t.typography.bodySemibold, { color: t.colors.textPrimary }]}
              >
                {item.dateRange}
              </Text>
              <Text
                style={[
                  t.typography.caption,
                  { color: t.colors.textSecondary, marginTop: 2 },
                ]}
              >
                {item.type} · {item.days} days
              </Text>
            </View>
            <StatusChip
              status={
                item.status === 'APPROVED'
                  ? { key: 'approved', label: 'Approved ✓', tone: 'success' }
                  : { key: 'pending', label: 'Pending Review', tone: 'warning' }
              }
              size="sm"
            />
          </View>

          <Text
            style={[
              t.typography.secondary,
              { color: t.colors.textSecondary, marginTop: 8 },
            ]}
          >
            Reason: {item.reason}
          </Text>

          <View
            style={[
              styles.noteBanner,
              {
                backgroundColor:
                  item.status === 'APPROVED'
                    ? t.colors.status.success.bg
                    : t.colors.surfaceCanvas,
                borderColor:
                  item.status === 'APPROVED'
                    ? t.colors.status.success.border
                    : t.colors.borderSubtle,
              },
            ]}
          >
            <Text
              style={[
                t.typography.caption,
                {
                  color:
                    item.status === 'APPROVED'
                      ? t.colors.status.success.text
                      : t.colors.textSecondary,
                },
              ]}
            >
              {item.note}
            </Text>
          </View>
        </Card>
      ))}

      {/* ========================================================
          REQUEST LEAVE SHEET (Screen E10)
         ======================================================== */}
      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Request Leave"
        footer={
          <Button variant="primary" size="xl" onPress={handleSubmit}>
            Send Request to Manager
          </Button>
        }
      >
        <Text
          style={[
            t.typography.label,
            { color: t.colors.textSecondary, marginBottom: 8 },
          ]}
        >
          Leave Type
        </Text>
        <View style={styles.typeSelector}>
          {(
            [
              { key: 'FULL_DAY', label: 'Full Day' },
              { key: 'HALF_DAY', label: 'Half Day' },
              { key: 'EMERGENCY', label: 'Emergency' },
            ] as const
          ).map((item) => {
            const isActive = leaveType === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.typeChip,
                  {
                    borderColor: isActive
                      ? t.colors.brandPrimary
                      : t.colors.borderDefault,
                    backgroundColor: isActive
                      ? t.colors.brandPrimary
                      : t.colors.surfaceDefault,
                    borderRadius: t.radius.button,
                  },
                ]}
                onPress={() => setLeaveType(item.key)}
              >
                <Text
                  style={[
                    t.typography.label,
                    {
                      color: isActive
                        ? t.colors.textOnPrimary
                        : t.colors.textPrimary,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Start Date"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          containerStyle={{ marginTop: 12 }}
        />

        <Input
          label="End Date"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
        />

        {/* Live Payroll Consequence Banner (matching web LeaveRequestForm) */}
        <View
          style={[
            styles.consequenceBox,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleHover,
              borderRadius: t.radius.input,
            },
          ]}
        >
          <Text
            style={[
              t.typography.captionSemibold,
              { color: t.colors.brandPrimary },
            ]}
          >
            ✓ 3 days requested · Approved as paid leave
          </Text>
          <Text
            style={[
              t.typography.caption,
              { color: t.colors.textSecondary, marginTop: 2 },
            ]}
          >
            No salary deduction will be applied for October payroll.
          </Text>
        </View>

        <TextArea
          label="Reason for Absence"
          value={reason}
          onChangeText={setReason}
          placeholder="Tell your manager why you need these days..."
          numberOfLines={3}
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  requestTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  noteBanner: {
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  consequenceBox: {
    padding: 12,
    borderWidth: 1,
    marginVertical: 12,
  },
});
