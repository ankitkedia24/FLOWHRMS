import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Plus, Calendar, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input, TextArea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { leaveService } from '@/lib/api-service';

export interface LeaveRequestItem {
  id: string;
  type: string;
  dateRange: string;
  startDate?: string;
  endDate?: string;
  days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  note?: string;
  appliedOn?: string;
}

interface LeaveBalanceItem {
  label: string;
  available: number;
  used: number;
  total: number;
  color?: string;
}

/**
 * Mobile Leave Screen
 * Connected directly to live PostgreSQL database via Next.js REST API (/api/v1/leave).
 */
export default function LeaveScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const toast = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<'FULL_DAY' | 'HALF_DAY' | 'EMERGENCY'>('FULL_DAY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([
    { label: 'Paid Leave', available: 12, used: 6, total: 18, color: t.colors.brandPrimary },
    { label: 'Casual Leave', available: 10, used: 2, total: 12, color: t.colors.status.warning.fg },
    { label: 'Sick Leave', available: 7, used: 1, total: 8, color: t.colors.status.success.fg },
  ]);

  const loadLeaveData = useCallback(async () => {
    try {
      const res = await leaveService.getBalancesAndRequests();
      if (res.ok && res.data) {
        if (Array.isArray(res.data.requests)) {
          console.log(`📱 [Mobile App] Leave refreshed from DB: ${res.data.requests.length} request(s) found`);
          setRequests(res.data.requests);
        }
        if (Array.isArray(res.data.balances)) {
          setBalances(
            res.data.balances.map((b: any) => ({
              label: b.type || b.key,
              available: b.available,
              used: b.used,
              total: b.total,
              color:
                b.key === 'SL'
                  ? t.colors.status.success.fg
                  : b.key === 'CL'
                  ? t.colors.status.warning.fg
                  : t.colors.brandPrimary,
            }))
          );
        }
      }
    } catch (err) {
      console.warn('Failed to load leave records from DB:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadLeaveData();
  }, [loadLeaveData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLeaveData();
  }, [loadLeaveData]);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Reason Required', 'Please enter a brief explanation for your leave.');
      return;
    }

    setSubmitting(true);
    try {
      const typeLabel =
        leaveType === 'FULL_DAY' ? 'Full Day' : leaveType === 'HALF_DAY' ? 'Half Day' : 'Emergency';

      const res = await leaveService.applyLeave({
        type: typeLabel,
        leaveType,
        startDate,
        endDate,
        reason: reason.trim(),
        isHalfDay: leaveType === 'HALF_DAY',
      });

      if (res.ok && res.success) {
        setSheetOpen(false);
        setReason('');
        toast.success(
          'Leave Request Saved to Database',
          'Your leave request has been committed to PostgreSQL and routed for approval.'
        );
        // Refresh live data directly from PostgreSQL
        await loadLeaveData();
      } else {
        toast.error('Submission Failed', res.error || 'Failed to save leave request to database.');
      }
    } catch {
      toast.error('Network Error', 'Could not reach server. Please retry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={t.colors.brandPrimary}
          colors={[t.colors.brandPrimary]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Title + Action */}
      <View style={styles.topHeader}>
        <View>
          <Text style={[t.typography.h1, { color: t.colors.textPrimary }]}>Leave</Text>
          {/* <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 2 }]}>
            Live PostgreSQL Database Records
          </Text> */}
        </View>
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
          LEAVE BALANCES (Computed from DB)
         ======================================================== */}
      <View style={styles.balanceGrid}>
        {balances.map((b, index) => (
          <Card key={index} style={{ flex: 1 }}>
            <Text
              style={[
                t.typography.dataLg,
                { color: b.color || t.colors.brandPrimary, fontVariant: ['tabular-nums'] },
              ]}
            >
              {b.available}
            </Text>
            <Text style={[t.typography.label, { color: t.colors.textPrimary, marginTop: 4 }]}>
              {b.label}
            </Text>
            <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 2 }]}>
              {b.used} used of {b.total}
            </Text>
          </Card>
        ))}
      </View>

      {/* ========================================================
          YOUR REQUESTS (Live from PostgreSQL)
         ======================================================== */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[t.typography.h2, { color: t.colors.textPrimary }]}>
          Your requests ({requests.length})
        </Text>
        {loading && <ActivityIndicator size="small" color={t.colors.brandPrimary} />}
      </View>

      {loading && requests.length === 0 ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="small" color={t.colors.brandPrimary} />
          <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 8 }]}>
            Querying database records...
          </Text>
        </Card>
      ) : requests.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Calendar size={32} color={t.colors.textTertiary} />
          <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary, marginTop: 10 }]}>
            No Leave Requests Found
          </Text>
          <Text
            style={[
              t.typography.caption,
              { color: t.colors.textSecondary, textAlign: 'center', marginTop: 4 },
            ]}
          >
            Submit your first leave request above. It will be committed directly to the PostgreSQL database.
          </Text>
        </Card>
      ) : (
        requests.map((item) => {
          const isApproved = item.status === 'APPROVED';
          const isRejected = item.status === 'REJECTED';
          return (
            <Card key={item.id} style={styles.requestCard}>
              <View style={styles.requestTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary }]}>
                    {item.dateRange || `${item.startDate} – ${item.endDate}`}
                  </Text>
                  <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 2 }]}>
                    {item.type} · {item.days} {item.days === 1 ? 'day' : 'days'}
                    {item.appliedOn ? ` · Applied ${item.appliedOn}` : ''}
                  </Text>
                </View>
                <StatusChip
                  status={
                    isApproved
                      ? { key: 'approved', label: 'Approved ✓', tone: 'success' }
                      : isRejected
                      ? { key: 'rejected', label: 'Rejected ✕', tone: 'error' }
                      : { key: 'pending', label: 'Pending Review', tone: 'warning' }
                  }
                  size="sm"
                />
              </View>

              <Text style={[t.typography.secondary, { color: t.colors.textSecondary, marginTop: 8 }]}>
                Reason: {item.reason}
              </Text>

              <View
                style={[
                  styles.noteBanner,
                  {
                    backgroundColor: isApproved
                      ? t.colors.status.success.bg
                      : isRejected
                      ? t.colors.status.error.bg
                      : t.colors.surfaceCanvas,
                    borderColor: isApproved
                      ? t.colors.status.success.border
                      : isRejected
                      ? t.colors.status.error.border
                      : t.colors.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    t.typography.caption,
                    {
                      color: isApproved
                        ? t.colors.status.success.text
                        : isRejected
                        ? t.colors.status.error.text
                        : t.colors.textSecondary,
                    },
                  ]}
                >
                  {item.note || (isApproved ? 'Approved by Manager' : 'Sent · Waiting for your manager to review')}
                </Text>
              </View>
            </Card>
          );
        })
      )}

      {/* ========================================================
          REQUEST LEAVE SHEET / MODAL
         ======================================================== */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Apply for Leave">
        <View style={styles.sheetBody}>
          <Text style={[t.typography.label, { color: t.colors.textPrimary, marginBottom: 8 }]}>
            Leave Type
          </Text>
          <View style={styles.typeSelector}>
            {[
              { key: 'FULL_DAY', label: 'Full Day' },
              { key: 'HALF_DAY', label: 'Half Day' },
              { key: 'EMERGENCY', label: 'Emergency' },
            ].map((option) => (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.typeButton,
                  {
                    backgroundColor:
                      leaveType === option.key ? t.colors.brandPrimary : t.colors.surfaceCanvas,
                    borderColor:
                      leaveType === option.key ? t.colors.brandPrimary : t.colors.borderDefault,
                  },
                ]}
                onPress={() => setLeaveType(option.key as any)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    { color: leaveType === option.key ? '#FFFFFF' : t.colors.textPrimary },
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.datesRow}>
            <View style={{ flex: 1 }}>
              <Input
                label="Start Date"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Input
                label="End Date"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>

          <TextArea
            label="Reason for Leave"
            value={reason}
            onChangeText={setReason}
            placeholder="Explain briefly (e.g., family function, fever, emergency)..."
            multiline
            numberOfLines={3}
          />

          <View style={styles.sheetActions}>
            <Button
              variant="outline"
              onPress={() => setSheetOpen(false)}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onPress={handleSubmit}
              loading={submitting}
              style={{ flex: 2 }}
            >
              Send Request
            </Button>
          </View>
        </View>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  requestCard: {
    padding: 14,
  },
  requestTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  noteBanner: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  sheetBody: {
    gap: 16,
    paddingBottom: 20,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  datesRow: {
    flexDirection: 'row',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
