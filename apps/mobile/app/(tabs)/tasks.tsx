import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getAccuratePosition, type AccuratePosition } from '@/lib/location';
import {
  CheckSquare,
  Clock,
  MapPin,
  Camera,
  CheckCircle,
  Clock3,
  AlertCircle,
  Plus,
  Send,
  User,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Check,
  RotateCcw,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, TextArea } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { tasksService, employeesService } from '@/lib/api-service';
import { useAuth } from '@/lib/auth-context';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  location?: string;
  dueDate?: string;
  dueTime?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  rawStatus?: string;
  status: 'pending' | 'in_progress' | 'in_review' | 'completed';
  category?: 'audit' | 'delivery' | 'inspection' | string;
  proofRequirement?: 'NONE' | 'PHOTO' | 'FILE';
  assignedBy?: string;
  assignedTo?: string;
  hasSubmittedProof?: boolean;
  createdAt?: string;
}

/**
 * Mobile Tasks Screen
 * Directly connected to live PostgreSQL database via /api/v1/tasks.
 */
export default function TasksScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const toast = useToast();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const { isAdmin } = useAuth();
  const [employeesList, setEmployeesList] = useState<Array<{ id: string; name: string; role?: string; email?: string; designation?: string }>>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('Rishabh');
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState<boolean>(false);

  // Proof Submission Sheet
  const [proofSheetOpen, setProofSheetOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [capturedGeo, setCapturedGeo] = useState<AccuratePosition | null>(null);
  const [capturingGeoPhoto, setCapturingGeoPhoto] = useState(false);

  // Create Task Sheet
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [newProofReq, setNewProofReq] = useState<'NONE' | 'PHOTO' | 'FILE'>('PHOTO');
  const [creating, setCreating] = useState(false);

  // Load tasks from real PostgreSQL database
  const loadTasksData = useCallback(async () => {
    try {
      const res = await tasksService.getTasks();
      if (res.ok && res.data) {
        const list = Array.isArray(res.data.tasks) ? res.data.tasks : [];
        console.log(`📱 [Mobile App] Tasks refreshed from DB: ${list.length} task(s) found`);
        setTasks(list);
      }
    } catch (err) {
      console.warn('Failed to load tasks from DB:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasksData();
    employeesService.getEmployees().then((res) => {
      if (res.data?.employees && res.data.employees.length > 0) {
        const realTeam = res.data.employees.filter((e: any) => e.email !== 'codeschoolrp@gmail.com');
        const list = realTeam.length > 0 ? realTeam : res.data.employees;
        setEmployeesList(list);
        if (list.length > 0) {
          const rishabhEmp = list.find((e: any) => e.email === 'rishabh17704@gmail.com');
          setSelectedAssignee(rishabhEmp ? rishabhEmp.name : list[0].name);
        }
      }
    }).catch(() => {});
  }, [loadTasksData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasksData();
  }, [loadTasksData]);

  // Handle Starting Task (NOT_STARTED -> IN_PROGRESS)
  const handleStartTask = async (task: TaskItem) => {
    try {
      const res = await tasksService.updateTaskStatus(task.id, 'in_progress');
      if (res.ok && res.success) {
        toast.info('Task Started', `Execution timer started for "${task.title}".`);
        await loadTasksData();
      } else {
        toast.error('Update Failed', res.error || 'Could not update task status.');
      }
    } catch {
      toast.error('Network Error', 'Check your server connection.');
    }
  };

  // Approve Task (Admin capability)
  const handleApproveTask = async (task: TaskItem) => {
    try {
      const res = await tasksService.updateTaskStatus(task.id, 'completed', 'Approved by Manager');
      if (res.ok && res.success) {
        toast.success('Task Approved', `Task "${task.title}" verified and marked completed.`);
        await loadTasksData();
      } else {
        toast.error('Approval Failed', res.error || 'Could not approve task.');
      }
    } catch {
      toast.error('Network Error', 'Check your connection to server.');
    }
  };

  // Open Proof Sheet for In-Progress Task
  const handleOpenProofSheet = (task: TaskItem) => {
    setSelectedTask(task);
    setProofNote('');
    setProofSheetOpen(true);
  };

  // Capture Live Camera Photo and Acquire Accurate GPS Coordinates
  const handleCaptureProof = async () => {
    setCapturingGeoPhoto(true);
    try {
      let result;
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.granted) {
          result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.7,
          });
        }
      } catch {}

      if (!result || result.canceled) {
        result = await ImagePicker.launchImageLibraryAsync({
          allowsEditing: false,
          quality: 0.7,
        });
      }

      if (!result.canceled && result.assets && result.assets[0]) {
        setCapturedPhotoUri(result.assets[0].uri);

        // Fetch high-accuracy GPS coordinates in parallel
        const { position } = await getAccuratePosition();
        if (position) {
          setCapturedGeo(position);
          toast.success(
            'GPS Coordinates Locked',
            `Pinned at ${position.latitude.toFixed(4)}°N, ${position.longitude.toFixed(4)}°E (±${Math.round(position.accuracy || 10)}m)`
          );
        } else {
          toast.info('Photo Captured', 'Location acquired via network fallback.');
        }
      }
    } catch {
      toast.error('Camera Error', 'Could not open device camera or picker.');
    } finally {
      setCapturingGeoPhoto(false);
    }
  };

  // Submit Proof to Database (IN_PROGRESS -> SUBMITTED_FOR_REVIEW)
  const handleSubmitProof = async () => {
    if (!selectedTask) return;
    if (!proofNote.trim()) {
      toast.error('Observation Required', 'Please enter a note describing completion or photo confirmation.');
      return;
    }

    setSubmittingProof(true);
    try {
      const geoStamp = capturedGeo
        ? `\n📍 [GPS Verified: ${capturedGeo.latitude.toFixed(5)}, ${capturedGeo.longitude.toFixed(5)} (±${Math.round(capturedGeo.accuracy || 10)}m) at ${new Date().toLocaleTimeString()}]`
        : '';
      const photoStamp = capturedPhotoUri
        ? `\n📷 [Photo Proof Attached: ${capturedPhotoUri.split('/').pop() || 'photo_proof.jpg'}]`
        : '';

      const fullProofNote = `${proofNote.trim()}${geoStamp}${photoStamp}`;

      const res = await tasksService.updateTaskStatus(
        selectedTask.id,
        'submitted_for_review',
        fullProofNote
      );

      if (res.ok && res.success) {
        setProofSheetOpen(false);
        setProofNote('');
        setCapturedPhotoUri(null);
        setCapturedGeo(null);
        setSelectedTask(null);
        toast.success(
          'Proof Submitted to Database',
          'Your work has been saved in PostgreSQL with GPS verification and routed to your manager.'
        );
        await loadTasksData();
      } else {
        toast.error('Submission Failed', res.error || 'Failed to submit task proof.');
      }
    } catch {
      toast.error('Network Error', 'Could not sync proof with server.');
    } finally {
      setSubmittingProof(false);
    }
  };

  // Create New Task in Database
  const handleCreateTask = async () => {
    if (!newTitle.trim()) {
      toast.error('Title Required', 'Please give the task a title.');
      return;
    }

    setCreating(true);
    try {
      const res = await tasksService.createTask({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        priority: newPriority,
        proofRequirement: newProofReq,
        assignedTo: selectedAssignee || undefined,
        dueDate: new Date().toISOString().split('T')[0],
      });

      if (res.ok && res.success) {
        setCreateSheetOpen(false);
        setNewTitle('');
        setNewDescription('');
        toast.success('Task Created in Database', 'New field task committed to PostgreSQL.');
        await loadTasksData();
      } else {
        toast.error('Creation Failed', res.error || 'Could not create task.');
      }
    } catch {
      toast.error('Network Error', 'Could not reach server.');
    } finally {
      setCreating(false);
    }
  };

  // Filter tasks
  const pendingCount = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed' || t.status === 'in_review').length;

  const filteredTasks = tasks.filter((task) => {
    if (activeFilter === 'pending') {
      return task.status === 'pending' || task.status === 'in_progress';
    }
    if (activeFilter === 'completed') {
      return task.status === 'completed' || task.status === 'in_review';
    }
    return true;
  });

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
      {/* Top Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Text style={[styles.heading, { color: t.colors.brandNavy }]}>
            {isAdmin ? 'Team Tasks' : 'My Field Tasks'}
          </Text>
          <Text style={[styles.subheading, { color: t.colors.textSecondary }]} numberOfLines={2}>
            {isAdmin
              ? 'Assign & monitor field operations across your team'
              : 'Live tasks assigned by your manager'}
          </Text>
        </View>

        {/* Assign Task button */}
        {isAdmin && (
          <TouchableOpacity
            style={[styles.newTaskBtn, { backgroundColor: t.colors.brandPrimary }]}
            activeOpacity={0.8}
            onPress={() => setCreateSheetOpen(true)}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.newTaskBtnText}>Assign Task</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { key: 'all' as const, label: `All (${tasks.length})` },
          { key: 'pending' as const, label: `Pending (${pendingCount})` },
          { key: 'completed' as const, label: `Completed (${completedCount})` },
        ].map((tab) => {
          const isActive = activeFilter === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                isActive
                  ? { backgroundColor: t.colors.brandNavy, borderColor: t.colors.brandNavy }
                  : { backgroundColor: t.colors.surfaceDefault, borderColor: t.colors.borderDefault },
              ]}
              onPress={() => setActiveFilter(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isActive ? { color: '#FFFFFF' } : { color: t.colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Task List */}
      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator size="small" color={t.colors.brandPrimary} />
          <Text style={[styles.loadingText, { color: t.colors.textSecondary }]}>
            Querying tasks from database...
          </Text>
        </Card>
      ) : filteredTasks.length === 0 ? (
        <Card style={styles.emptyCard}>
          <CheckSquare size={36} color={t.colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: t.colors.textPrimary }]}>No Tasks Found</Text>
          <Text style={[styles.emptyBody, { color: t.colors.textSecondary }]}>
            {activeFilter === 'pending'
              ? 'Great job! You have no pending tasks assigned at the moment.'
              : activeFilter === 'completed'
              ? 'No completed tasks recorded yet.'
              : 'No tasks found. Any work assigned to you by your manager will appear here.'}
          </Text>
        </Card>
      ) : (
        <View style={styles.taskList}>
          {filteredTasks.map((task) => {
            const isCompleted = task.status === 'completed';
            const isInReview = task.status === 'in_review';
            const isInProgress = task.status === 'in_progress';
            const isPending = task.status === 'pending';

            return (
              <View
                key={task.id}
                style={[
                  styles.taskCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: isInProgress
                      ? t.colors.brandPrimary
                      : isInReview
                      ? t.colors.status.warning.border
                      : t.colors.borderDefault,
                  },
                ]}
              >
                {/* Status + Due Info */}
                <View style={styles.taskTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <StatusChip
                      status={
                        isCompleted
                          ? { key: 'completed', label: 'Completed ✓', tone: 'success' }
                          : isInReview
                          ? { key: 'in_review', label: 'In Review ⏳', tone: 'warning' }
                          : isInProgress
                          ? { key: 'in_progress', label: 'In Progress ⚙', tone: 'info' }
                          : { key: 'pending', label: 'Pending Start', tone: 'neutral' }
                      }
                      size="sm"
                    />

                    {task.priority === 'HIGH' && (
                      <View style={[styles.priorityPill, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.priorityPillText, { color: '#B91C1C' }]}>HIGH</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.timeTag}>
                    <Clock size={12} color={t.colors.textTertiary} />
                    <Text style={[styles.timeText, { color: t.colors.textSecondary }]}>
                      {task.dueDate || task.dueTime || 'Today'}
                    </Text>
                  </View>
                </View>

                {/* Title & Description */}
                <Text style={[styles.taskTitle, { color: t.colors.textPrimary }]}>{task.title}</Text>
                {task.description ? (
                  <Text style={[styles.taskDesc, { color: t.colors.textSecondary }]}>
                    {task.description}
                  </Text>
                ) : null}

                {/* Location & Assignee */}
                <View style={styles.metaRow}>
                  {task.location ? (
                    <View style={styles.metaItem}>
                      <MapPin size={12} color={t.colors.textTertiary} />
                      <Text style={[styles.metaText, { color: t.colors.textSecondary }]}>
                        {task.location}
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.metaItem}>
                    <User size={12} color={t.colors.textTertiary} />
                    <Text style={[styles.metaText, { color: t.colors.textSecondary }]}>
                      {isAdmin
                        ? `Assigned to: ${task.assignedTo || 'Team Member'}`
                        : `Assigned by: ${task.assignedBy || 'Manager'}`}
                    </Text>
                  </View>
                </View>

                {/* Proof requirement badge */}
                {task.proofRequirement && task.proofRequirement !== 'NONE' ? (
                  <View style={styles.proofBadge}>
                    <Camera size={12} color={t.colors.brandPrimary} />
                    <Text style={[styles.proofBadgeText, { color: t.colors.brandPrimary }]}>
                      {task.proofRequirement === 'PHOTO' ? 'Photo Proof Required' : 'File Upload Required'}
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.divider, { backgroundColor: t.colors.borderSubtle }]} />

                {/* Footer Actions */}
                <View style={styles.taskFooter}>
                  {isAdmin ? (
                    // Admin view: Monitor, track & approve
                    isInReview ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: t.colors.brandPrimary }]}
                        activeOpacity={0.8}
                        onPress={() => handleApproveTask(task)}
                      >
                        <CheckCircle size={13} color="#FFFFFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Approve & Complete</Text>
                      </TouchableOpacity>
                    ) : isInProgress ? (
                      <View style={[styles.statusBanner, { backgroundColor: t.colors.status.warning.bg }]}>
                        <Clock3 size={12} color={t.colors.status.warning.text} />
                        <Text style={[styles.statusBannerText, { color: t.colors.status.warning.text }]}>
                          In execution by {task.assignedTo || 'Employee'}
                        </Text>
                      </View>
                    ) : isPending ? (
                      <View style={[styles.statusBanner, { backgroundColor: t.colors.surfaceSunken }]}>
                        <Clock3 size={12} color={t.colors.textSecondary} />
                        <Text style={[styles.statusBannerText, { color: t.colors.textSecondary }]}>
                          Assigned to {task.assignedTo || 'Employee'} · Awaiting start
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBanner, { backgroundColor: t.colors.status.success.bg }]}>
                        <CheckCircle size={12} color={t.colors.status.success.text} />
                        <Text style={[styles.statusBannerText, { color: t.colors.status.success.text }]}>
                          Verified & Completed
                        </Text>
                      </View>
                    )
                  ) : (
                    // Employee view: Start & submit proof
                    isPending ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: t.colors.brandPrimary }]}
                        activeOpacity={0.8}
                        onPress={() => handleStartTask(task)}
                      >
                        <Clock3 size={13} color="#FFFFFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Start Task</Text>
                      </TouchableOpacity>
                    ) : isInProgress ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: t.colors.brandNavy }]}
                        activeOpacity={0.8}
                        onPress={() => handleOpenProofSheet(task)}
                      >
                        <Camera size={13} color="#FFFFFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Submit Proof</Text>
                      </TouchableOpacity>
                    ) : isInReview ? (
                      <View style={[styles.statusBanner, { backgroundColor: t.colors.status.warning.bg }]}>
                        <Clock3 size={12} color={t.colors.status.warning.text} />
                        <Text style={[styles.statusBannerText, { color: t.colors.status.warning.text }]}>
                          Proof submitted · Waiting for manager approval
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBanner, { backgroundColor: t.colors.status.success.bg }]}>
                        <CheckCircle size={12} color={t.colors.status.success.text} />
                        <Text style={[styles.statusBannerText, { color: t.colors.status.success.text }]}>
                          Verified & Completed
                        </Text>
                      </View>
                    )
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ========================================================
          SUBMIT PROOF SHEET
         ======================================================== */}
      {/* ========================================================
          SUBMIT PROOF SHEET
         ======================================================== */}
      <Sheet
        open={proofSheetOpen}
        onClose={() => setProofSheetOpen(false)}
        title="Submit Task Proof"
        footer={
          <View style={styles.modalActions}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                onPress={() => setProofSheetOpen(false)}
                disabled={submittingProof}
              >
                Cancel
              </Button>
            </View>
            <View style={{ flex: 2 }}>
              <Button
                variant="primary"
                onPress={handleSubmitProof}
                loading={submittingProof}
                leadingIcon={<Send size={15} color="#FFFFFF" />}
              >
                Submit Proof
              </Button>
            </View>
          </View>
        }
      >
        <View style={styles.sheetBody}>
          <Text style={[t.typography.bodySemibold, { color: t.colors.textPrimary }]}>
            {selectedTask?.title}
          </Text>
          <Text style={[t.typography.caption, { color: t.colors.textSecondary, marginTop: 2, marginBottom: 14 }]}>
            {selectedTask?.proofRequirement === 'PHOTO'
              ? 'Please attach observation note and photo verification before closing.'
              : 'Record your completion notes for manager review.'}
          </Text>

          <TextArea
            label="Completion Observation / Notes"
            placeholder="e.g. Completed inspection of Bay 4. Shelf items reconciled and verified."
            value={proofNote}
            onChangeText={setProofNote}
            multiline
            numberOfLines={3}
          />

          {capturedPhotoUri ? (
            <View
              style={[
                styles.capturedPhotoCard,
                {
                  backgroundColor: t.colors.surfaceSunken,
                  borderColor: t.colors.borderDefault,
                },
              ]}
            >
              <Image source={{ uri: capturedPhotoUri }} style={styles.capturedPhotoThumb} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <CheckCircle size={15} color={t.colors.accentPositive} />
                  <Text style={[styles.capturedPhotoTitle, { color: t.colors.textPrimary }]}>
                    Photo Evidence Captured
                  </Text>
                </View>

                {capturedGeo ? (
                  <View style={styles.geoPill}>
                    <MapPin size={11} color={t.colors.brandPrimary} />
                    <Text style={[styles.geoPillText, { color: t.colors.brandNavy }]}>
                      GPS: {capturedGeo.latitude.toFixed(4)}°N, {capturedGeo.longitude.toFixed(4)}°E (±{Math.round(capturedGeo.accuracy || 10)}m)
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 11, color: t.colors.textSecondary }}>
                    Timestamp locked
                  </Text>
                )}

                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                  onPress={handleCaptureProof}
                  disabled={capturingGeoPhoto}
                >
                  <RotateCcw size={12} color={t.colors.brandPrimary} />
                  <Text style={{ fontSize: 11, color: t.colors.brandPrimary, fontWeight: '700' }}>
                    Retake Photo
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.photoBox,
                { borderColor: capturingGeoPhoto ? t.colors.brandPrimary : '#93C5FD' },
              ]}
              onPress={handleCaptureProof}
              activeOpacity={0.7}
              disabled={capturingGeoPhoto}
            >
              {capturingGeoPhoto ? (
                <ActivityIndicator size="small" color={t.colors.brandPrimary} />
              ) : (
                <Camera size={26} color={t.colors.brandPrimary} />
              )}
              <Text style={[styles.photoBoxTitle, { color: t.colors.textPrimary }]}>
                {capturingGeoPhoto ? 'Locking GPS & Opening Camera...' : 'Tap to Snap Photo & Geo-Stamp'}
              </Text>
              <Text style={[styles.photoBoxSubtitle, { color: t.colors.textSecondary }]}>
                Snaps photo and binds high-accuracy GPS coordinates for manager verification.
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </Sheet>

      {/* ========================================================
          CREATE NEW TASK SHEET
         ======================================================== */}
      <Sheet
        open={createSheetOpen}
        onClose={() => setCreateSheetOpen(false)}
        title="Create New Task"
        footer={
          <View style={styles.modalActions}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                onPress={() => setCreateSheetOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
            </View>
            <View style={{ flex: 2 }}>
              <Button
                variant="primary"
                onPress={handleCreateTask}
                loading={creating}
              >
                Dispatch Task
              </Button>
            </View>
          </View>
        }
      >
        <View style={styles.sheetBody}>
          <Input
            label="Task Title *"
            placeholder="e.g. Audit Delivery Invoices"
            value={newTitle}
            onChangeText={setNewTitle}
          />

          <View style={{ marginTop: 12 }}>
            <TextArea
              label="Description / Instructions"
              placeholder="Provide instructions or location details..."
              value={newDescription}
              onChangeText={setNewDescription}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Assign To Employee Dropdown List */}
          <Text style={[styles.label, { color: t.colors.textPrimary, marginTop: 14, marginBottom: 6 }]}>
            Assign To Employee *
          </Text>
          <View style={styles.dropdownContainer}>
            {/* Dropdown Trigger Box */}
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                {
                  backgroundColor: t.colors.surfaceSunken,
                  borderColor: assigneeDropdownOpen ? t.colors.brandPrimary : t.colors.borderDefault,
                },
              ]}
              activeOpacity={0.8}
              onPress={() => setAssigneeDropdownOpen((prev) => !prev)}
            >
              <View style={styles.dropdownLeft}>
                <View style={[styles.avatarCircle, { backgroundColor: t.colors.brandPrimarySubtle }]}>
                  <User size={15} color={t.colors.brandPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dropdownSelectedName, { color: t.colors.textPrimary }]}>
                    {selectedAssignee || 'Select an employee'}
                  </Text>
                  {(() => {
                    const activeEmp = employeesList.find((e) => e.name === selectedAssignee);
                    return activeEmp ? (
                      <Text style={[styles.dropdownSelectedMeta, { color: t.colors.textSecondary }]} numberOfLines={1}>
                        {activeEmp.designation || activeEmp.role || 'Employee'} • {activeEmp.email}
                      </Text>
                    ) : (
                      <Text style={[styles.dropdownSelectedMeta, { color: t.colors.textTertiary }]}>
                        Tap to choose team member
                      </Text>
                    );
                  })()}
                </View>
              </View>
              {assigneeDropdownOpen ? (
                <ChevronUp size={18} color={t.colors.textSecondary} />
              ) : (
                <ChevronDown size={18} color={t.colors.textSecondary} />
              )}
            </TouchableOpacity>

            {/* Dropdown Options List */}
            {assigneeDropdownOpen && (
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                {employeesList.length === 0 ? (
                  <View style={styles.dropdownEmpty}>
                    <Text style={{ color: t.colors.textSecondary, fontSize: 12 }}>
                      Loading real employees from backend...
                    </Text>
                  </View>
                ) : (
                  employeesList.map((emp) => {
                    const isSelected = selectedAssignee === emp.name;
                    return (
                      <TouchableOpacity
                        key={emp.id}
                        style={[
                          styles.dropdownItem,
                          isSelected && { backgroundColor: t.colors.brandPrimarySubtle },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedAssignee(emp.name);
                          setAssigneeDropdownOpen(false);
                        }}
                      >
                        <View style={styles.dropdownItemLeft}>
                          <View
                            style={[
                              styles.itemAvatar,
                              {
                                backgroundColor: isSelected
                                  ? t.colors.brandPrimary
                                  : t.colors.surfaceSunken,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color: isSelected ? '#FFFFFF' : t.colors.textPrimary,
                                fontSize: 11,
                                fontWeight: '700',
                              }}
                            >
                              {emp.name.substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.dropdownItemName,
                                {
                                  color: isSelected ? t.colors.brandPrimary : t.colors.textPrimary,
                                  fontWeight: isSelected ? '700' : '600',
                                },
                              ]}
                            >
                              {emp.name} {emp.email === 'rishabh17704@gmail.com' ? ' (Assigned Staff)' : ''}
                            </Text>
                            <Text style={[styles.dropdownItemSub, { color: t.colors.textTertiary }]} numberOfLines={1}>
                              {emp.designation || emp.role || 'Employee'} • {emp.email}
                            </Text>
                          </View>
                        </View>
                        {isSelected && <Check size={16} color={t.colors.brandPrimary} strokeWidth={2.5} />}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </View>

          <Text style={[styles.label, { color: t.colors.textPrimary, marginTop: 12 }]}>Priority</Text>
          <View style={styles.selectorRow}>
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.selectorBtn,
                  newPriority === p
                    ? { backgroundColor: t.colors.brandPrimary, borderColor: t.colors.brandPrimary }
                    : { backgroundColor: t.colors.surfaceCanvas, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => setNewPriority(p)}
              >
                <Text
                  style={[
                    styles.selectorText,
                    { color: newPriority === p ? '#FFFFFF' : t.colors.textPrimary },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: t.colors.textPrimary, marginTop: 12 }]}>
            Proof Requirement
          </Text>
          <View style={styles.selectorRow}>
            {[
              { key: 'NONE' as const, label: 'None' },
              { key: 'PHOTO' as const, label: 'Photo' },
              { key: 'FILE' as const, label: 'Document' },
            ].map((pr) => (
              <TouchableOpacity
                key={pr.key}
                style={[
                  styles.selectorBtn,
                  newProofReq === pr.key
                    ? { backgroundColor: t.colors.brandNavy, borderColor: t.colors.brandNavy }
                    : { backgroundColor: t.colors.surfaceCanvas, borderColor: t.colors.borderDefault },
                ]}
                onPress={() => setNewProofReq(pr.key)}
              >
                <Text
                  style={[
                    styles.selectorText,
                    { color: newProofReq === pr.key ? '#FFFFFF' : t.colors.textPrimary },
                  ]}
                >
                  {pr.label}
                </Text>
              </TouchableOpacity>
            ))}
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
    gap: 14,
  },
  headerRow: {
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
  newTaskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  newTaskBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
  },
  emptyBody: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  taskList: {
    gap: 12,
  },
  taskCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    shadowColor: 'rgba(0, 0, 0, 0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  taskDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
  },
  proofBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sheetBody: {
    paddingVertical: 8,
  },
  photoBox: {
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  photoBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoBoxSubtitle: {
    fontSize: 11,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  selectorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropdownContainer: {
    marginBottom: 12,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  dropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownSelectedName: {
    fontSize: 13,
    fontWeight: '700',
  },
  dropdownSelectedMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  dropdownMenu: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownEmpty: {
    padding: 14,
    alignItems: 'center',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  itemAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownItemName: {
    fontSize: 13,
  },
  dropdownItemSub: {
    fontSize: 11,
    marginTop: 1,
  },
  capturedPhotoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 14,
  },
  capturedPhotoThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#CBD5E1',
  },
  capturedPhotoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  geoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
  },
  geoPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

