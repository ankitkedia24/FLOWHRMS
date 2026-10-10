import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '@/components/ui/Toast';
import * as Print from 'expo-print';
import { featureService } from '@/lib/api-service';
import {
  ArrowLeft,
  QrCode,
  Download,
  Printer,
  Palette,
  Check,
  Building,
  User,
  ShieldCheck,
  Sparkles,
  Phone,
  Heart,
  BadgeCheck,
  Sliders,
  X,
  Pipette,
} from 'lucide-react-native';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';

export interface CardPalette {
  id: string;
  label: string;
  headerBg: string;
  accent: string;
}

function generateIdCardPrintHtml({
  organizationName,
  memberName,
  memberCode,
  memberRole,
  memberInitials,
  bloodGroup,
  emergencyContact,
  validThru,
  headerBg,
  orientation,
  showPhoto,
  showCode,
  showDesignation,
  showBloodGroup,
  showEmergency,
  showQr,
}: {
  organizationName: string;
  memberName: string;
  memberCode: string;
  memberRole: string;
  memberInitials: string;
  bloodGroup: string;
  emergencyContact: string;
  validThru: string;
  headerBg: string;
  orientation: 'upright' | 'sideways';
  showPhoto: boolean;
  showCode: boolean;
  showDesignation: boolean;
  showBloodGroup: boolean;
  showEmergency: boolean;
  showQr: boolean;
}) {
  const isPortrait = orientation === 'upright';
  const cardWidth = isPortrait ? '54mm' : '85.6mm';
  const cardHeight = isPortrait ? '85.6mm' : '54mm';

  const qrSvg = `<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="56" height="56" rx="6" fill="#F8FAFC"/>
    <rect x="6" y="6" width="16" height="16" rx="2" fill="#0F172A"/>
    <rect x="9" y="9" width="10" height="10" rx="1" fill="#FFFFFF"/>
    <rect x="12" y="12" width="4" height="4" fill="#0F172A"/>
    <rect x="34" y="6" width="16" height="16" rx="2" fill="#0F172A"/>
    <rect x="37" y="9" width="10" height="10" rx="1" fill="#FFFFFF"/>
    <rect x="40" y="12" width="4" height="4" fill="#0F172A"/>
    <rect x="6" y="34" width="16" height="16" rx="2" fill="#0F172A"/>
    <rect x="9" y="37" width="10" height="10" rx="1" fill="#FFFFFF"/>
    <rect x="12" y="40" width="4" height="4" fill="#0F172A"/>
    <rect x="26" y="8" width="4" height="8" fill="#0F172A"/>
    <rect x="26" y="20" width="8" height="4" fill="#0F172A"/>
    <rect x="26" y="30" width="4" height="12" fill="#0F172A"/>
    <rect x="36" y="26" width="12" height="4" fill="#0F172A"/>
    <rect x="42" y="34" width="6" height="12" fill="#0F172A"/>
    <rect x="34" y="44" width="4" height="4" fill="#0F172A"/>
  </svg>`;

  const barcodeSvg = `<svg width="136" height="24" viewBox="0 0 136 24" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="0" width="3" height="17" fill="#0F172A"/>
    <rect x="7" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="10" y="0" width="4" height="17" fill="#0F172A"/>
    <rect x="16" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="20" y="0" width="3" height="17" fill="#0F172A"/>
    <rect x="25" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="29" y="0" width="4" height="17" fill="#0F172A"/>
    <rect x="35" y="0" width="2" height="17" fill="#0F172A"/>
    <rect x="39" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="43" y="0" width="4" height="17" fill="#0F172A"/>
    <rect x="49" y="0" width="2" height="17" fill="#0F172A"/>
    <rect x="53" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="57" y="0" width="3" height="17" fill="#0F172A"/>
    <rect x="62" y="0" width="4" height="17" fill="#0F172A"/>
    <rect x="68" y="0" width="2" height="17" fill="#0F172A"/>
    <rect x="72" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="75" y="0" width="4" height="17" fill="#0F172A"/>
    <rect x="81" y="0" width="3" height="17" fill="#0F172A"/>
    <rect x="86" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="89" y="0" width="4" height="17" fill="#0F172A"/>
    <rect x="95" y="0" width="2" height="17" fill="#0F172A"/>
    <rect x="99" y="0" width="3" height="17" fill="#0F172A"/>
    <rect x="104" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="108" y="0" width="4" height="17" fill="#0F172A"/>
    <rect x="114" y="0" width="2" height="17" fill="#0F172A"/>
    <rect x="118" y="0" width="3" height="17" fill="#0F172A"/>
    <rect x="123" y="0" width="1.5" height="17" fill="#0F172A"/>
    <rect x="127" y="0" width="4" height="17" fill="#0F172A"/>
    <text x="68" y="23" text-anchor="middle" font-family="monospace" font-size="6" font-weight="700" letter-spacing="1.5" fill="#0F172A">*${memberCode}*</text>
  </svg>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${memberName} - ID Card (300 DPI)</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F8FAFC;
      color: #0F172A;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px;
    }
    .print-header {
      text-align: center;
      margin-bottom: 14px;
    }
    .print-header h1 {
      font-size: 13pt;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: 0.5px;
    }
    .print-header p {
      font-size: 8pt;
      color: #64748B;
      margin-top: 2px;
    }
    .sheet {
      display: flex;
      flex-direction: ${isPortrait ? 'row' : 'column'};
      gap: 14mm;
      justify-content: center;
      align-items: center;
      margin-top: 6px;
    }
    .card-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .card-side-label {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #64748B;
      margin-bottom: 5px;
    }
    .card {
      width: ${cardWidth};
      height: ${cardHeight};
      background: #FFFFFF;
      border-radius: 3.2mm;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 14px rgba(0,0,0,0.08);
      outline: 0.25mm dashed #94A3B8;
      outline-offset: 1.5mm;
    }
    /* Front Card Styles */
    .front-header {
      background-color: ${headerBg};
      padding: 7px 10px 9px;
      color: #FFFFFF;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .slot-hole {
      width: 13mm;
      height: 3mm;
      background: rgba(0,0,0,0.3);
      border-radius: 2mm;
      margin-bottom: 4px;
      border: 0.4mm solid rgba(255,255,255,0.3);
    }
    .org-title {
      font-size: 8.5pt;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-align: center;
    }
    .org-sub {
      font-size: 5.5pt;
      font-weight: 600;
      letter-spacing: 2px;
      opacity: 0.85;
      margin-top: 1px;
    }
    .front-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 10px;
      background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
    }
    .avatar-box {
      width: 19mm;
      height: 19mm;
      border-radius: 9.5mm;
      background: #EFF6FF;
      border: 1.5px solid ${headerBg};
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13pt;
      font-weight: 800;
      color: ${headerBg};
      margin-top: 2px;
      margin-bottom: 5px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .member-name {
      font-size: 10pt;
      font-weight: 800;
      color: #0F172A;
      text-align: center;
      line-height: 1.15;
    }
    .member-role {
      font-size: 7pt;
      font-weight: 600;
      color: #475569;
      text-align: center;
      margin-top: 2px;
    }
    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      justify-content: center;
      margin-top: 7px;
      width: 100%;
    }
    .meta-pill {
      background: #F1F5F9;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 5.5pt;
      font-weight: 700;
      color: #334155;
      border: 0.5px solid #CBD5E1;
    }
    .front-footer {
      border-top: 0.5px solid #E2E8F0;
      padding: 3px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #FFFFFF;
      font-size: 5.5pt;
      font-weight: 700;
      color: #64748B;
    }

    /* Back Card Styles */
    .mag-stripe {
      width: 100%;
      height: 9mm;
      background: #0F172A;
      margin-top: 3.5mm;
    }
    .back-body {
      flex: 1;
      padding: 5px 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #FFFFFF;
    }
    .sig-section {
      margin-top: 3px;
    }
    .sig-title {
      font-size: 5pt;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sig-strip {
      height: 5.5mm;
      background: repeating-linear-gradient(45deg, #F8FAFC, #F8FAFC 3px, #F1F5F9 3px, #F1F5F9 6px);
      border: 0.5px solid #CBD5E1;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 6px;
      font-family: cursive;
      font-size: 7.5pt;
      color: #1E293B;
      font-weight: 600;
      margin-top: 1px;
    }
    .back-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      margin-top: 3px;
    }
    .back-meta-box {
      font-size: 5.5pt;
      color: #334155;
      line-height: 1.35;
    }
    .back-meta-box strong {
      color: #0F172A;
    }
    .barcode-wrap {
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 3px;
    }
    .legal-notice {
      font-size: 4.5pt;
      color: #64748B;
      text-align: center;
      line-height: 1.25;
      border-top: 0.5px solid #E2E8F0;
      padding-top: 2px;
      margin-top: 2px;
    }

    /* Landscape Layout */
    .landscape-front {
      flex-direction: row;
      height: 100%;
    }
    .landscape-banner {
      width: 26mm;
      background: ${headerBg};
      color: #FFFFFF;
      padding: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .landscape-main {
      flex: 1;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .landscape-back {
      padding: 5px 8px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
    }
  </style>
</head>
<body>
  <div class="print-header">
    <h1>${organizationName} · OFFICIAL SMART BADGE</h1>
    <p>CR-80 Standard (85.6mm × 54.0mm) · 300 DPI Commercial Print Specification</p>
  </div>

  <div class="sheet">
    <!-- FRONT SIDE -->
    <div class="card-wrap">
      <div class="card-side-label">Front Side</div>
      <div class="card">
        ${isPortrait ? `
          <div class="front-header">
            <div class="slot-hole"></div>
            <div class="org-title">${organizationName}</div>
            <div class="org-sub">OFFICIAL IDENTIFICATION</div>
          </div>
          <div class="front-body">
            ${showPhoto ? `<div class="avatar-box">${memberInitials}</div>` : ''}
            <div class="member-name">${memberName}</div>
            ${showDesignation ? `<div class="member-role">${memberRole}</div>` : ''}
            <div class="meta-pills">
              ${showCode ? `<div class="meta-pill">ID: <strong>${memberCode}</strong></div>` : ''}
              ${showBloodGroup ? `<div class="meta-pill">BLOOD: <strong>${bloodGroup}</strong></div>` : ''}
              <div class="meta-pill">EXP: <strong>${validThru}</strong></div>
            </div>
            ${showEmergency ? `<div style="font-size: 5.5pt; color: #64748B; margin-top: 5px;">SOS: ${emergencyContact}</div>` : ''}
          </div>
          <div class="front-footer">
            <span>SECURE ACCESS</span>
            <span>NFC · RFID ACTIVE</span>
          </div>
        ` : `
          <div class="landscape-front">
            <div class="landscape-banner">
              <div class="slot-hole" style="width: 10mm; height: 2.5mm;"></div>
              <div class="org-title" style="font-size: 7.5pt;">${organizationName}</div>
              <div class="org-sub">OFFICIAL ID</div>
              ${showPhoto ? `<div class="avatar-box" style="width: 14mm; height: 14mm; font-size: 9pt; margin-top: 5px; border-color: #FFFFFF;">${memberInitials}</div>` : ''}
            </div>
            <div class="landscape-main">
              <div class="member-name" style="text-align: left; font-size: 11pt;">${memberName}</div>
              ${showDesignation ? `<div class="member-role" style="text-align: left; font-size: 7.5pt; margin-bottom: 5px;">${memberRole}</div>` : ''}
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${showCode ? `<div class="meta-pill">ID: <strong>${memberCode}</strong></div>` : ''}
                ${showBloodGroup ? `<div class="meta-pill">BLOOD: <strong>${bloodGroup}</strong></div>` : ''}
                <div class="meta-pill">VALID: <strong>${validThru}</strong></div>
              </div>
              ${showEmergency ? `<div style="font-size: 5.5pt; color: #64748B; margin-top: 5px;">EMERGENCY: ${emergencyContact}</div>` : ''}
              <div style="font-size: 5pt; color: #94A3B8; font-weight: 700; margin-top: 6px;">CR-80 ISO COMPLIANT</div>
            </div>
          </div>
        `}
      </div>
    </div>

    <!-- BACK SIDE -->
    <div class="card-wrap">
      <div class="card-side-label">Back Side</div>
      <div class="card">
        ${isPortrait ? `
          <div class="mag-stripe"></div>
          <div class="back-body">
            <div class="sig-section">
              <div class="sig-title">Authorized Cardholder Signature</div>
              <div class="sig-strip">${memberName.split(' ')[0]}</div>
            </div>

            <div class="back-info-row">
              <div class="back-meta-box">
                <div>Emp ID: <strong>${memberCode}</strong></div>
                ${showBloodGroup ? `<div>Blood Group: <strong>${bloodGroup}</strong></div>` : ''}
                ${showEmergency ? `<div>Emergency: <strong>${emergencyContact}</strong></div>` : ''}
                <div>Valid Thru: <strong>${validThru}</strong></div>
              </div>
              ${showQr ? `<div>${qrSvg}</div>` : ''}
            </div>

            <div class="barcode-wrap">
              ${barcodeSvg}
            </div>

            <div class="legal-notice">
              This credential remains the property of ${organizationName}. Must be surrendered upon departure.
              If found, please drop in any post box or call: ${emergencyContact}.
            </div>
          </div>
        ` : `
          <div class="landscape-back">
            <div class="mag-stripe" style="margin-top: 0; height: 7mm;"></div>
            <div class="back-info-row" style="margin-top: 2px;">
              <div class="sig-section" style="flex: 1;">
                <div class="sig-title">Authorized Signature</div>
                <div class="sig-strip" style="height: 5mm; font-size: 7pt;">${memberName.split(' ')[0]}</div>
              </div>
              ${showQr ? `<div style="margin-left: 8px;">${qrSvg}</div>` : ''}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
              <div class="back-meta-box">
                <span>Code: <strong>${memberCode}</strong></span> · 
                <span>Blood: <strong>${bloodGroup}</strong></span> · 
                <span>SOS: <strong>${emergencyContact}</strong></span>
              </div>
              <div class="barcode-wrap" style="margin: 0;">
                ${barcodeSvg}
              </div>
            </div>

            <div class="legal-notice">
              Property of ${organizationName}. If found, please return or call ${emergencyContact}.
            </div>
          </div>
        `}
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

const PRESET_PALETTES: CardPalette[] = [
  { id: 'navy', label: 'Executive Navy', headerBg: '#0F172A', accent: '#38BDF8' },
  { id: 'indigo', label: 'Royal Indigo', headerBg: '#312E81', accent: '#818CF8' },
  { id: 'blue', label: 'Ocean Blue', headerBg: '#0284C7', accent: '#BAE6FD' },
  { id: 'emerald', label: 'Forest Emerald', headerBg: '#064E3B', accent: '#34D399' },
  { id: 'crimson', label: 'Ruby Crimson', headerBg: '#881337', accent: '#FB7185' },
  { id: 'amber', label: 'Sunset Amber', headerBg: '#B45309', accent: '#FDE68A' },
  { id: 'violet', label: 'Deep Violet', headerBg: '#581C87', accent: '#E9D5FF' },
  { id: 'charcoal', label: 'Obsidian Black', headerBg: '#18181B', accent: '#A1A1AA' },
];

const SWATCH_COLORS = [
  '#0F172A', '#1E1B4B', '#312E81', '#1D4ED8', '#0284C7', '#0F766E',
  '#064E3B', '#059669', '#15803D', '#65A30D', '#B45309', '#D97706',
  '#C2410C', '#DC2626', '#881337', '#BE185D', '#581C87', '#18181B',
];

function BarcodeStrip({
  code,
  width = 130,
  height = 20,
  color = '#0F172A',
}: {
  code: string;
  width?: number;
  height?: number;
  color?: string;
}) {
  const bars = [2, 1, 3, 1, 2, 1, 4, 2, 1, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2];
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height,
          width,
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        {bars.map((w, idx) => (
          <View
            key={idx}
            style={{
              width: w,
              height: '100%',
              backgroundColor: idx % 2 === 0 ? color : 'transparent',
            }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 7, fontWeight: '700', letterSpacing: 1.5, color, marginTop: 2 }}>
        *{code}*
      </Text>
    </View>
  );
}

export default function IdCardScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();
  const toast = useToast();
  const { user, isAdmin } = useAuth();

  const [orientation, setOrientation] = useState<'upright' | 'sideways'>('upright');
  const [isBackSide, setIsBackSide] = useState(false);
  const [activePalette, setActivePalette] = useState<CardPalette>(PRESET_PALETTES[0]);
  const [isExporting, setIsExporting] = useState(false);

  // Custom Color Picker Modal State
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [customHexInput, setCustomHexInput] = useState('#1E293B');

  // Field toggles
  const [showPhoto, setShowPhoto] = useState(true);
  const [showCode, setShowCode] = useState(true);
  const [showDesignation, setShowDesignation] = useState(true);
  const [showBloodGroup, setShowBloodGroup] = useState(true);
  const [showEmergency, setShowEmergency] = useState(true);
  const [showQr, setShowQr] = useState(true);

  const organizationName = (user?.tenant?.name || 'FLOWHRMS').toUpperCase();
  const memberName = user?.name || 'CodeSchool Admin';
  const memberCode = user?.employeeCode || 'ADM-001';
  const memberRole = user?.role === 'Owner' ? 'Administrator / Owner' : (user?.role || 'Team Member');
  const memberInitials = memberName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  if (!isAdmin) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: t.colors.surfaceCanvasWarm,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          },
        ]}
      >
        <Building size={48} color={t.colors.brandPrimary} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: t.colors.textPrimary, marginTop: 16 }}>
          Admin Only Feature
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: t.colors.textSecondary,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 18,
          }}
        >
          The Digital ID Card Studio is reserved for Company Administrators to configure and preview credential templates.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 24,
            paddingVertical: 12,
            paddingHorizontal: 28,
            borderRadius: 12,
            backgroundColor: t.colors.brandPrimary,
          }}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      // 1. Persist layout & styling settings to database
      await featureService.saveIdCardConfig({
        orientation,
        showPhoto,
        showCode,
        showDesignation,
        showBloodGroup,
        showEmergency,
        showQr,
        styling: { theme: activePalette.id, color: activePalette.headerBg },
      });

      // 2. Generate 300 DPI CR-80 Print Template HTML with Front & Back
      const html = generateIdCardPrintHtml({
        organizationName,
        memberName,
        memberCode,
        memberRole,
        memberInitials,
        bloodGroup: 'O+ Pos',
        emergencyContact: '+91 94140 88776',
        validThru: '10/2028',
        headerBg: activePalette.headerBg,
        orientation,
        showPhoto,
        showCode,
        showDesignation,
        showBloodGroup,
        showEmergency,
        showQr,
      });

      // 3. Open Native Mobile Print Dialog (AirPrint / Android Print Service / Save as PDF)
      await Print.printAsync({
        html,
        orientation: orientation === 'upright' ? Print.Orientation.portrait : Print.Orientation.landscape,
      });

      toast.success(
        'Print Dialog Opened',
        'Select your Wi-Fi printer or choose "Save as PDF".'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('dismiss')) {
        return;
      }
      toast.error('Print Error', msg || 'Could not open mobile print service.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleApplyCustomColor = (colorHex: string) => {
    let formatted = colorHex.trim();
    if (!formatted.startsWith('#')) formatted = `#${formatted}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(formatted)) {
      toast.error('Invalid Hex Code', 'Please enter a valid 6-character hex color (e.g. #3B82F6).');
      return;
    }
    const newPalette: CardPalette = {
      id: `custom-${Date.now()}`,
      label: 'Custom Color',
      headerBg: formatted,
      accent: '#38BDF8',
    };
    setActivePalette(newPalette);
    setIsColorModalOpen(false);
    toast.success('Color Applied', `${formatted.toUpperCase()} applied to badge template.`);
  };

  const toggleField = (field: 'photo' | 'code' | 'designation' | 'blood' | 'emergency' | 'qr') => {
    switch (field) {
      case 'photo': setShowPhoto(!showPhoto); break;
      case 'code': setShowCode(!showCode); break;
      case 'designation': setShowDesignation(!showDesignation); break;
      case 'blood': setShowBloodGroup(!showBloodGroup); break;
      case 'emergency': setShowEmergency(!showEmergency); break;
      case 'qr': setShowQr(!showQr); break;
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
      {/* Top Header Bar */}
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
            ORGANIZATION BRANDING
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            Digital ID Studio
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.downloadHeaderBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={handleDownloadPdf}
          disabled={isExporting}
          activeOpacity={0.8}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Download size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.downloadHeaderBtnText}>Export PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* View Switchers (Segmented Controls) */}
        <View style={styles.segmentedRow}>
          {/* Side Toggle */}
          <View style={[styles.segmentGroup, { backgroundColor: t.colors.surfaceSunken, borderColor: t.colors.borderDefault }]}>
            <TouchableOpacity
              style={[styles.segmentBtn, !isBackSide && { backgroundColor: t.colors.surfaceDefault }]}
              onPress={() => setIsBackSide(false)}
            >
              <Text style={[styles.segmentText, { color: !isBackSide ? t.colors.textPrimary : t.colors.textTertiary }]}>
                Front Side
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, isBackSide && { backgroundColor: t.colors.surfaceDefault }]}
              onPress={() => setIsBackSide(true)}
            >
              <Text style={[styles.segmentText, { color: isBackSide ? t.colors.textPrimary : t.colors.textTertiary }]}>
                Back Side
              </Text>
            </TouchableOpacity>
          </View>

          {/* Orientation Toggle */}
          <View style={[styles.segmentGroup, { backgroundColor: t.colors.surfaceSunken, borderColor: t.colors.borderDefault }]}>
            <TouchableOpacity
              style={[styles.segmentBtn, orientation === 'upright' && { backgroundColor: t.colors.surfaceDefault }]}
              onPress={() => setOrientation('upright')}
            >
              <Text style={[styles.segmentText, { color: orientation === 'upright' ? t.colors.textPrimary : t.colors.textTertiary }]}>
                Portrait
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, orientation === 'sideways' && { backgroundColor: t.colors.surfaceDefault }]}
              onPress={() => setOrientation('sideways')}
            >
              <Text style={[styles.segmentText, { color: orientation === 'sideways' ? t.colors.textPrimary : t.colors.textTertiary }]}>
                Landscape
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Interactive Card Preview */}
        <View style={styles.showcaseContainer}>
          {/* Lanyard Clip Slot */}
          <View style={styles.lanyardSlot} />

          {/* Physical Smart ID Badge */}
          <View
            style={[
              styles.idCard,
              orientation === 'sideways' ? styles.idCardLandscape : styles.idCardPortrait,
              {
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
              },
            ]}
          >
            {/* Top Company Band */}
            <View style={[styles.cardHeaderBand, { backgroundColor: activePalette.headerBg }]}>
              <View style={styles.bandRow}>
                <Building size={12} color={activePalette.accent} />
                <Text style={styles.bandOrgName} numberOfLines={1}>
                  {organizationName}
                </Text>
              </View>
              <View style={[styles.nfcEmblem, { borderColor: activePalette.accent }]}>
                <Sparkles size={9} color={activePalette.accent} />
              </View>
            </View>

            {!isBackSide ? (
              /* ================= FRONT SIDE ================= */
              <View style={[styles.frontBody, orientation === 'sideways' && styles.frontBodyLandscape]}>
                {/* Photo Frame */}
                {showPhoto && (
                  <View style={[styles.photoRing, { borderColor: activePalette.accent }]}>
                    <View style={styles.photoInner}>
                      <Text style={[styles.photoInitials, { color: activePalette.headerBg }]}>
                        {memberInitials}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Info Block */}
                <View style={[styles.infoBlock, orientation === 'sideways' && styles.infoBlockLandscape]}>
                  <Text style={[styles.cardName, { color: '#0F172A' }]} numberOfLines={1}>
                    {memberName}
                  </Text>

                  {showDesignation && (
                    <Text style={styles.cardDesignation} numberOfLines={1}>
                      {memberRole}
                    </Text>
                  )}

                  {showCode && (
                    <View style={[styles.codeBadge, { backgroundColor: '#F1F5F9' }]}>
                      <Text style={[styles.codeText, { color: activePalette.headerBg }]}>
                        ID: {memberCode}
                      </Text>
                    </View>
                  )}

                  {/* Micro Meta Grid */}
                  <View style={styles.metaPillRow}>
                    {showBloodGroup && (
                      <View style={styles.miniMetaChip}>
                        <Heart size={9} color="#EF4444" />
                        <Text style={styles.miniMetaText}>O+ Pos</Text>
                      </View>
                    )}
                    {showEmergency && (
                      <View style={styles.miniMetaChip}>
                        <Phone size={9} color="#64748B" />
                        <Text style={styles.miniMetaText}>Emergency</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              /* ================= BACK SIDE (REFINED & AUTHENTIC) ================= */
              orientation === 'sideways' ? (
                /* Back Side - Landscape */
                <View style={styles.backBodyLandscape}>
                  {/* Left Column: Stripe, Terms, Signature */}
                  <View style={styles.backLandscapeLeft}>
                    <View style={styles.magStripe} />
                    <Text style={styles.backLegalHeader}>OFFICIAL IDENTITY CREDENTIAL</Text>
                    <Text style={styles.backTermsTextLandscape} numberOfLines={2}>
                      Property of {organizationName}. If found, please return to administration.
                    </Text>

                    {/* Signature Strip */}
                    <View style={styles.signatureWrap}>
                      <View style={styles.signatureBox}>
                        <Text style={styles.signatureCursive}>{memberName}</Text>
                      </View>
                      <Text style={styles.signatureLabel}>AUTHORIZED SIGNATURE</Text>
                    </View>

                    {/* Emergency details */}
                    <View style={styles.landscapeMetaRow}>
                      <Text style={styles.landscapeMetaText}>Blood: O+ Pos • Help: +91 98290 11223</Text>
                    </View>
                  </View>

                  {/* Right Column: QR Code, Barcode, Validity */}
                  <View style={styles.backLandscapeRight}>
                    {showQr && (
                      <View style={styles.qrWhiteFrame}>
                        <QrCode size={46} color="#0F172A" />
                      </View>
                    )}
                    <BarcodeStrip code={memberCode} width={90} height={16} color="#0F172A" />
                    <Text style={styles.validityTextLandscape}>VALID THRU 2028</Text>
                  </View>
                </View>
              ) : (
                /* Back Side - Portrait */
                <View style={styles.backBodyPortrait}>
                  {/* Magnetic Stripe */}
                  <View style={styles.magStripe} />

                  {/* Security Notice */}
                  <View style={styles.backNoticeRow}>
                    <ShieldCheck size={11} color={activePalette.headerBg} />
                    <Text style={[styles.backNoticeText, { color: activePalette.headerBg }]}>
                      AUTHENTICATED IDENTITY BADGE
                    </Text>
                  </View>

                  {/* Signature Strip */}
                  <View style={styles.signatureWrap}>
                    <View style={styles.signatureBox}>
                      <Text style={styles.signatureCursive}>{memberName}</Text>
                    </View>
                    <Text style={styles.signatureLabel}>CARDHOLDER SIGNATURE</Text>
                  </View>

                  {/* Meta Row: Blood & Emergency */}
                  {(showBloodGroup || showEmergency) && (
                    <View style={styles.backMetaRow}>
                      {showBloodGroup && (
                        <View style={styles.backMetaCol}>
                          <Text style={styles.backMetaKey}>BLOOD GROUP</Text>
                          <Text style={styles.backMetaVal}>O+ POSITIVE</Text>
                        </View>
                      )}
                      {showEmergency && (
                        <View style={styles.backMetaCol}>
                          <Text style={styles.backMetaKey}>EMERGENCY TEL</Text>
                          <Text style={styles.backMetaVal}>+91 98290 11223</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Terms */}
                  <Text style={styles.backTermsText}>
                    This card remains the property of {organizationName} and is non-transferable. Return to issuing office if found.
                  </Text>

                  {/* QR Code & Barcode */}
                  {showQr && (
                    <View style={styles.qrContainerPortrait}>
                      <View style={styles.qrWhiteFrame}>
                        <QrCode size={42} color="#0F172A" />
                      </View>
                      <Text style={styles.qrCaptionText}>Scan to authenticate status</Text>
                    </View>
                  )}

                  <BarcodeStrip code={memberCode} color="#0F172A" />

                  <Text style={styles.validityText}>ISSUED: 10/2026 • VALID THRU: 10/2028</Text>
                </View>
              )
            )}

            {/* Bottom Security Micro-Bar */}
            <View style={[styles.cardFooterBar, { backgroundColor: activePalette.headerBg }]}>
              <Text style={styles.footerSecurityText}>SECURE DIGITAL CREDENTIAL</Text>
            </View>
          </View>
        </View>

        {/* 1. Theme Palette Selector & Custom Color Picker */}
        <Card style={styles.controlCard}>
          <View style={styles.cardHeaderWithAction}>
            <View style={styles.cardSectionHeader}>
              <Palette size={16} color={t.colors.brandPrimary} />
              <Text style={[styles.sectionTitle, { color: t.colors.textPrimary }]}>
                Card Header & Accents
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.customColorTriggerBtn, { backgroundColor: t.colors.brandPrimarySubtle }]}
              onPress={() => {
                setCustomHexInput(activePalette.headerBg);
                setIsColorModalOpen(true);
              }}
              activeOpacity={0.75}
            >
              <Pipette size={13} color={t.colors.brandPrimary} />
              <Text style={[styles.customColorTriggerText, { color: t.colors.brandPrimary }]}>
                Custom Color
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionSubtitle, { color: t.colors.textSecondary }]}>
            Select a curated corporate tone, or tap "Custom Color" to pick your exact company hex code.
          </Text>

          <View style={styles.paletteRow}>
            {PRESET_PALETTES.map((palette) => {
              const isSelected = activePalette.id === palette.id;
              return (
                <TouchableOpacity
                  key={palette.id}
                  style={[
                    styles.palettePill,
                    {
                      borderColor: isSelected ? t.colors.brandPrimary : t.colors.borderDefault,
                      backgroundColor: isSelected ? t.colors.brandPrimarySubtle : t.colors.surfaceSunken,
                    },
                  ]}
                  onPress={() => setActivePalette(palette)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.paletteColorDot, { backgroundColor: palette.headerBg }]} />
                  <Text
                    style={[
                      styles.paletteLabel,
                      { color: isSelected ? t.colors.brandPrimary : t.colors.textPrimary },
                    ]}
                  >
                    {palette.label}
                  </Text>
                  {isSelected && <Check size={12} color={t.colors.brandPrimary} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* 2. Printed Elements Toggle Grid (De-cluttered) */}
        <Card style={styles.controlCard}>
          <View style={styles.cardSectionHeader}>
            <BadgeCheck size={16} color={t.colors.brandPrimary} />
            <Text style={[styles.sectionTitle, { color: t.colors.textPrimary }]}>
              Included Card Data
            </Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: t.colors.textSecondary }]}>
            Tap elements to toggle their visibility on the live card template.
          </Text>

          <View style={styles.chipGrid}>
            {[
              { id: 'photo', label: 'Photo Frame', active: showPhoto, icon: User },
              { id: 'code', label: 'Employee ID', active: showCode, icon: BadgeCheck },
              { id: 'designation', label: 'Designation', active: showDesignation, icon: Building },
              { id: 'qr', label: 'QR Verify Code', active: showQr, icon: QrCode },
              { id: 'blood', label: 'Blood Group', active: showBloodGroup, icon: Heart },
              { id: 'emergency', label: 'Emergency Contact', active: showEmergency, icon: Phone },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.toggleChip,
                  item.active
                    ? {
                        backgroundColor: t.colors.surfaceDefault,
                        borderColor: t.colors.brandPrimary,
                      }
                    : {
                        backgroundColor: t.colors.surfaceSunken,
                        borderColor: t.colors.borderDefault,
                        opacity: 0.65,
                      },
                ]}
                onPress={() => toggleField(item.id as any)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: item.active ? t.colors.brandPrimary : t.colors.textTertiary },
                  ]}
                />
                <Text
                  style={[
                    styles.chipLabel,
                    { color: item.active ? t.colors.textPrimary : t.colors.textTertiary },
                  ]}
                >
                  {item.label}
                </Text>
                {item.active && <Check size={12} color={t.colors.brandPrimary} strokeWidth={2.5} />}
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={[styles.primaryActionBtn, { backgroundColor: t.colors.brandPrimary }]}
          onPress={handleDownloadPdf}
          disabled={isExporting}
          activeOpacity={0.85}
        >
          {isExporting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Printer size={16} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.primaryActionBtnText}>Print / Save as PDF (300 DPI)</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Custom Color Picker Modal */}
      <Modal
        visible={isColorModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsColorModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.colorModalCard, { backgroundColor: t.colors.surfaceDefault }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: t.colors.borderSubtle }]}>
              <View>
                <Text style={[styles.modalTitle, { color: t.colors.textPrimary }]}>
                  Custom Color Picker
                </Text>
                <Text style={[styles.modalSubtitle, { color: t.colors.textSecondary }]}>
                  Enter any 6-digit hex code or pick from swatches
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsColorModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={t.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Hex Input and Swatch Preview */}
            <View style={styles.hexInputRow}>
              <View
                style={[
                  styles.hexSwatchPreview,
                  {
                    backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(customHexInput)
                      ? customHexInput
                      : activePalette.headerBg,
                  },
                ]}
              />
              <TextInput
                style={[
                  styles.hexTextInput,
                  {
                    backgroundColor: t.colors.surfaceSunken,
                    borderColor: t.colors.borderDefault,
                    color: t.colors.textPrimary,
                  },
                ]}
                placeholder="#3B82F6"
                placeholderTextColor={t.colors.textTertiary}
                value={customHexInput}
                onChangeText={setCustomHexInput}
                autoCapitalize="characters"
                maxLength={7}
              />
            </View>

            {/* Quick Swatches Grid */}
            <Text style={[styles.swatchSectionLabel, { color: t.colors.textSecondary }]}>
              POPULAR BRAND SWATCHES
            </Text>
            <View style={styles.swatchGrid}>
              {SWATCH_COLORS.map((hex) => {
                const isSelected = customHexInput.toUpperCase() === hex.toUpperCase();
                return (
                  <TouchableOpacity
                    key={hex}
                    style={[
                      styles.swatchCircle,
                      { backgroundColor: hex },
                      isSelected && styles.swatchCircleSelected,
                    ]}
                    onPress={() => setCustomHexInput(hex)}
                  >
                    {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Apply Button */}
            <TouchableOpacity
              style={[styles.applyColorBtn, { backgroundColor: t.colors.brandPrimary }]}
              onPress={() => handleApplyCustomColor(customHexInput)}
              activeOpacity={0.85}
            >
              <Text style={styles.applyColorBtnText}>Apply Color to Template</Text>
            </TouchableOpacity>
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
    marginRight: 6,
  },
  headerInfo: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
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
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
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
    paddingBottom: 36,
    gap: 16,
  },
  segmentedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  segmentGroup: {
    flex: 1,
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  segmentText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  showcaseContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  lanyardSlot: {
    width: 38,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  idCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  idCardPortrait: {
    width: 250,
    height: 395,
  },
  idCardLandscape: {
    width: 340,
    height: 220,
  },
  cardHeaderBand: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  bandOrgName: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  nfcEmblem: {
    padding: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  frontBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  frontBodyLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 18,
  },
  photoRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2.5,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  photoInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  infoBlock: {
    alignItems: 'center',
  },
  infoBlockLandscape: {
    alignItems: 'flex-start',
    flex: 1,
    marginLeft: 14,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  cardDesignation: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  codeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  codeText: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metaPillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  miniMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  miniMetaText: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
  },
  /* Back Side Styles - Portrait */
  backBodyPortrait: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  magStripe: {
    width: '100%',
    height: 24,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    marginBottom: 4,
  },
  backNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  backNoticeText: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  signatureWrap: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 4,
  },
  signatureBox: {
    width: '92%',
    height: 26,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureCursive: {
    fontSize: 13,
    fontStyle: 'italic',
    fontWeight: '600',
    color: '#334155',
    letterSpacing: 1,
  },
  signatureLabel: {
    fontSize: 7,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  backMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  backMetaCol: {
    alignItems: 'center',
  },
  backMetaKey: {
    fontSize: 7,
    fontWeight: '700',
    color: '#94A3B8',
  },
  backMetaVal: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  backTermsText: {
    fontSize: 7.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 10.5,
    paddingHorizontal: 4,
  },
  qrContainerPortrait: {
    alignItems: 'center',
    marginVertical: 2,
  },
  qrWhiteFrame: {
    padding: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  qrCaptionText: {
    fontSize: 7,
    color: '#94A3B8',
    marginTop: 2,
  },
  validityText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  /* Back Side Styles - Landscape */
  backBodyLandscape: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backLandscapeLeft: {
    flex: 1.3,
    paddingRight: 10,
    justifyContent: 'space-between',
    height: '100%',
  },
  magStripeLandscape: {
    width: '100%',
    height: 18,
    backgroundColor: '#1E293B',
    borderRadius: 3,
  },
  backLegalHeader: {
    fontSize: 7.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#0F172A',
    marginTop: 2,
  },
  backTermsTextLandscape: {
    fontSize: 7.5,
    color: '#64748B',
    lineHeight: 10,
    marginTop: 3,
  },
  signatureWrapLandscape: {
    marginTop: 4,
  },
  signatureBoxLandscape: {
    width: '100%',
    height: 22,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  landscapeMetaRow: {
    marginTop: 3,
  },
  landscapeMetaText: {
    fontSize: 7.5,
    fontWeight: '600',
    color: '#475569',
  },
  backLandscapeRight: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
    paddingLeft: 8,
  },
  validityTextLandscape: {
    fontSize: 7,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  cardFooterBar: {
    paddingVertical: 3.5,
    alignItems: 'center',
  },
  footerSecurityText: {
    color: '#94A3B8',
    fontSize: 6.5,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  /* Controls */
  controlCard: {
    padding: 16,
    borderRadius: 18,
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customColorTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  customColorTriggerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 11.5,
    marginTop: 3,
    marginBottom: 12,
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  palettePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  paletteColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  paletteLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipLabel: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: 'rgba(99, 102, 241, 0.25)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  colorModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  hexSwatchPreview: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  hexTextInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  swatchSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  swatchCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchCircleSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  applyColorBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyColorBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
