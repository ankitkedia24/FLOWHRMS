import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Check,
  X,
  FileText,
  ExternalLink,
  ArrowRight,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { FlowHRMSLogo } from '@/components/brand/FlowHRMSLogo';

interface ConsentModalProps {
  visible: boolean;
  userName?: string;
  onAgree: () => void;
  onDecline: () => void;
  onClose?: () => void;
}

interface AffirmationItem {
  id: string;
  text: string;
  required: boolean;
}

const AFFIRMATIONS: AffirmationItem[] = [
  {
    id: '1',
    text: 'I am 18 years of age or older.',
    required: true,
  },
  {
    id: '2',
    text: 'I am authorised to register this company and to accept the Terms of Service on its behalf.',
    required: true,
  },
  {
    id: '3',
    text: 'I have read and accept the Terms of Service and the Privacy Policy.',
    required: true,
  },
  {
    id: '4',
    text: "I understand that my company is responsible (as Data Fiduciary) for its employees' personal data in FlowHRMS, and that Flowacord processes it on the company's instructions.",
    required: true,
  },
  {
    id: '5',
    text: 'Use my details to create and run my FlowHRMS account and free trial, including service and security messages.',
    required: true,
  },
  {
    id: '6',
    text: 'Keep security logs and proof of this consent, and meet legal obligations.',
    required: true,
  },
  {
    id: 'marketing',
    text: 'Send me product updates and offers by email or WhatsApp. (Optional — you can use FlowHRMS without this.)',
    required: false,
  },
];

/**
 * DPDP 2023 Consent & Data Governance Modal
 * Faithful implementation of Stitch "FlowHRMS - Mobile Consent Screen".
 * Compliant with Digital Personal Data Protection Act, 2023.
 */
export function ConsentModal({
  visible,
  userName = 'Rishabh',
  onAgree,
  onDecline,
  onClose,
}: ConsentModalProps) {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);

  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const requiredItems = AFFIRMATIONS.filter((item) => item.required);
  const allRequiredChecked = requiredItems.every((item) => checkedIds[item.id]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose || onDecline}
    >
      <SafeAreaView
        style={[
          styles.safeArea,
          { backgroundColor: t.colors.surfaceDefault },
        ]}
      >
        {/* Navigation Bar */}
        <View
          style={[
            styles.navBar,
            { borderBottomColor: t.colors.borderSubtle },
          ]}
        >
          <TouchableOpacity
            onPress={onClose || onDecline}
            style={styles.closeBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={20} color={t.colors.textSecondary} />
          </TouchableOpacity>

          <FlowHRMSLogo width={120} height={22} variant={colorScheme === 'dark' ? 'dark' : 'light'} />

          <View
            style={[
              styles.dpdpTag,
              {
                backgroundColor: t.colors.brandPrimarySubtle,
                borderColor: t.colors.brandPrimarySubtleHover,
              },
            ]}
          >
            <Text
              style={[styles.dpdpText, { color: t.colors.brandPrimary }]}
            >
              DPDP 2023
            </Text>
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Greeting Header */}
          <Text style={[styles.mainTitle, { color: t.colors.brandNavy }]}>
            Before you continue
          </Text>
          <Text style={[styles.subtitle, { color: t.colors.textSecondary }]}>
            <Text style={[styles.boldText, { color: t.colors.brandNavy }]}>
              {userName}
            </Text>
            , please read how your personal data is used in FlowHRMS and give
            your consent. You can withdraw it later from{' '}
            <Text style={{ color: t.colors.brandPrimary, fontWeight: '600' }}>
              Account → Privacy & consent
            </Text>
            .
          </Text>

          {/* DPDP Trust Reassurance Banner */}
          <View
            style={[
              styles.reassuranceBanner,
              {
                backgroundColor: t.colors.brandPrimarySubtle,
                borderColor: t.colors.brandPrimarySubtleHover,
              },
            ]}
          >
            <View
              style={[
                styles.shieldIconWrap,
                { backgroundColor: t.colors.brandPrimary },
              ]}
            >
              <ShieldCheck size={16} color="#FFFFFF" />
            </View>
            <View style={styles.reassuranceTextCol}>
              <Text
                style={[
                  styles.reassuranceTitle,
                  { color: t.colors.brandNavy },
                ]}
              >
                Evidence, not surveillance
              </Text>
              <Text
                style={[
                  styles.reassuranceDesc,
                  { color: t.colors.textSecondary },
                ]}
              >
                Location is captured strictly at check-in/out moments. Continuous
                background tracking is disabled by default adhering to Indian DPDP
                Act 2023 principles.
              </Text>
            </View>
          </View>

          {/* Legal Notice Box */}
          <View
            style={[
              styles.legalBox,
              {
                backgroundColor: t.colors.surfaceDefault,
                borderColor: t.colors.borderDefault,
              },
            ]}
          >
            <View
              style={[
                styles.legalHeader,
                {
                  backgroundColor: t.colors.surfaceSunken,
                  borderBottomColor: t.colors.borderSubtle,
                },
              ]}
            >
              <View style={styles.legalTitleRow}>
                <FileText size={15} color={t.colors.brandPrimary} />
                <Text
                  style={[
                    styles.legalHeadingText,
                    { color: t.colors.brandNavy },
                  ]}
                >
                  NOTICE OF DATA GOVERNANCE
                </Text>
              </View>
              <View
                style={[
                  styles.versionTag,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.versionText,
                    { color: t.colors.textTertiary },
                  ]}
                >
                  v2.0 (India)
                </Text>
              </View>
            </View>

            <View style={styles.legalBody}>
              <Text style={[styles.legalClauseTitle, { color: t.colors.textPrimary }]}>
                Registering a company on FlowHRMS
              </Text>
              <Text style={[styles.legalClauseBody, { color: t.colors.textSecondary }]}>
                By registering a company you confirm who you are, that you may act
                for the company, and that the company is responsible for its
                employees' personal data in FlowHRMS.
              </Text>

              <Text
                style={[
                  styles.legalClauseTitle,
                  { color: t.colors.textPrimary, marginTop: 8 },
                ]}
              >
                Who is responsible for employees' data
              </Text>
              <Text style={[styles.legalClauseBody, { color: t.colors.textSecondary }]}>
                Your company will enter and collect its employees' personal data
                in FlowHRMS — names and contact details, attendance times,
                location at the moment of check-in and check-out, leave, tasks,
                salary, and documents. For that data your company is the Data
                Fiduciary under the Digital Personal Data Protection Act, 2023.
                Flowacord processes it only on instructions as its Data Processor.
              </Text>

              <Text
                style={[
                  styles.legalClauseTitle,
                  { color: t.colors.textPrimary, marginTop: 8 },
                ]}
              >
                Questions, grievances and complaints
              </Text>
              <Text style={[styles.legalClauseBody, { color: t.colors.textSecondary }]}>
                Contact our Grievance Officer, Flowacord at help@flowacord.com.
                Signed-in users can also raise requests from Account → Privacy &
                consent.
              </Text>
            </View>
          </View>

          {/* Affirmations Checkbox List */}
          <View style={styles.affirmationsSection}>
            <View style={styles.affirmationsHeader}>
              <Text
                style={[
                  styles.affirmationsTitle,
                  { color: t.colors.brandNavy },
                ]}
              >
                Your Affirmations & Permissions
              </Text>
              <Text
                style={[
                  styles.affirmationsCounter,
                  { color: t.colors.textTertiary },
                ]}
              >
                6 Required
              </Text>
            </View>

            {AFFIRMATIONS.map((item) => {
              const isChecked = !!checkedIds[item.id];
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.checkboxRow,
                    {
                      backgroundColor: t.colors.surfaceDefault,
                      borderColor: isChecked
                        ? t.colors.brandPrimary
                        : t.colors.borderDefault,
                    },
                  ]}
                  onPress={() => toggleCheck(item.id)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.checkboxSquare,
                      {
                        borderColor: isChecked
                          ? t.colors.brandPrimary
                          : t.colors.borderStrong,
                        backgroundColor: isChecked
                          ? t.colors.brandPrimary
                          : 'transparent',
                      },
                    ]}
                  >
                    {isChecked && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                  </View>

                  <View style={styles.affirmationTextCol}>
                    <Text
                      style={[
                        styles.affirmationText,
                        { color: t.colors.textPrimary },
                      ]}
                    >
                      {item.text}
                    </Text>
                    <Text
                      style={[
                        styles.requiredTag,
                        item.required
                          ? { color: t.colors.status.error.text }
                          : { color: t.colors.textTertiary },
                      ]}
                    >
                      {item.required ? 'Required' : 'Optional'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Sticky Bottom Actions */}
        <View
          style={[
            styles.bottomStickyBar,
            {
              backgroundColor: t.colors.surfaceDefault,
              borderTopColor: t.colors.borderSubtle,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.agreeButton,
              allRequiredChecked
                ? { backgroundColor: t.colors.brandPrimary }
                : { backgroundColor: t.colors.surfaceDisabled },
            ]}
            disabled={!allRequiredChecked}
            onPress={onAgree}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.agreeButtonText,
                allRequiredChecked
                  ? { color: '#FFFFFF' }
                  : { color: t.colors.textDisabled },
              ]}
            >
              I agree — continue
            </Text>
            <ArrowRight
              size={16}
              color={allRequiredChecked ? '#FFFFFF' : t.colors.textDisabled}
            />
          </TouchableOpacity>

          <Text
            style={[
              styles.helperText,
              allRequiredChecked
                ? { color: t.colors.status.success.text }
                : { color: t.colors.textTertiary },
            ]}
          >
            {allRequiredChecked
              ? '✓ All requirements met. You can now proceed.'
              : 'Tick every box marked Required to continue.'}
          </Text>

          <TouchableOpacity onPress={onDecline} activeOpacity={0.7}>
            <Text
              style={[styles.declineText, { color: t.colors.brandPrimary }]}
            >
              I don't agree — sign out
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 6,
  },
  dpdpTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  dpdpText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '700',
  },
  reassuranceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  shieldIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reassuranceTextCol: {
    flex: 1,
  },
  reassuranceTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  reassuranceDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  legalBox: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  legalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  legalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legalHeadingText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  versionTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '600',
  },
  legalBody: {
    padding: 14,
  },
  legalClauseTitle: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  legalClauseBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  affirmationsSection: {
    gap: 10,
  },
  affirmationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  affirmationsTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  affirmationsCounter: {
    fontSize: 11,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  affirmationTextCol: {
    flex: 1,
  },
  affirmationText: {
    fontSize: 12,
    lineHeight: 17,
  },
  requiredTag: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  bottomStickyBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  agreeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
  },
  agreeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 11,
    textAlign: 'center',
  },
  declineText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});

export default ConsentModal;
