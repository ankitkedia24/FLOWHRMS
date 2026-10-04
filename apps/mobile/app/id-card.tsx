import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Layers,
  Upload,
  QrCode,
  Download,
  RotateCw,
  Palette,
  Sliders,
  Check,
  X,
  Building,
  User,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

/**
 * FlowHRMS - Mobile ID Card Design Screen
 * Stitch Screens: 15 & 17
 */
export default function IdCardScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [orientation, setOrientation] = useState<'upright' | 'sideways'>('upright');
  const [isBackSide, setIsBackSide] = useState(false);

  // Field toggles
  const [showPhoto, setShowPhoto] = useState(true);
  const [showCode, setShowCode] = useState(true);
  const [showDesignation, setShowDesignation] = useState(true);
  const [showBloodGroup, setShowBloodGroup] = useState(true);
  const [showEmergency, setShowEmergency] = useState(true);
  const [showQr, setShowQr] = useState(true);

  // Styling modal
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [activeElement, setActiveElement] = useState('Employee Name');
  const [selectedColor, setSelectedColor] = useState('#181445');
  const [selectedAlign, setSelectedAlign] = useState<'left' | 'center'>('center');

  const handleDownloadPdf = () => {
    Alert.alert(
      'Print-Ready PDF',
      'Generating high-resolution 300 DPI ID card PDF template with crop marks.'
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
            COMPANY SETTINGS
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            ID card design
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.downloadHeaderBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={handleDownloadPdf}
        >
          <Download size={14} color="#FFFFFF" />
          <Text style={styles.downloadHeaderBtnText}>PDF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Intro */}
        <Text style={[styles.introText, { color: t.colors.textSecondary }]}>
          Upload your card artwork, then place the photo and details. Every employee's card uses
          this design; print them from here or from each person's profile.
        </Text>

        {/* Live Card Canvas Preview */}
        <View style={styles.canvasContainer}>
          <View style={styles.canvasControls}>
            <TouchableOpacity
              style={[
                styles.flipBtn,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.borderDefault,
                },
              ]}
              onPress={() => setIsBackSide(!isBackSide)}
            >
              <RotateCw size={14} color={t.colors.brandPrimary} />
              <Text style={[styles.flipBtnText, { color: t.colors.textPrimary }]}>
                {isBackSide ? 'View Front Side' : 'View Back Side'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.flipBtn,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.borderDefault,
                },
              ]}
              onPress={() => setOrientation(orientation === 'upright' ? 'sideways' : 'upright')}
            >
              <Text style={[styles.flipBtnText, { color: t.colors.textPrimary }]}>
                {orientation === 'upright' ? 'Upright (Portrait)' : 'Sideways (Landscape)'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Realistic Physical Card Simulation */}
          <View
            style={[
              styles.cardCanvas,
              orientation === 'sideways' && styles.cardCanvasSideways,
              {
                backgroundColor: '#FFFFFF',
                borderColor: t.colors.borderStrong,
              },
            ]}
          >
            {/* Card Header Strip */}
            <View
              style={[
                styles.cardHeaderBand,
                { backgroundColor: t.colors.brandPrimary },
              ]}
            >
              <Text style={styles.cardOrgName}>FX & FLOAT LOGISTICS</Text>
            </View>

            {!isBackSide ? (
              /* Front Side */
              <View style={styles.cardFrontContent}>
                {showPhoto && (
                  <View style={styles.photoFrame}>
                    <View style={styles.photoPlaceholder}>
                      <User size={36} color="#A6ABC4" />
                    </View>
                  </View>
                )}

                <Text
                  style={[
                    styles.cardEmpName,
                    { color: selectedColor, textAlign: selectedAlign },
                  ]}
                >
                  Rishabh
                </Text>

                {showDesignation && (
                  <Text style={[styles.cardDesignation, { textAlign: selectedAlign }]}>
                    Owner & Managing Director
                  </Text>
                )}

                {showCode && (
                  <View style={styles.cardPillBadge}>
                    <Text style={styles.cardCode}>EMP-0001</Text>
                  </View>
                )}

                <View style={styles.cardDetailsRow}>
                  {showBloodGroup && (
                    <Text style={styles.cardMiniDetail}>Blood: O+ve</Text>
                  )}
                  {showEmergency && (
                    <Text style={styles.cardMiniDetail}>Emergency: +91 98765-XXXXX</Text>
                  )}
                </View>
              </View>
            ) : (
              /* Back Side */
              <View style={styles.cardBackContent}>
                <Text style={styles.termsTitle}>TERMS OF ISSUE</Text>
                <Text style={styles.termsBody}>
                  This card is property of FX & Float Logistics. If found, please return to: Plot
                  42, Okhla Phase III, New Delhi 110020. Phone: +91 98765 43210.
                </Text>

                {showQr && (
                  <View style={styles.qrContainer}>
                    <QrCode size={56} color="#181445" />
                    <Text style={styles.qrCaption}>Scan to verify identity</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* What's Printed Options */}
        <Card style={styles.cardSpacing}>
          <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
            What's printed
          </Text>
          <Text style={[styles.secSubtitle, { color: t.colors.textSecondary }]}>
            Toggle visible elements and customize typography styling.
          </Text>

          <View style={styles.togglesList}>
            {/* Employee Name */}
            <View style={[styles.toggleRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <View>
                <Text style={[styles.toggleName, { color: t.colors.textPrimary }]}>
                  Employee Name
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                  Primary cardholder identification
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.styleBtn,
                  {
                    backgroundColor: t.colors.brandPrimarySubtle,
                    borderColor: t.colors.brandPrimarySubtleActive,
                  },
                ]}
                onPress={() => {
                  setActiveElement('Employee Name');
                  setIsStyleModalOpen(true);
                }}
              >
                <Palette size={12} color={t.colors.brandPrimary} />
                <Text style={[styles.styleBtnText, { color: t.colors.brandPrimary }]}>Style</Text>
              </TouchableOpacity>
            </View>

            {/* Photo */}
            <View style={[styles.toggleRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[styles.toggleName, { color: t.colors.textPrimary }]}>
                Employee Photo
              </Text>
              <Switch
                value={showPhoto}
                onValueChange={setShowPhoto}
                trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Designation */}
            <View style={[styles.toggleRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[styles.toggleName, { color: t.colors.textPrimary }]}>
                Designation
              </Text>
              <Switch
                value={showDesignation}
                onValueChange={setShowDesignation}
                trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Employee Code */}
            <View style={[styles.toggleRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[styles.toggleName, { color: t.colors.textPrimary }]}>
                Employee Code
              </Text>
              <Switch
                value={showCode}
                onValueChange={setShowCode}
                trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Blood Group */}
            <View style={[styles.toggleRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[styles.toggleName, { color: t.colors.textPrimary }]}>
                Blood Group
              </Text>
              <Switch
                value={showBloodGroup}
                onValueChange={setShowBloodGroup}
                trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Emergency Contact */}
            <View style={[styles.toggleRow, { borderBottomColor: t.colors.borderSubtle }]}>
              <Text style={[styles.toggleName, { color: t.colors.textPrimary }]}>
                Emergency Contact
              </Text>
              <Switch
                value={showEmergency}
                onValueChange={setShowEmergency}
                trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* QR Code */}
            <View style={styles.toggleRow}>
              <Text style={[styles.toggleName, { color: t.colors.textPrimary }]}>
                QR Verification Code
              </Text>
              <Switch
                value={showQr}
                onValueChange={setShowQr}
                trackColor={{ false: '#E2E8F0', true: t.colors.brandPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Element Styling Modal */}
      <Modal
        visible={isStyleModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStyleModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: t.colors.surfaceDefault },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: t.colors.borderSubtle }]}>
              <View>
                <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                  {activeElement} Styling
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                  Adjust typography, color palette, and alignment
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsStyleModalOpen(false)}>
                <X size={20} color={t.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Color Selection */}
              <Text style={[styles.modalLabel, { color: t.colors.textPrimary }]}>FONT COLOR</Text>
              <View style={styles.colorPillsRow}>
                {[
                  { label: 'Deep Navy', hex: '#181445' },
                  { label: 'Electric Indigo', hex: '#6366F1' },
                  { label: 'Mint Emerald', hex: '#10B981' },
                  { label: 'Terracotta', hex: '#A2451F' },
                ].map((c) => {
                  const isSel = selectedColor === c.hex;
                  return (
                    <TouchableOpacity
                      key={c.hex}
                      style={[
                        styles.colorPill,
                        { borderColor: isSel ? t.colors.brandPrimary : t.colors.borderDefault },
                      ]}
                      onPress={() => setSelectedColor(c.hex)}
                    >
                      <View style={[styles.colorDot, { backgroundColor: c.hex }]} />
                      <Text style={[styles.colorPillText, { color: t.colors.textPrimary }]}>
                        {c.label}
                      </Text>
                      {isSel && <Check size={12} color={t.colors.brandPrimary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Text Alignment */}
              <Text style={[styles.modalLabel, { color: t.colors.textPrimary, marginTop: 14 }]}>
                ALIGNMENT
              </Text>
              <View style={styles.alignToggleRow}>
                <TouchableOpacity
                  style={[
                    styles.alignBtn,
                    selectedAlign === 'center' && {
                      backgroundColor: t.colors.brandPrimary,
                      borderColor: t.colors.brandPrimary,
                    },
                  ]}
                  onPress={() => setSelectedAlign('center')}
                >
                  <Text
                    style={[
                      styles.alignBtnText,
                      { color: selectedAlign === 'center' ? '#FFFFFF' : t.colors.textPrimary },
                    ]}
                  >
                    Center
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.alignBtn,
                    selectedAlign === 'left' && {
                      backgroundColor: t.colors.brandPrimary,
                      borderColor: t.colors.brandPrimary,
                    },
                  ]}
                  onPress={() => setSelectedAlign('left')}
                >
                  <Text
                    style={[
                      styles.alignBtnText,
                      { color: selectedAlign === 'left' ? '#FFFFFF' : t.colors.textPrimary },
                    ]}
                  >
                    Left
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.saveStyleBtn,
                  { backgroundColor: t.colors.brandPrimary },
                ]}
                onPress={() => setIsStyleModalOpen(false)}
              >
                <Text style={styles.saveStyleBtnText}>Apply Element Style</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  downloadHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  downloadHeaderBtnText: {
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
  introText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  canvasContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  canvasControls: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  flipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  flipBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  cardCanvas: {
    width: 240,
    height: 360,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowColor: '#181445',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  cardCanvasSideways: {
    width: 320,
    height: 200,
  },
  cardHeaderBand: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardOrgName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  cardFrontContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFrame: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 12,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmpName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  cardDesignation: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  cardPillBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
  },
  cardCode: {
    fontSize: 11,
    fontWeight: '700',
    color: '#181445',
  },
  cardDetailsRow: {
    marginTop: 14,
    alignItems: 'center',
    gap: 3,
  },
  cardMiniDetail: {
    fontSize: 9.5,
    color: '#64748B',
  },
  cardBackContent: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  termsTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#181445',
    marginBottom: 6,
  },
  termsBody: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 13,
  },
  qrContainer: {
    marginTop: 18,
    alignItems: 'center',
  },
  qrCaption: {
    fontSize: 8.5,
    color: '#94A3B8',
    marginTop: 4,
  },
  cardSpacing: {
    padding: 16,
    marginBottom: 16,
  },
  secSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
    marginBottom: 14,
  },
  togglesList: {
    gap: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  toggleName: {
    fontSize: 13,
    fontWeight: '600',
  },
  styleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  styleBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  modalBody: {
    gap: 12,
  },
  modalLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  colorPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  colorPillText: {
    fontSize: 12,
  },
  alignToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  alignBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    borderColor: '#E2E8F0',
  },
  alignBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  saveStyleBtn: {
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 20,
  },
  saveStyleBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
