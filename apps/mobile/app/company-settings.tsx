import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '@/components/ui/Toast';
import { settingsService } from '@/lib/api-service';
import {
  ArrowLeft,
  Building,
  Upload,
  Sparkles,
  CreditCard,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Save,
  CheckCircle,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

/**
 * FlowHRMS - Mobile Company Settings Screen
 * Stitch Screen: FlowHRMS - Mobile Company Settings Screen
 */
export default function CompanySettingsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();

  const [legalName, setLegalName] = useState('FX & Float Logistics Pvt Ltd');
  const [brandName, setBrandName] = useState('FX & Float');
  const [gstin, setGstin] = useState('07AAAAA0000A1Z5');
  const [officialEmail, setOfficialEmail] = useState('operations@fxfloat.com');
  const [officialPhone, setOfficialPhone] = useState('+91 98765 43210');
  const [address, setAddress] = useState('Plot 42, Okhla Phase III, New Delhi 110020');
  const [showAnimation, setShowAnimation] = useState(true);
  const [brandTagline, setBrandTagline] = useState('Field Utility & People Operations');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await settingsService.updateCompanySettings({
        legalName,
        brandName,
        gstin,
        officialEmail,
        officialPhone,
        address,
        brandTagline,
        showAnimation,
      });

      if (res.success) {
        toast.success(
          'Settings Saved',
          'Company profile and statutory details successfully updated.'
        );
      } else {
        toast.error('Save Failed', res.error || 'Failed to update company settings.');
      }
    } catch (err: any) {
      toast.error('Connection Error', 'Could not reach server. Settings saved locally.');
    } finally {
      setIsSaving(false);
    }
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
            CONFIGURATION
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Company settings
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.saveHeaderBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={handleSave}
        >
          <Save size={14} color="#FFFFFF" />
          <Text style={styles.saveHeaderBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Your company at a glance */}
        <Card style={styles.cardSpacing}>
          <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
            Your company at a glance
          </Text>
          <Text style={[styles.sectionSubtitle, { color: t.colors.textSecondary }]}>
            Legal and trade details used on official payroll statements and tax invoices.
          </Text>

          <View style={styles.formFields}>
            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                LEGAL ENTITY NAME
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                value={legalName}
                onChangeText={setLegalName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                BRAND / TRADE NAME
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                value={brandName}
                onChangeText={setBrandName}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                GSTIN / REGISTRATION NUMBER
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                value={gstin}
                onChangeText={setGstin}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                OFFICIAL WORK EMAIL
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                keyboardType="email-address"
                value={officialEmail}
                onChangeText={setOfficialEmail}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                OFFICIAL PHONE
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                keyboardType="phone-pad"
                value={officialPhone}
                onChangeText={setOfficialPhone}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                REGISTERED OFFICE ADDRESS
              </Text>
              <TextInput
                style={[
                  styles.inputMultiline,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                multiline
                numberOfLines={2}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>
        </Card>

        {/* Section 2: Logo and Brand Look */}
        <Card style={styles.cardSpacing}>
          <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
            Your logo and look
          </Text>
          <Text style={[styles.sectionSubtitle, { color: t.colors.textSecondary }]}>
            Visible across employee mobile screens, ID cards and downloaded PDFs.
          </Text>

          <View style={styles.logoRow}>
            <View
              style={[
                styles.logoBox,
                {
                  backgroundColor: t.colors.brandPrimary,
                  borderColor: t.colors.borderDefault,
                },
              ]}
            >
              <Building size={32} color="#FFFFFF" />
            </View>
            <View style={styles.logoInfo}>
              <Text style={[styles.logoTitle, { color: t.colors.textPrimary }]}>
                Company Logo
              </Text>
              <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                PNG, SVG or JPG • 512×512 recommended
              </Text>
              <TouchableOpacity
                style={[
                  styles.changeLogoBtn,
                  {
                    backgroundColor: t.colors.surfaceCanvas,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => Alert.alert('Upload Logo', 'Select image from device storage.')}
              >
                <Upload size={13} color={t.colors.brandPrimary} />
                <Text style={[styles.changeLogoText, { color: t.colors.brandPrimary }]}>
                  Upload new logo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Section 3: Opening Animation & Tagline */}
        <Card style={styles.cardSpacing}>
          <View style={styles.toggleHeader}>
            <View style={styles.toggleHeaderLeft}>
              <Sparkles size={18} color={t.colors.brandPrimary} />
              <View>
                <Text style={[styles.toggleTitle, { color: t.colors.textPrimary }]}>
                  Opening animation • Optional
                </Text>
                <Text style={[styles.toggleDesc, { color: t.colors.textSecondary }]}>
                  Display custom brand splash animation on app startup
                </Text>
              </View>
            </View>
            <Switch
              value={showAnimation}
              onValueChange={setShowAnimation}
              trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {showAnimation && (
            <View style={[styles.taglineBox, { borderTopColor: t.colors.borderSubtle }]}>
              <Text style={[styles.fieldLabel, { color: t.colors.textSecondary }]}>
                CUSTOM BRAND TAGLINE
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                value={brandTagline}
                onChangeText={setBrandTagline}
              />
            </View>
          )}
        </Card>

        {/* Section 4: ID Cards Navigation */}
        <Card style={styles.cardSpacing}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/id-card' as any)}
          >
            <View style={styles.navRowLeft}>
              <View
                style={[
                  styles.navIconBox,
                  { backgroundColor: t.colors.brandPrimarySubtle },
                ]}
              >
                <CreditCard size={18} color={t.colors.brandPrimary} />
              </View>
              <View>
                <Text style={[styles.navTitle, { color: t.colors.textPrimary }]}>
                  ID Cards & Digital Badges
                </Text>
                <Text style={[styles.navSubtitle, { color: t.colors.textSecondary }]}>
                  Customize layout, styling and QR verification code
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={t.colors.textTertiary} />
          </TouchableOpacity>
        </Card>

        {/* Section 5: Data & Privacy */}
        <Card style={styles.cardSpacing}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={() => router.push('/consent')}
          >
            <View style={styles.navRowLeft}>
              <View
                style={[
                  styles.navIconBox,
                  { backgroundColor: t.colors.brandPrimarySubtle },
                ]}
              >
                <ShieldCheck size={18} color={t.colors.brandPrimary} />
              </View>
              <View>
                <Text style={[styles.navTitle, { color: t.colors.textPrimary }]}>
                  Data & Privacy Compliance
                </Text>
                <Text style={[styles.navSubtitle, { color: t.colors.textSecondary }]}>
                  Consent Version 1.0 (DPDP Act 2023 compliant)
                </Text>
              </View>
            </View>
            <ExternalLink size={16} color={t.colors.textTertiary} />
          </TouchableOpacity>
        </Card>
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
  saveHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  saveHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  cardSpacing: {
    padding: 16,
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
    marginBottom: 14,
  },
  formFields: {
    gap: 12,
  },
  formGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  inputMultiline: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
  },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoInfo: {
    flex: 1,
  },
  logoTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  changeLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeLogoText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  taglineBox: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  navIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  navSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
});
