import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert as RNAlert,
} from 'react-native';
import {
  User,
  Mail,
  Shield,
  FileText,
  CreditCard,
  ChevronRight,
  LogOut,
  MapPin,
  Moon,
  CloudCheck,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { useRouter } from 'expo-router';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { useAuth } from '@/lib/auth-context';

/**
 * Profile Screen
 * 1:1 Mirror of Web Employee Profile Shell (Screen E16).
 */
export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [darkMode, setDarkMode] = useState(false);
  const [offlineSync, setOfflineSync] = useState(true);

  const displayName = user?.name || user?.email?.split('@')[0] || 'Employee';
  const displayEmail = user?.email || 'user@flowhrms.com';
  const displayRole = user?.role || 'Employee';
  const displayCluster = user?.cluster || user?.tenant?.name || 'Jaipur Cluster';
  const displayCode = user?.employeeCode || 'EMP-0001';
  const displayInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : (user?.email ? user.email.substring(0, 2).toUpperCase() : 'EM');

  const handleSignOut = () => {
    RNAlert.alert(
      'Sign Out',
      'Are you sure you want to sign out of FlowHRMS on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login' as any);
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.colors.surfaceCanvasWarm }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[t.typography.h1, { color: t.colors.textPrimary, marginBottom: 14 }]}>
        Profile
      </Text>

      {/* ========================================================
          MEMBER IDENTITY CARD
         ======================================================== */}
      <Card>
        <View style={styles.profileRow}>
          {/* Avatar with initials */}
          <View
            style={[
              styles.avatar,
              { backgroundColor: t.colors.brandPrimarySubtle },
            ]}
          >
            <Text
              style={[
                t.typography.h2,
                { color: t.colors.brandPrimary, fontWeight: '700' },
              ]}
            >
              {displayInitials}
            </Text>
          </View>

          <View style={styles.profileDetails}>
            <Text
              style={[
                t.typography.bodyLg,
                { color: t.colors.textPrimary, fontWeight: '700' },
              ]}
            >
              {displayName}
            </Text>
            <Text
              style={[
                t.typography.secondary,
                { color: t.colors.textSecondary, marginTop: 2 },
              ]}
            >
              {displayRole} · {displayCluster}
            </Text>
            <Text
              style={[
                t.typography.mono,
                { color: t.colors.textTertiary, marginTop: 2 },
              ]}
            >
              {displayCode}
            </Text>
          </View>
        </View>
      </Card>

      {/* ========================================================
          ACCOUNT DETAILS
         ======================================================== */}
      <Card>
        <CardHeader title="Account" />
        <View style={styles.fieldList}>
          <View style={styles.fieldRow}>
            <Text style={[t.typography.secondary, { color: t.colors.textSecondary }]}>
              Email
            </Text>
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary },
              ]}
            >
              {displayEmail}
            </Text>
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: t.colors.borderSubtle },
            ]}
          />

          <View style={styles.fieldRow}>
            <Text style={[t.typography.secondary, { color: t.colors.textSecondary }]}>
              Account Status
            </Text>
            <StatusChip
              status={{ key: 'active', label: 'Active', tone: 'success' }}
              size="sm"
            />
          </View>

          <View
            style={[
              styles.divider,
              { backgroundColor: t.colors.borderSubtle },
            ]}
          />

          <View style={styles.fieldRow}>
            <Text style={[t.typography.secondary, { color: t.colors.textSecondary }]}>
              Assigned Branch
            </Text>
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary },
              ]}
            >
              {displayCluster}
            </Text>
          </View>
        </View>
      </Card>

      {/* ========================================================
          YOUR RECORDS & VAULT
         ======================================================== */}
      <Card>
        <CardHeader title="Your Records & Vault" />
        <TouchableOpacity
          style={styles.recordLink}
          onPress={() => router.push('/id-card' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.recordLeft}>
            <CreditCard size={18} color={t.colors.brandPrimary} />
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary, marginLeft: 10 },
              ]}
            >
              Digital ID Card Studio
            </Text>
          </View>
          <ChevronRight size={18} color={t.colors.textTertiary} />
        </TouchableOpacity>

        <View
          style={[
            styles.divider,
            { backgroundColor: t.colors.borderSubtle },
          ]}
        />

        <TouchableOpacity
          style={styles.recordLink}
          onPress={() => router.push('/payslips' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.recordLeft}>
            <FileText size={18} color={t.colors.brandPrimary} />
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary, marginLeft: 10 },
              ]}
            >
              Payslips & Tax Slips
            </Text>
          </View>
          <ChevronRight size={18} color={t.colors.textTertiary} />
        </TouchableOpacity>

        <View
          style={[
            styles.divider,
            { backgroundColor: t.colors.borderSubtle },
          ]}
        />

        <TouchableOpacity
          style={styles.recordLink}
          onPress={() => router.push('/documents' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.recordLeft}>
            <Shield size={18} color={t.colors.brandPrimary} />
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary, marginLeft: 10 },
              ]}
            >
              Encrypted Documents Vault
            </Text>
          </View>
          <ChevronRight size={18} color={t.colors.textTertiary} />
        </TouchableOpacity>

        <View
          style={[
            styles.divider,
            { backgroundColor: t.colors.borderSubtle },
          ]}
        />

        <TouchableOpacity
          style={styles.recordLink}
          onPress={() => router.push('/account' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.recordLeft}>
            <User size={18} color={t.colors.brandPrimary} />
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary, marginLeft: 10 },
              ]}
            >
              Account & Password Security
            </Text>
          </View>
          <ChevronRight size={18} color={t.colors.textTertiary} />
        </TouchableOpacity>
      </Card>

      {/* ========================================================
          DEVICE PREFERENCES
         ======================================================== */}
      <Card>
        <CardHeader title="Preferences" />
        <View style={styles.prefRow}>
          <View style={styles.prefLeft}>
            <Moon size={18} color={t.colors.textSecondary} />
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary, marginLeft: 10 },
              ]}
            >
              Dark Theme
            </Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: t.colors.borderDefault, true: t.colors.brandPrimary }}
          />
        </View>

        <View
          style={[
            styles.divider,
            { backgroundColor: t.colors.borderSubtle },
          ]}
        />

        <View style={styles.prefRow}>
          <View style={styles.prefLeft}>
            <MapPin size={18} color={t.colors.status.success.fg} />
            <Text
              style={[
                t.typography.bodyMedium,
                { color: t.colors.textPrimary, marginLeft: 10 },
              ]}
            >
              GPS Verification
            </Text>
          </View>
          <StatusChip
            status={{ key: 'authorized', label: 'Authorized', tone: 'success' }}
            size="sm"
            dot={false}
          />
        </View>
      </Card>

      {/* ========================================================
          SIGN OUT BUTTON (dangerSubtle variant)
         ======================================================== */}
      <View style={{ marginTop: 8, marginBottom: 24 }}>
        <Button
          variant="dangerSubtle"
          size="lg"
          leadingIcon={<LogOut size={18} color={t.colors.status.error.fg} />}
          onPress={handleSignOut}
        >
          Sign Out of FlowHRMS
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileDetails: {
    flex: 1,
  },
  fieldList: {
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  recordLink: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
