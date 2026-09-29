import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { User, Building2, Clock, Mail, Shield, LogOut, ChevronRight, Bell } from 'lucide-react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'dark';
  const theme = Colors[colorScheme];

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of FlowHRMS?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          Alert.alert('Signed Out', 'You have been signed out.');
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={[styles.profileHeaderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>JD</Text>
        </View>
        <Text style={[styles.name, { color: theme.text }]}>John Doe</Text>
        <Text style={[styles.designation, { color: theme.tint }]}>Senior Field Associate</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Building2 size={14} color={theme.tabIconDefault} />
            <Text style={[styles.metaText, { color: theme.tabIconDefault }]}>Branch A (HQ)</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={14} color={theme.tabIconDefault} />
            <Text style={[styles.metaText, { color: theme.tabIconDefault }]}>09:00 - 18:00</Text>
          </View>
        </View>
      </View>

      {/* Account Info Section */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Employment Information</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0 }]}>
        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <Mail size={18} color={theme.tabIconDefault} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: theme.tabIconDefault }]}>Work Email</Text>
            <Text style={[styles.rowVal, { color: theme.text }]}>john.doe@company.com</Text>
          </View>
        </View>

        <View style={[styles.row, { borderBottomColor: theme.border }]}>
          <Shield size={18} color={theme.tabIconDefault} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: theme.tabIconDefault }]}>Employee Code</Text>
            <Text style={[styles.rowVal, { color: theme.text }]}>EMP-2026-042</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Building2 size={18} color={theme.tabIconDefault} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: theme.tabIconDefault }]}>Department</Text>
            <Text style={[styles.rowVal, { color: theme.text }]}>Operations & Delivery</Text>
          </View>
        </View>
      </View>

      {/* Preferences */}
      <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferences</Text>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0 }]}>
        <TouchableOpacity style={[styles.row, { borderBottomColor: theme.border }]}>
          <Bell size={18} color={theme.tabIconDefault} />
          <Text style={[styles.rowVal, { flex: 1, color: theme.text }]}>Push Notifications</Text>
          <ChevronRight size={18} color={theme.tabIconDefault} />
        </TouchableOpacity>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.signOutButton} activeOpacity={0.8} onPress={handleSignOut}>
        <LogOut size={18} color="#E05252" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  profileHeaderCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7166F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700' },
  designation: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#FFFFFF10',
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    borderBottomWidth: 1,
  },
  rowLabel: { fontSize: 11, marginBottom: 2 },
  rowVal: { fontSize: 14, fontWeight: '600' },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#E0525215',
    gap: 8,
    marginTop: 8,
  },
  signOutText: { color: '#E05252', fontSize: 15, fontWeight: '700' },
});
