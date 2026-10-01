import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  CheckSquare,
  Clock,
  MapPin,
  Camera,
  Check,
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';

interface TaskItem {
  id: string;
  title: string;
  location: string;
  dueTime: string;
  category: 'audit' | 'delivery' | 'inspection';
  status: 'pending' | 'in_progress' | 'completed';
}

const INITIAL_TASKS: TaskItem[] = [
  {
    id: '1',
    title: 'Bay 4 Stock Audit',
    location: 'Jaipur Central Warehouse',
    dueTime: '10:45 AM',
    category: 'audit',
    status: 'completed',
  },
  {
    id: '2',
    title: 'Store Delivery & Geo-Proof',
    location: 'Karol Bagh Partner Store',
    dueTime: '02:00 PM',
    category: 'delivery',
    status: 'pending',
  },
  {
    id: '3',
    title: 'Safety & Fire Gate Inspection',
    location: 'Main Gate & Dock B',
    dueTime: '04:30 PM',
    category: 'inspection',
    status: 'in_progress',
  },
];

/**
 * Mobile Tasks Screen
 * Field task management tab corresponding to Tasks in Stitch Navigation.
 */
export default function TasksScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed'>('all');

  const filteredTasks = INITIAL_TASKS.filter((task) => {
    if (activeFilter === 'pending') return task.status !== 'completed';
    if (activeFilter === 'completed') return task.status === 'completed';
    return true;
  });

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: t.colors.surfaceCanvasWarm },
      ]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Title & Stats */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.heading, { color: t.colors.brandNavy }]}>
            Field Tasks
          </Text>
          <Text style={[styles.subheading, { color: t.colors.textSecondary }]}>
            Assigned operational workflows
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.newTaskBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          activeOpacity={0.8}
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.newTaskBtnText}>New Task</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'completed'] as const).map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterTab,
                isActive
                  ? { backgroundColor: t.colors.brandNavy }
                  : {
                      backgroundColor: t.colors.surfaceDefault,
                      borderColor: t.colors.borderDefault,
                    },
              ]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterTabText,
                  isActive
                    ? { color: '#FFFFFF' }
                    : { color: t.colors.textSecondary },
                ]}
              >
                {filter === 'all'
                  ? 'All (3)'
                  : filter === 'pending'
                  ? 'Pending (2)'
                  : 'Completed (1)'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tasks List */}
      <View style={styles.taskList}>
        {filteredTasks.map((task) => {
          const isCompleted = task.status === 'completed';
          const isInProgress = task.status === 'in_progress';

          return (
            <View
              key={task.id}
              style={[
                styles.taskCard,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.borderDefault,
                },
              ]}
            >
              <View style={styles.taskTop}>
                <View
                  style={[
                    styles.statusPill,
                    isCompleted && { backgroundColor: t.colors.accentPositiveBg },
                    isInProgress && { backgroundColor: t.colors.brandPrimarySubtle },
                    !isCompleted &&
                      !isInProgress && { backgroundColor: '#FEF3C7' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isCompleted && { color: t.colors.status.success.text },
                      isInProgress && { color: t.colors.brandPrimary },
                      !isCompleted && !isInProgress && { color: '#B45309' },
                    ]}
                  >
                    {isCompleted
                      ? 'Completed'
                      : isInProgress
                      ? 'In Progress'
                      : 'Pending'}
                  </Text>
                </View>

                <View style={styles.timeTag}>
                  <Clock size={12} color={t.colors.textTertiary} />
                  <Text
                    style={[styles.timeText, { color: t.colors.textSecondary }]}
                  >
                    {task.dueTime}
                  </Text>
                </View>
              </View>

              <Text style={[styles.taskTitle, { color: t.colors.textPrimary }]}>
                {task.title}
              </Text>

              <View style={styles.locationTag}>
                <MapPin size={12} color={t.colors.textTertiary} />
                <Text
                  style={[styles.locationText, { color: t.colors.textSecondary }]}
                >
                  {task.location}
                </Text>
              </View>

              <View
                style={[
                  styles.divider,
                  { backgroundColor: t.colors.borderSubtle },
                ]}
              />

              <View style={styles.taskFooter}>
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    isCompleted
                      ? { backgroundColor: t.colors.surfaceSunken }
                      : { backgroundColor: t.colors.brandPrimarySubtle },
                  ]}
                  activeOpacity={0.7}
                >
                  {isCompleted ? (
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: t.colors.textSecondary },
                      ]}
                    >
                      View Report
                    </Text>
                  ) : (
                    <>
                      <Camera size={13} color={t.colors.brandPrimary} />
                      <Text
                        style={[
                          styles.actionBtnText,
                          { color: t.colors.brandPrimary },
                        ]}
                      >
                        Upload Proof
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <ChevronRight size={16} color={t.colors.textTertiary} />
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
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
  taskList: {
    gap: 10,
  },
  taskCard: {
    borderRadius: 18,
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
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
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
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
