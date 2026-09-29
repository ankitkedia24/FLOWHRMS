import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { Plus, Calendar, CheckSquare, Clock, X, Check } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { applyLeaveSchema } from '@flowhrms/validation';

export default function LeaveScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const theme = Colors[colorScheme];

  const [modalVisible, setModalVisible] = useState(false);
  const [leaveType, setLeaveType] = useState('PAID');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  const handleApply = () => {
    const result = applyLeaveSchema.safeParse({
      leaveType,
      startDate,
      endDate,
      reason,
      isHalfDay: false,
    });

    if (!result.success) {
      const firstIssue = result.error.issues?.[0];
      Alert.alert('Validation Error', firstIssue ? firstIssue.message : 'Please check form fields');
      return;
    }

    Alert.alert('Leave Submitted', 'Your leave request has been sent to your department supervisor for approval.');
    setModalVisible(false);
    setReason('');
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      {/* Leave Balances Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Leave Balances</Text>
        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: theme.tint }]}
          onPress={() => setModalVisible(true)}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.applyButtonText}>Apply Leave</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.balanceGrid}>
        <View style={[styles.balanceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.balanceNum, { color: '#7166F3' }]}>12</Text>
          <Text style={[styles.balanceLabel, { color: theme.text }]}>Annual Paid</Text>
          <Text style={[styles.balanceSub, { color: theme.tabIconDefault }]}>3 used of 15</Text>
        </View>

        <View style={[styles.balanceCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.balanceNum, { color: '#0FA57E' }]}>7</Text>
          <Text style={[styles.balanceLabel, { color: theme.text }]}>Sick Leave</Text>
          <Text style={[styles.balanceSub, { color: theme.tabIconDefault }]}>1 used of 8</Text>
        </View>
      </View>

      {/* Assigned Tasks Section */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Assigned Tasks</Text>
      </View>

      <View style={[styles.taskCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.taskTop}>
          <View style={[styles.taskTag, { backgroundColor: '#F59E0B20' }]}>
            <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>IN PROGRESS</Text>
          </View>
          <Text style={[styles.taskDate, { color: theme.tabIconDefault }]}>Due Today</Text>
        </View>
        <Text style={[styles.taskTitle, { color: theme.text }]}>Quarterly inventory verification</Text>
        <Text style={[styles.taskDesc, { color: theme.tabIconDefault }]}>
          Complete shelf count and upload photo proof via camera.
        </Text>
      </View>

      <View style={[styles.taskCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.taskTop}>
          <View style={[styles.taskTag, { backgroundColor: '#0FA57E20' }]}>
            <Text style={{ color: '#0FA57E', fontSize: 11, fontWeight: '700' }}>COMPLETED</Text>
          </View>
          <Text style={[styles.taskDate, { color: theme.tabIconDefault }]}>Yesterday</Text>
        </View>
        <Text style={[styles.taskTitle, { color: theme.text }]}>Submit travel expense receipts</Text>
        <Text style={[styles.taskDesc, { color: theme.tabIconDefault }]}>
          Fuel and toll conveyance claim for client site visit.
        </Text>
      </View>

      {/* Apply Leave Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Apply for Leave</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.tabIconDefault }]}>Leave Type</Text>
            <View style={styles.typeSelector}>
              {['PAID', 'SICK', 'CASUAL'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeChip,
                    { borderColor: theme.border },
                    leaveType === type && { backgroundColor: theme.tint, borderColor: theme.tint },
                  ]}
                  onPress={() => setLeaveType(type)}
                >
                  <Text style={[styles.typeText, { color: leaveType === type ? '#FFF' : theme.text }]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.inputLabel, { color: theme.tabIconDefault }]}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.tabIconDefault}
            />

            <Text style={[styles.inputLabel, { color: theme.tabIconDefault }]}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.tabIconDefault}
            />

            <Text style={[styles.inputLabel, { color: theme.tabIconDefault }]}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Provide reason for absence..."
              placeholderTextColor={theme.tabIconDefault}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={[styles.submitButton, { backgroundColor: theme.tint }]} onPress={handleApply}>
              <Text style={styles.submitText}>Submit Leave Request</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  applyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  balanceGrid: { flexDirection: 'row', gap: 12 },
  balanceCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  balanceNum: { fontSize: 26, fontWeight: '800' },
  balanceLabel: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  balanceSub: { fontSize: 12, marginTop: 2 },
  taskCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  taskDate: { fontSize: 12 },
  taskTitle: { fontSize: 15, fontWeight: '700' },
  taskDesc: { fontSize: 12, marginTop: 4, lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000088',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  inputLabel: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  typeSelector: { flexDirection: 'row', gap: 10 },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeText: { fontSize: 13, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: { height: 75, textAlignVertical: 'top' },
  submitButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
