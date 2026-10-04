import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  User,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  LogOut,
  ExternalLink,
  CheckCircle2,
  Info,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

/**
 * FlowHRMS - Mobile Account & Security Screen
 * Stitch Screen: FlowHRMS - Mobile Account Screen
 */
export default function AccountScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleUpdatePassword = () => {
    if (!currentPassword) {
      Alert.alert('Required', 'Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Weak Password', 'New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirm password do not match.');
      return;
    }

    Alert.alert('Password Updated', 'Your account password has been successfully updated.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of FlowHRMS on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Signed Out', 'You have been signed out.');
            router.replace('/(tabs)');
          },
        },
      ]
    );
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
            FX & FLOAT • PROFILE
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Account
          </Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleSignOut}
        >
          <LogOut size={18} color={t.colors.status.error.fg} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <Text style={[styles.introText, { color: t.colors.textSecondary }]}>
          Manage your personal authentication and security settings.
        </Text>

        {/* Card 1: Sign-in Details */}
        <Card style={styles.cardSpacing}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: t.colors.brandPrimarySubtle },
              ]}
            >
              <User size={16} color={t.colors.brandPrimary} />
            </View>
            <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
              Sign-in
            </Text>
          </View>

          <View style={styles.infoRows}>
            <View style={[styles.infoRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>Email</Text>
              <Text style={[styles.infoVal, { color: t.colors.textPrimary }]}>
                rishabh17704@gmail.com
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[t.typography.body, { color: t.colors.textSecondary }]}>
                Signed in as
              </Text>
              <View style={styles.roleTagRow}>
                <Text style={[styles.infoVal, { color: t.colors.textPrimary }]}>Rishabh</Text>
                <View
                  style={[
                    styles.ownerBadge,
                    { backgroundColor: t.colors.brandPrimarySubtle },
                  ]}
                >
                  <Text style={[styles.ownerBadgeText, { color: t.colors.brandPrimary }]}>
                    Owner
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.noticeBox,
              {
                backgroundColor: t.colors.surfaceCanvas,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <Info size={14} color={t.colors.textTertiary} style={styles.noticeIcon} />
            <Text style={[styles.noticeText, { color: t.colors.textSecondary }]}>
              Your email is set by your company's admin. To change it, ask them — it is how your
              account is matched to you.
            </Text>
          </View>
        </Card>

        {/* Card 2: Change Password */}
        <Card style={styles.cardSpacing}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: '#FEF3C7' },
              ]}
            >
              <Lock size={16} color="#D97706" />
            </View>
            <View>
              <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                Change password
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                Prove the current one, choose a new one. You stay signed in here.
              </Text>
            </View>
          </View>

          <View style={styles.formFields}>
            {/* Current Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textPrimary }]}>
                Current password <Text style={{ color: t.colors.textTertiary }}>• Required</Text>
              </Text>
              <View
                style={[
                  styles.passwordInputWrap,
                  {
                    borderColor: t.colors.borderDefault,
                    backgroundColor: t.colors.surfaceDefault,
                  },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: t.colors.textPrimary }]}
                  placeholder="Enter current password"
                  placeholderTextColor={t.colors.textTertiary}
                  secureTextEntry={!showCurrent}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                />
                <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? (
                    <EyeOff size={16} color={t.colors.textTertiary} />
                  ) : (
                    <Eye size={16} color={t.colors.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* New Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textPrimary }]}>
                New password <Text style={{ color: t.colors.textTertiary }}>• Min 8 chars</Text>
              </Text>
              <View
                style={[
                  styles.passwordInputWrap,
                  {
                    borderColor: t.colors.borderDefault,
                    backgroundColor: t.colors.surfaceDefault,
                  },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: t.colors.textPrimary }]}
                  placeholder="Enter new strong password"
                  placeholderTextColor={t.colors.textTertiary}
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                  {showNew ? (
                    <EyeOff size={16} color={t.colors.textTertiary} />
                  ) : (
                    <Eye size={16} color={t.colors.textTertiary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textPrimary }]}>
                Confirm new password
              </Text>
              <View
                style={[
                  styles.passwordInputWrap,
                  {
                    borderColor: t.colors.borderDefault,
                    backgroundColor: t.colors.surfaceDefault,
                  },
                ]}
              >
                <TextInput
                  style={[styles.passwordInput, { color: t.colors.textPrimary }]}
                  placeholder="Re-type new password"
                  placeholderTextColor={t.colors.textTertiary}
                  secureTextEntry={!showNew}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.updatePasswordBtn,
                { backgroundColor: t.colors.brandPrimary },
              ]}
              onPress={handleUpdatePassword}
            >
              <Text style={styles.updatePasswordText}>Update Password</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Card 3: Privacy & Consent */}
        <Card style={styles.cardSpacing}>
          <TouchableOpacity
            style={styles.consentNavRow}
            onPress={() => router.push('/consent')}
          >
            <View style={styles.consentLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: t.colors.brandPrimarySubtle },
                ]}
              >
                <ShieldCheck size={16} color={t.colors.brandPrimary} />
              </View>
              <View>
                <Text style={[styles.consentTitle, { color: t.colors.textPrimary }]}>
                  Privacy & Consent Affirmations
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                  Version 1.0 on record • Signed by Owner
                </Text>
              </View>
            </View>
            <ExternalLink size={16} color={t.colors.brandPrimary} />
          </TouchableOpacity>
        </Card>

        {/* Card 4: Sign out button */}
        <TouchableOpacity
          style={[
            styles.signOutBtn,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderColor: t.colors.status.error.border,
            },
          ]}
          onPress={handleSignOut}
        >
          <LogOut size={16} color={t.colors.status.error.fg} />
          <Text style={[styles.signOutBtnText, { color: t.colors.status.error.fg }]}>
            Sign Out of FlowHRMS
          </Text>
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
  logoutBtn: {
    padding: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  introText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  cardSpacing: {
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRows: {
    gap: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
  },
  roleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  noticeIcon: {
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  formFields: {
    gap: 12,
    marginTop: 6,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  passwordInput: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  updatePasswordBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
  },
  updatePasswordText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  consentNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  consentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  consentTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 20,
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
