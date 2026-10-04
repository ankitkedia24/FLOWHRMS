import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Building2,
  User,
  Phone,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  KeyRound,
  Fingerprint,
  Users,
  Briefcase,
  ExternalLink,
  X,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { ConsentModal } from '@/components/ui/ConsentModal';

type AuthMode = 'sign-in' | 'sign-up';

/**
 * Mobile Authentication Screen (Sign In & Sign Up / Start Free Trial)
 * Designed to mirror FlowHRMS web authentication (Screen E1 & /start)
 * following the "Respectful Field Utility" design system with warm canvas,
 * crisp inputs, instant demo profile switchers, and full DPDP 2023 compliance.
 */
export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [loading, setLoading] = useState(false);

  // Sign In Form State
  const [email, setEmail] = useState('admin@flowacord.com');
  const [password, setPassword] = useState('FlowHRMS2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up / Trial Form State
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [teamSize, setTeamSize] = useState('11-50');
  const [industry, setIndustry] = useState('Logistics & Fleet');
  const [consentAgreed, setConsentAgreed] = useState(false);

  // Modals
  const [forgotModalVisible, setForgotModalVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [consentModalVisible, setConsentModalVisible] = useState(false);

  // Quick Demo Account Selectors
  const fillDemoAccount = (role: 'owner' | 'field') => {
    if (role === 'owner') {
      setEmail('admin@flowacord.com');
      setPassword('FlowHRMS2026!');
    } else {
      setEmail('ramesh.kumar@flowacord.com');
      setPassword('JaipurField2026#');
    }
  };

  const handleSignIn = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Incomplete Fields', 'Please enter your work email and password.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Welcome Back!',
        `Authenticated as ${email.includes('admin') ? 'Workspace Owner' : 'Field Specialist'}. Access granted to Jaipur Cluster.`,
        [
          {
            text: 'Enter Workspace',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    }, 900);
  };

  const handleSignUp = () => {
    if (!companyName.trim()) {
      Alert.alert('Missing Field', 'Please enter your registered company or warehouse name.');
      return;
    }
    if (!fullName.trim()) {
      Alert.alert('Missing Field', 'Please enter your full name.');
      return;
    }
    if (!workEmail.trim() || !workEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid work email address.');
      return;
    }
    if (!mobileNumber.trim() || mobileNumber.length < 10) {
      Alert.alert('Invalid Mobile', 'Please enter a valid 10-digit Indian mobile number for OTP & WhatsApp notifications.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return;
    }
    if (!consentAgreed) {
      Alert.alert(
        'DPDP Consent Required',
        'Please review and agree to the Digital Personal Data Protection (DPDP Act 2023) terms to activate your trial.'
      );
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Workspace Created!',
        `Your 30-day Free Trial for "${companyName}" is active with full Pro access for ${teamSize} employees.`,
        [
          {
            text: 'Launch FlowHRMS',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    }, 1200);
  };

  const handleBiometricAuth = () => {
    Alert.alert(
      'Biometric Sign In',
      'Scanning Face ID / Fingerprint sensor...',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simulate Match',
          onPress: () => {
            Alert.alert('Verified', 'Biometric identity verified for EMP-0001 (Rishabh Kedia).');
            router.replace('/(tabs)');
          },
        },
      ]
    );
  };

  const handleSendResetLink = () => {
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid registered email address.');
      return;
    }
    setForgotSent(true);
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: t.colors.surfaceCanvasWarm }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Brand Lockup */}
          <View style={styles.brandLockup}>
            <View style={[styles.brandIconWrap, { backgroundColor: t.colors.brandPrimary }]}>
              <Sparkles size={24} color="#FFFFFF" />
            </View>
            <View style={styles.brandTitleRow}>
              <Text style={[styles.brandName, { color: t.colors.brandNavy }]}>Flow</Text>
              <Text style={[styles.brandNameBold, { color: t.colors.brandPrimary }]}>HRMS</Text>
            </View>
            <Text style={[styles.brandTagline, { color: t.colors.textSecondary }]}>
              Modern Field Workforce Management & Indian SME Compliance
            </Text>
          </View>

          {/* Mode Switcher Segmented Tabs */}
          <View
            style={[
              styles.segmentContainer,
              {
                backgroundColor: t.colors.surfaceSunken,
                borderColor: t.colors.borderSubtle,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segmentTab,
                mode === 'sign-in' && [
                  styles.segmentTabActive,
                  { backgroundColor: t.colors.surfaceDefault },
                ],
              ]}
              onPress={() => setMode('sign-in')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  { color: mode === 'sign-in' ? t.colors.brandNavy : t.colors.textTertiary },
                  mode === 'sign-in' && styles.segmentTabTextActive,
                ]}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentTab,
                mode === 'sign-up' && [
                  styles.segmentTabActive,
                  { backgroundColor: t.colors.surfaceDefault },
                ],
              ]}
              onPress={() => setMode('sign-up')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  { color: mode === 'sign-up' ? t.colors.brandNavy : t.colors.textTertiary },
                  mode === 'sign-up' && styles.segmentTabTextActive,
                ]}
              >
                Start Free Trial
              </Text>
              <View
                style={[
                  styles.freePill,
                  { backgroundColor: t.colors.accentPositiveBg },
                ]}
              >
                <Text
                  style={[
                    styles.freePillText,
                    { color: t.colors.status.success.text },
                  ]}
                >
                  30D FREE
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* ========================================================
              MODE 1: SIGN IN
             ======================================================== */}
          {mode === 'sign-in' ? (
            <View style={styles.formSection}>
              {/* Live Status Highlight */}
              <View
                style={[
                  styles.livePulseCard,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <View style={styles.livePulseLeft}>
                  <View style={[styles.liveDot, { backgroundColor: t.colors.accentPositive }]} />
                  <Text style={[styles.livePulseText, { color: t.colors.textPrimary }]}>
                    Jaipur Cluster • 142 Active On-Field
                  </Text>
                </View>
                <StatusChip status={{ key: 'live', label: 'Live Shift', tone: 'success' }} size="sm" />
              </View>

              {/* Demo Account Quick Switcher */}
              <View style={styles.demoSwitcherBox}>
                <Text style={[styles.demoSwitcherLabel, { color: t.colors.textTertiary }]}>
                  QUICK DEMO CREDENTIALS (1-TAP FILL)
                </Text>
                <View style={styles.demoChipsRow}>
                  <TouchableOpacity
                    style={[
                      styles.demoChip,
                      email === 'admin@flowacord.com' && {
                        backgroundColor: t.colors.brandPrimarySubtle,
                        borderColor: t.colors.brandPrimary,
                      },
                      { borderColor: t.colors.borderDefault, backgroundColor: t.colors.surfaceDefault },
                    ]}
                    onPress={() => fillDemoAccount('owner')}
                  >
                    <Text style={styles.demoChipEmoji}>👑</Text>
                    <Text
                      style={[
                        styles.demoChipText,
                        { color: email === 'admin@flowacord.com' ? t.colors.brandPrimary : t.colors.textPrimary },
                      ]}
                    >
                      Owner / Admin
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.demoChip,
                      email === 'ramesh.kumar@flowacord.com' && {
                        backgroundColor: t.colors.brandPrimarySubtle,
                        borderColor: t.colors.brandPrimary,
                      },
                      { borderColor: t.colors.borderDefault, backgroundColor: t.colors.surfaceDefault },
                    ]}
                    onPress={() => fillDemoAccount('field')}
                  >
                    <Text style={styles.demoChipEmoji}>🚚</Text>
                    <Text
                      style={[
                        styles.demoChipText,
                        { color: email === 'ramesh.kumar@flowacord.com' ? t.colors.brandPrimary : t.colors.textPrimary },
                      ]}
                    >
                      Field Specialist
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Inputs Form */}
              <Card style={styles.formCard}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    WORK EMAIL OR EMPLOYEE CODE
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <Mail size={18} color={t.colors.textTertiary} />
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="you@company.in or EMP-0001"
                      placeholderTextColor={t.colors.textTertiary}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                      PASSWORD
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setForgotEmail(email);
                        setForgotSent(false);
                        setForgotModalVisible(true);
                      }}
                    >
                      <Text style={[styles.forgotLink, { color: t.colors.brandPrimary }]}>
                        Forgot?
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <Lock size={18} color={t.colors.textTertiary} />
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="Enter password"
                      placeholderTextColor={t.colors.textTertiary}
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {showPassword ? (
                        <EyeOff size={18} color={t.colors.textTertiary} />
                      ) : (
                        <Eye size={18} color={t.colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Remember Me Option */}
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: rememberMe ? t.colors.brandPrimary : t.colors.borderDefault },
                      rememberMe && { backgroundColor: t.colors.brandPrimary },
                    ]}
                  >
                    {rememberMe && <CheckCircle2 size={13} color="#FFFFFF" />}
                  </View>
                  <Text style={[styles.rememberText, { color: t.colors.textSecondary }]}>
                    Keep me signed in on this mobile device
                  </Text>
                </TouchableOpacity>

                {/* Primary Sign In Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: t.colors.brandPrimary },
                    loading && { opacity: 0.8 },
                  ]}
                  onPress={handleSignIn}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Sign In to Workspace</Text>
                      <ArrowRight size={17} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>

                {/* Biometric Sign In Option */}
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: t.colors.borderSubtle }]} />
                  <Text style={[styles.dividerText, { color: t.colors.textTertiary }]}>OR</Text>
                  <View style={[styles.dividerLine, { backgroundColor: t.colors.borderSubtle }]} />
                </View>

                <TouchableOpacity
                  style={[
                    styles.biometricBtn,
                    {
                      backgroundColor: t.colors.surfaceDefault,
                      borderColor: t.colors.borderDefault,
                    },
                  ]}
                  onPress={handleBiometricAuth}
                  activeOpacity={0.7}
                >
                  <Fingerprint size={20} color={t.colors.brandPrimary} />
                  <Text style={[styles.biometricBtnText, { color: t.colors.textPrimary }]}>
                    Sign in with Fingerprint / Face ID
                  </Text>
                </TouchableOpacity>
              </Card>
            </View>
          ) : (
            /* ========================================================
               MODE 2: SIGN UP / START FREE TRIAL
               ======================================================== */
            <View style={styles.formSection}>
              {/* Free Trial Banner */}
              <View
                style={[
                  styles.trialBanner,
                  {
                    backgroundColor: t.colors.brandPrimarySubtle,
                    borderColor: t.colors.borderSubtle,
                  },
                ]}
              >
                <Sparkles size={20} color={t.colors.brandPrimary} />
                <View style={styles.trialBannerTextWrap}>
                  <Text style={[styles.trialBannerTitle, { color: t.colors.brandNavy }]}>
                    30-Day Unrestricted Free Trial
                  </Text>
                  <Text style={[styles.trialBannerSub, { color: t.colors.textSecondary }]}>
                    No credit card required. Full Pro features for your field team.
                  </Text>
                </View>
              </View>

              <Card style={styles.formCard}>
                {/* Company Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    COMPANY / WAREHOUSE LEGAL NAME *
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <Building2 size={18} color={t.colors.textTertiary} />
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="e.g. Jaipur Float Logistics Pvt Ltd"
                      placeholderTextColor={t.colors.textTertiary}
                      value={companyName}
                      onChangeText={setCompanyName}
                    />
                  </View>
                </View>

                {/* Owner Name */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    YOUR FULL NAME *
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <User size={18} color={t.colors.textTertiary} />
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="e.g. Rishabh Kedia"
                      placeholderTextColor={t.colors.textTertiary}
                      value={fullName}
                      onChangeText={setFullName}
                    />
                  </View>
                </View>

                {/* Work Email */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    WORK EMAIL ADDRESS *
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <Mail size={18} color={t.colors.textTertiary} />
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="you@company.in"
                      placeholderTextColor={t.colors.textTertiary}
                      value={workEmail}
                      onChangeText={setWorkEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Mobile / WhatsApp Number */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    WHATSAPP / MOBILE NUMBER (+91) *
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <Phone size={18} color={t.colors.textTertiary} />
                    <Text style={[styles.prefixText, { color: t.colors.textSecondary }]}>+91</Text>
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="98765 43210"
                      placeholderTextColor={t.colors.textTertiary}
                      value={mobileNumber}
                      onChangeText={setMobileNumber}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    CREATE MASTER PASSWORD *
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <Lock size={18} color={t.colors.textTertiary} />
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="Minimum 8 characters"
                      placeholderTextColor={t.colors.textTertiary}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showNewPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeBtn}
                    >
                      {showNewPassword ? (
                        <EyeOff size={18} color={t.colors.textTertiary} />
                      ) : (
                        <Eye size={18} color={t.colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Team Size Selector */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    TOTAL FIELD & WAREHOUSE STAFF
                  </Text>
                  <View style={styles.pillsGrid}>
                    {['1-10', '11-50', '51-200', '200+'].map((sz) => (
                      <TouchableOpacity
                        key={sz}
                        style={[
                          styles.pillOption,
                          teamSize === sz && [
                            styles.pillOptionActive,
                            { backgroundColor: t.colors.brandPrimarySubtle, borderColor: t.colors.brandPrimary },
                          ],
                          { borderColor: t.colors.borderDefault, backgroundColor: t.colors.surfaceSunken },
                        ]}
                        onPress={() => setTeamSize(sz)}
                      >
                        <Text
                          style={[
                            styles.pillOptionText,
                            { color: teamSize === sz ? t.colors.brandPrimary : t.colors.textSecondary },
                            teamSize === sz && { fontWeight: '700' },
                          ]}
                        >
                          {sz}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Industry Selector */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    PRIMARY INDUSTRY
                  </Text>
                  <View style={styles.pillsGrid}>
                    {[
                      'Logistics & Fleet',
                      'Wholesale & Trade',
                      'Manufacturing',
                      'Field Services',
                    ].map((ind) => (
                      <TouchableOpacity
                        key={ind}
                        style={[
                          styles.pillOptionWide,
                          industry === ind && [
                            styles.pillOptionActive,
                            { backgroundColor: t.colors.brandPrimarySubtle, borderColor: t.colors.brandPrimary },
                          ],
                          { borderColor: t.colors.borderDefault, backgroundColor: t.colors.surfaceSunken },
                        ]}
                        onPress={() => setIndustry(ind)}
                      >
                        <Text
                          style={[
                            styles.pillOptionText,
                            { color: industry === ind ? t.colors.brandPrimary : t.colors.textSecondary },
                            industry === ind && { fontWeight: '700' },
                          ]}
                        >
                          {ind}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* DPDP Consent Checkbox */}
                <View style={styles.consentRow}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      { borderColor: consentAgreed ? t.colors.brandPrimary : t.colors.borderDefault },
                      consentAgreed && { backgroundColor: t.colors.brandPrimary },
                    ]}
                    onPress={() => setConsentAgreed(!consentAgreed)}
                    activeOpacity={0.8}
                  >
                    {consentAgreed && <CheckCircle2 size={13} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <View style={styles.consentTextWrap}>
                    <Text style={[styles.consentText, { color: t.colors.textSecondary }]}>
                      I agree to the processing of employee attendance data under the{' '}
                      <Text
                        style={[styles.consentLink, { color: t.colors.brandPrimary }]}
                        onPress={() => setConsentModalVisible(true)}
                      >
                        Digital Personal Data Protection (DPDP Act 2023)
                      </Text>{' '}
                      and Terms of Service.
                    </Text>
                  </View>
                </View>

                {/* Submit Sign Up Button */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: t.colors.brandPrimary },
                    loading && { opacity: 0.8 },
                  ]}
                  onPress={handleSignUp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>Create Company & Start Trial</Text>
                      <ArrowRight size={17} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </Card>

              {/* What You Get Card */}
              <View
                style={[
                  styles.featuresNotice,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <Text style={[styles.featuresHeading, { color: t.colors.brandNavy }]}>
                  What happens next?
                </Text>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={16} color={t.colors.status.success.fg} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Instant workspace access with 2 pre-seeded sample field employees.
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={16} color={t.colors.status.success.fg} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Pre-configured Rajasthan Jaipur Geofence radius (200m).
                  </Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={16} color={t.colors.status.success.fg} />
                  <Text style={[styles.featureText, { color: t.colors.textSecondary }]}>
                    Ready-to-compute October 2026 payroll run simulation.
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Footer Security Badge */}
          <View style={styles.securityFooter}>
            <View style={styles.securityBadge}>
              <ShieldCheck size={14} color={t.colors.status.success.fg} />
              <Text style={[styles.securityText, { color: t.colors.textTertiary }]}>
                256-Bit Encrypted • ISO 27001 & DPDP 2023 Compliant • Indian SMEs
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={forgotModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForgotModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <KeyRound size={20} color={t.colors.brandPrimary} />
                <Text style={[styles.modalTitle, { color: t.colors.textPrimary }]}>
                  Reset Password
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setForgotModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={t.colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {forgotSent ? (
              <View style={styles.modalSuccessBody}>
                <CheckCircle2 size={36} color={t.colors.status.success.fg} />
                <Text style={[styles.modalSuccessTitle, { color: t.colors.textPrimary }]}>
                  Reset Link Dispatched
                </Text>
                <Text style={[styles.modalSuccessDesc, { color: t.colors.textSecondary }]}>
                  We have sent password recovery instructions to{' '}
                  <Text style={{ fontWeight: '700', color: t.colors.textPrimary }}>
                    {forgotEmail}
                  </Text>
                  . Please check your inbox and WhatsApp notification.
                </Text>
                <Button
                  variant="primary"
                  size="md"
                  onPress={() => setForgotModalVisible(false)}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  Back to Sign In
                </Button>
              </View>
            ) : (
              <View style={styles.modalBody}>
                <Text style={[styles.modalDesc, { color: t.colors.textSecondary }]}>
                  Enter your registered work email or employee code. We will send you an official
                  recovery link verified by your company admin.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: t.colors.textSecondary }]}>
                    REGISTERED EMAIL
                  </Text>
                  <View
                    style={[
                      styles.inputWrapper,
                      {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                      },
                    ]}
                  >
                    <Mail size={18} color={t.colors.textTertiary} />
                    <TextInput
                      style={[styles.textInput, { color: t.colors.textPrimary }]}
                      placeholder="you@company.in"
                      placeholderTextColor={t.colors.textTertiary}
                      value={forgotEmail}
                      onChangeText={setForgotEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <Button
                  variant="primary"
                  size="lg"
                  onPress={handleSendResetLink}
                  style={{ width: '100%', marginTop: 8 }}
                >
                  Send Recovery Link
                </Button>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* DPDP Consent Modal */}
      <ConsentModal
        visible={consentModalVisible}
        userName={fullName || 'Valued User'}
        onAgree={() => {
          setConsentAgreed(true);
          setConsentModalVisible(false);
        }}
        onDecline={() => setConsentModalVisible(false)}
        onClose={() => setConsentModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  brandLockup: {
    alignItems: 'center',
    marginBottom: 20,
  },
  brandIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandNameBold: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 290,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    marginBottom: 16,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  segmentTabActive: {
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  segmentTabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTabTextActive: {
    fontWeight: '800',
  },
  freePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  freePillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  formSection: {
    gap: 14,
  },
  livePulseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  livePulseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  livePulseText: {
    fontSize: 12,
    fontWeight: '700',
  },
  demoSwitcherBox: {
    gap: 8,
  },
  demoSwitcherLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  demoChipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  demoChipEmoji: {
    fontSize: 14,
  },
  demoChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  formCard: {
    padding: 18,
    borderRadius: 18,
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  forgotLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  prefixText: {
    fontSize: 14,
    fontWeight: '700',
  },
  eyeBtn: {
    padding: 2,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rememberText: {
    fontSize: 12,
    fontWeight: '500',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10,
    fontWeight: '700',
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  biometricBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  trialBannerTextWrap: {
    flex: 1,
  },
  trialBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  trialBannerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillOption: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOptionWide: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillOptionActive: {
    borderWidth: 1.5,
  },
  pillOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 2,
  },
  consentTextWrap: {
    flex: 1,
  },
  consentText: {
    fontSize: 11,
    lineHeight: 16,
  },
  consentLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  featuresNotice: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  featuresHeading: {
    fontSize: 13,
    fontWeight: '800',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  securityFooter: {
    alignItems: 'center',
    marginTop: 24,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 14,
  },
  modalDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  modalSuccessBody: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  modalSuccessTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  modalSuccessDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
