import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Plus, Calendar, CheckCircle, Clock, UserCheck } from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Input, TextArea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { leaveService } from '@/lib/api-service';

export interface LeaveRequestItem {
  id: string;
  category?: string;
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

export interface TeamLeaveRequestItem extends LeaveRequestItem {
  employeeName: string;
  employeeEmail: string;
  isOwn?: boolean;
}

interface LeaveBalanceItem {
  label: string;
  available: number;
  used: number;
  total: number;
  color?: string;
}

function getInitials(name?: string): string {
  if (!name) return 'EM';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Clean, Breathable Mobile Leave Screen
 * Redesigned for maximum clarity, low cognitive load, and zero text clutter.
 */
export default function LeaveScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const toast = useToast();
  const { user, isAdmin } = useAuth();

  // Mode: 'team' for admin, 'personal' for employee
  const [viewMode, setViewMode] = useState<'team' | 'personal'>(
    isAdmin ? 'team' : 'personal'
  );

  useEffect(() => {
    if (isAdmin) setViewMode('team');
  }, [isAdmin]);

  // Filters
  const [teamFilter, setTeamFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [personalFilter, setPersonalFilter] = useState<'past' | 'pending' | 'all'>('past');

  // Modals & form state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [leaveCategory, setLeaveCategory] = useState<'Casual Leave' | 'Sick Leave' | 'Paid Leave'>('Casual Leave');
  const [leaveType, setLeaveType] = useState<'FULL_DAY' | 'HALF_DAY'>('FULL_DAY');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [teamRequests, setTeamRequests] = useState<TeamLeaveRequestItem[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([
    { label: 'Paid', available: 18, used: 0, total: 18, color: t.colors.brandPrimary },
    { label: 'Casual', available: 12, used: 0, total: 12, color: t.colors.status.warning.fg },
    { label: 'Sick', available: 8, used: 0, total: 8, color: t.colors.status.success.fg },
  ]);

  const loadLeaveData = useCallback(async () => {
    try {
      const res = await leaveService.getBalancesAndRequests();
      if (res.ok && res.data) {
        if (Array.isArray(res.data.requests)) {
          setRequests(res.data.requests);
        }
        if (Array.isArray(res.data.teamRequests)) {
          setTeamRequests(res.data.teamRequests);
        }
        if (Array.isArray(res.data.balances)) {
          setBalances(
            res.data.balances.map((b: any) => ({
              label: b.type ? b.type.replace(' Leave', '') : b.key,
              available: b.available,
              used: b.used,
              total: b.total,
              color:
                b.key === 'SL' || b.type?.includes('Sick')
                  ? t.colors.status.success.fg
                  : b.key === 'CL' || b.type?.includes('Casual')
                  ? t.colors.status.warning.fg
                  : t.colors.brandPrimary,
            }))
          );
        }
      }
    } catch (err) {
      console.warn('Failed to load leave records:', err);
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

  // Filtered lists
  const pendingTeamLeaves = useMemo(
    () => teamRequests.filter((r) => r.status === 'PENDING'),
    [teamRequests]
  );
  const approvedTeamLeaves = useMemo(
    () => teamRequests.filter((r) => r.status === 'APPROVED'),
    [teamRequests]
  );
  const displayedTeamList = useMemo(() => {
    if (teamFilter === 'pending') return pendingTeamLeaves;
    if (teamFilter === 'approved') return approvedTeamLeaves;
    return teamRequests;
  }, [teamFilter, pendingTeamLeaves, approvedTeamLeaves, teamRequests]);

  const pastPersonalLeaves = useMemo(
    () => requests.filter((r) => r.status === 'APPROVED'),
    [requests]
  );
  const pendingPersonalLeaves = useMemo(
    () => requests.filter((r) => r.status === 'PENDING'),
    [requests]
  );
  const displayedPersonalList = useMemo(() => {
    if (personalFilter === 'past') return pastPersonalLeaves;
    if (personalFilter === 'pending') return pendingPersonalLeaves;
    return requests;
  }, [personalFilter, pastPersonalLeaves, pendingPersonalLeaves, requests]);

  // Apply leave handler
  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('Reason Required', 'Please provide a short explanation.');
      return;
    }

    setSubmitting(true);
    try {
      const typeLabel = leaveType === 'HALF_DAY' ? 'Half Day' : 'Full Day';

      const res = await leaveService.applyLeave({
        type: typeLabel,
        leaveType: leaveCategory === 'Sick Leave' ? 'EMERGENCY' : leaveType,
        leaveCategory,
        startDate,
        endDate,
        reason: reason.trim(),
        isHalfDay: leaveType === 'HALF_DAY',
      });

      if (res.ok && res.success) {
        setSheetOpen(false);
        setReason('');
        toast.success('Submitted', 'Your leave request has been sent for approval.');
        await loadLeaveData();
        setPersonalFilter('pending');
      } else {
        toast.error('Failed', res.error || 'Could not submit leave request.');
      }
    } catch {
      toast.error('Network Error', 'Please check your connection and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  // Decide leave handler
  const handleDecide = async (requestId: string, decision: 'APPROVED' | 'REJECTED', reasonStr?: string) => {
    setDecidingId(requestId);
    try {
      const res = await leaveService.decideLeave({
        requestId,
        decision,
        paid: decision === 'APPROVED',
        reason: reasonStr,
      });

      if (res.ok && res.success) {
        toast.success(
          decision === 'APPROVED' ? 'Approved' : 'Rejected',
          `The request was ${decision.toLowerCase()}.`
        );
        setRejectModalOpen(false);
        setRejectReason('');
        setSelectedRequestId(null);
        await loadLeaveData();
      } else {
        toast.error('Failed', res.error || 'Could not update request.');
      }
    } catch {
      toast.error('Network Error', 'Failed to reach server.');
    } finally {
      setDecidingId(null);
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
      {/* ========================================================
          1. CLEAN TOP HEADER & SEGMENTED VIEW SWITCHER
         ======================================================== */}
      <View style={styles.headerRow}>
        <Text style={[t.typography.h1, { color: t.colors.textPrimary }]}>
          {isAdmin && viewMode === 'team' ? 'Approvals' : 'Leaves'}
        </Text>

        {isAdmin ? (
          <View style={styles.segmentedToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'team' && styles.toggleBtnActive]}
              onPress={() => setViewMode('team')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, viewMode === 'team' && styles.toggleTextActive]}>
                Team ({pendingTeamLeaves.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === 'personal' && styles.toggleBtnActive]}
              onPress={() => setViewMode('personal')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, viewMode === 'personal' && styles.toggleTextActive]}>
                My Leaves
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Plus size={16} color="#FFFFFF" />}
            onPress={() => setSheetOpen(true)}
          >
            Apply
          </Button>
        )}
      </View>

      {/* ========================================================
          2. ADMIN VIEW: COMPACT METRIC CHIPS + STREAMLINED CARDS
         ======================================================== */}
      {isAdmin && viewMode === 'team' ? (
        <>
          {/* Interactive Stat Chips (Tap to filter) */}
          <View style={styles.statsStrip}>
            <TouchableOpacity
              style={[
                styles.statChip,
                teamFilter === 'pending' && styles.statChipActiveAmber,
              ]}
              onPress={() => setTeamFilter('pending')}
              activeOpacity={0.7}
            >
              <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
              <Text
                style={[
                  styles.statLabel,
                  teamFilter === 'pending' && { color: '#B45309', fontWeight: '700' },
                ]}
              >
                {pendingTeamLeaves.length} Pending
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statChip,
                teamFilter === 'approved' && styles.statChipActiveGreen,
              ]}
              onPress={() => setTeamFilter('approved')}
              activeOpacity={0.7}
            >
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
              <Text
                style={[
                  styles.statLabel,
                  teamFilter === 'approved' && { color: '#047857', fontWeight: '700' },
                ]}
              >
                {approvedTeamLeaves.length} Approved
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.statChip,
                teamFilter === 'all' && styles.statChipActiveNeutral,
              ]}
              onPress={() => setTeamFilter('all')}
              activeOpacity={0.7}
            >
              <View style={[styles.dot, { backgroundColor: '#64748B' }]} />
              <Text
                style={[
                  styles.statLabel,
                  teamFilter === 'all' && { color: '#1E293B', fontWeight: '700' },
                ]}
              >
                {teamRequests.length} Total
              </Text>
            </TouchableOpacity>
          </View>

          {/* Cards List */}
          {loading && displayedTeamList.length === 0 ? (
            <Card style={styles.stateCard}>
              <ActivityIndicator size="small" color={t.colors.brandPrimary} />
            </Card>
          ) : displayedTeamList.length === 0 ? (
            <Card style={styles.stateCard}>
              <UserCheck size={32} color="#6366F1" />
              <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary, marginTop: 10 }]}>
                {teamFilter === 'pending' ? 'All caught up' : 'No records found'}
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 4 }]}>
                {teamFilter === 'pending'
                  ? 'No pending team leaves waiting for review.'
                  : 'No leave applications match this filter.'}
              </Text>
            </Card>
          ) : (
            displayedTeamList.map((item) => {
              const isApproved = item.status === 'APPROVED';
              const isRejected = item.status === 'REJECTED';
              const isPending = item.status === 'PENDING';

              return (
                <Card key={item.id} style={styles.cleanCard}>
                  {/* Card Header: Avatar + Name + Status */}
                  <View style={styles.cardHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(item.employeeName)}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary, fontSize: 15 }]}>
                        {item.employeeName}
                      </Text>
                      <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 1 }]}>
                        {item.category || 'Casual Leave'} · {item.days} {item.days === 1 ? 'day' : 'days'}
                      </Text>
                    </View>

                    <StatusChip
                      status={
                        isApproved
                          ? { key: 'approved', label: 'Approved', tone: 'success' }
                          : isRejected
                          ? { key: 'rejected', label: 'Rejected', tone: 'error' }
                          : { key: 'pending', label: 'Review', tone: 'warning' }
                      }
                      size="sm"
                    />
                  </View>

                  {/* Compact Date Tag */}
                  <View style={styles.dateTag}>
                    <Calendar size={13} color="#4F46E5" />
                    <Text style={styles.dateTagText}>
                      {item.dateRange || `${item.startDate} – ${item.endDate}`}
                    </Text>
                  </View>

                  {/* Reason quote */}
                  {item.reason ? (
                    <Text style={styles.reasonQuote} numberOfLines={2}>
                      &ldquo;{item.reason}&rdquo;
                    </Text>
                  ) : null}

                  {/* Action Buttons for Pending */}
                  {isPending && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.btnReject}
                        onPress={() => {
                          setSelectedRequestId(item.id);
                          setRejectModalOpen(true);
                        }}
                        disabled={decidingId === item.id}
                      >
                        <Text style={styles.btnRejectText}>Reject</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.btnApprove}
                        onPress={() => handleDecide(item.id, 'APPROVED')}
                        disabled={decidingId === item.id}
                      >
                        {decidingId === item.id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.btnApproveText}>Approve</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </Card>
              );
            })
          )}
        </>
      ) : (
        /* ========================================================
            3. PERSONAL LEAVES VIEW (Clean & Breathable)
           ======================================================== */
        <>
          {/* Compact 3-Card Balances Strip */}
          <View style={styles.balanceRow}>
            {balances.map((b, i) => (
              <Card key={i} style={styles.balanceCard}>
                <Text style={[styles.balanceNumber, { color: b.color || t.colors.brandPrimary }]}>
                  {b.available}
                </Text>
                <Text style={styles.balanceLabel}>{b.label}</Text>
                <Text style={styles.balanceSub}>{b.used} used</Text>
              </Card>
            ))}
          </View>

          {/* Segmented Filter Pills */}
          <View style={styles.filterPillsRow}>
            <TouchableOpacity
              style={[
                styles.filterPill,
                personalFilter === 'past' && styles.filterPillActive,
              ]}
              onPress={() => setPersonalFilter('past')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  personalFilter === 'past' && styles.filterPillTextActive,
                ]}
              >
                Taken ({pastPersonalLeaves.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                personalFilter === 'pending' && styles.filterPillActive,
              ]}
              onPress={() => setPersonalFilter('pending')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  personalFilter === 'pending' && styles.filterPillTextActive,
                ]}
              >
                Pending ({pendingPersonalLeaves.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterPill,
                personalFilter === 'all' && styles.filterPillActive,
              ]}
              onPress={() => setPersonalFilter('all')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  personalFilter === 'all' && styles.filterPillTextActive,
                ]}
              >
                All ({requests.length})
              </Text>
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={styles.requestButtonSmall}
                onPress={() => setSheetOpen(true)}
              >
                <Plus size={14} color="#4F46E5" />
                <Text style={styles.requestButtonSmallText}>Request</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Personal Cards List */}
          {loading && displayedPersonalList.length === 0 ? (
            <Card style={styles.stateCard}>
              <ActivityIndicator size="small" color={t.colors.brandPrimary} />
            </Card>
          ) : displayedPersonalList.length === 0 ? (
            <Card style={styles.stateCard}>
              <CheckCircle size={32} color={t.colors.status.success.fg} />
              <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary, marginTop: 10 }]}>
                {personalFilter === 'past' ? 'No leaves taken' : 'No records'}
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 4 }]}>
                {personalFilter === 'past'
                  ? 'Your full 38-day leave balance remains completely intact.'
                  : 'You have no applications under this filter.'}
              </Text>
            </Card>
          ) : (
            displayedPersonalList.map((item) => {
              const isApproved = item.status === 'APPROVED';
              const isRejected = item.status === 'REJECTED';

              return (
                <Card key={item.id} style={styles.cleanCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary, fontSize: 14 }]}>
                        {item.dateRange || `${item.startDate} – ${item.endDate}`}
                      </Text>
                      <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 2 }]}>
                        {item.category || item.type} · {item.days} {item.days === 1 ? 'day' : 'days'}
                      </Text>
                    </View>

                    <StatusChip
                      status={
                        isApproved
                          ? { key: 'approved', label: 'Approved', tone: 'success' }
                          : isRejected
                          ? { key: 'rejected', label: 'Rejected', tone: 'error' }
                          : { key: 'pending', label: 'Pending', tone: 'warning' }
                      }
                      size="sm"
                    />
                  </View>

                  {item.reason ? (
                    <Text style={styles.reasonQuote} numberOfLines={2}>
                      &ldquo;{item.reason}&rdquo;
                    </Text>
                  ) : null}
                </Card>
              );
            })
          )}
        </>
      )}

      {/* ========================================================
          4. REJECT MODAL (Clean & Minimalist)
         ======================================================== */}
      <Modal visible={rejectModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Text style={[t.typography.h2, { color: t.colors.textPrimary }]}>
              Reject Leave
            </Text>
            <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 2 }]}>
              Enter a brief reason for the employee.
            </Text>

            <TextArea
              label=""
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="e.g. Schedule conflict, critical on-site shift..."
              multiline
              numberOfLines={3}
              style={{ marginTop: 10 }}
            />

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                size="sm"
                onPress={() => {
                  setRejectModalOpen(false);
                  setRejectReason('');
                  setSelectedRequestId(null);
                }}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onPress={() => {
                  if (!rejectReason.trim()) {
                    toast.error('Required', 'Please enter a rejection reason.');
                    return;
                  }
                  if (selectedRequestId) {
                    handleDecide(selectedRequestId, 'REJECTED', rejectReason.trim());
                  }
                }}
                loading={Boolean(decidingId)}
                style={{ flex: 1 }}
              >
                Reject
              </Button>
            </View>
          </Card>
        </View>
      </Modal>

      {/* ========================================================
          5. REQUEST LEAVE SHEET
         ======================================================== */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Apply for Leave">
        <View style={styles.sheetBody}>
          <Text style={[t.typography.label, { color: t.colors.textPrimary }]}>
            Category
          </Text>
          <View style={styles.sheetPills}>
            {[
              { key: 'Casual Leave', label: 'Casual (CL)' },
              { key: 'Sick Leave', label: 'Sick (SL)' },
              { key: 'Paid Leave', label: 'Paid (PL)' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sheetPill,
                  leaveCategory === opt.key && styles.sheetPillActive,
                ]}
                onPress={() => setLeaveCategory(opt.key as any)}
              >
                <Text
                  style={[
                    styles.sheetPillText,
                    leaveCategory === opt.key && styles.sheetPillTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[t.typography.label, { color: t.colors.textPrimary, marginTop: 4 }]}>
            Duration
          </Text>
          <View style={styles.sheetPills}>
            {[
              { key: 'FULL_DAY', label: 'Full Day' },
              { key: 'HALF_DAY', label: 'Half Day (0.5)' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.sheetPill,
                  leaveType === opt.key && styles.sheetPillActive,
                ]}
                onPress={() => setLeaveType(opt.key as any)}
              >
                <Text
                  style={[
                    styles.sheetPillText,
                    leaveType === opt.key && styles.sheetPillTextActive,
                  ]}
                >
                  {opt.label}
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
            label="Reason"
            value={reason}
            onChangeText={setReason}
            placeholder="Brief reason for your leave..."
            multiline
            numberOfLines={2}
          />

          <View style={styles.sheetActionRow}>
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
              Submit
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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 9,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  statsStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  statChipActiveAmber: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  statChipActiveGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statChipActiveNeutral: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  cleanCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4338CA',
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  reasonQuote: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  btnReject: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  btnRejectText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  btnApprove: {
    flex: 1.5,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
  },
  btnApproveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  balanceCard: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  balanceNumber: {
    fontSize: 20,
    fontWeight: '800',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 2,
  },
  balanceSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  requestButtonSmall: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
  },
  requestButtonSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  stateCard: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    padding: 18,
    borderRadius: 14,
    gap: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  sheetBody: {
    gap: 12,
    paddingBottom: 20,
  },
  sheetPills: {
    flexDirection: 'row',
    gap: 8,
  },
  sheetPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  sheetPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  sheetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  sheetPillTextActive: {
    color: '#FFFFFF',
  },
  datesRow: {
    flexDirection: 'row',
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
});
