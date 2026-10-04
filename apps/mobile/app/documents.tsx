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
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  ShieldCheck,
  Plus,
  Paperclip,
  UploadCloud,
  FileText,
  CheckCircle,
  Lock,
  Trash2,
  Eye,
  BadgeAlert,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { getTheme } from '@/constants/Theme';
import { useColorScheme } from '@/components/useColorScheme';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';

interface DocumentItem {
  id: string;
  name: string;
  fileName: string;
  size: string;
  uploadedAt: string;
  status: 'verified' | 'pending';
}

/**
 * FlowHRMS - Mobile Documents Screen (My Documents + Upload Form)
 * Stitch Screens: 21 & 31
 */
export default function DocumentsScreen() {
  const colorScheme = useColorScheme();
  const t = getTheme(colorScheme);
  const router = useRouter();

  const [showAddForm, setShowAddForm] = useState(false);
  const [docName, setDocName] = useState('ID proof');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: 'doc-1',
      name: 'Aadhaar Card (National ID)',
      fileName: 'aadhaar_front_back.pdf',
      size: '1.2 MB',
      uploadedAt: '28 Sep 2026',
      status: 'verified',
    },
  ]);

  const handlePickFile = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!res.canceled && res.assets && res.assets[0]) {
        const uri = res.assets[0].uri;
        const name = uri.split('/').pop() || 'document_scan.jpg';
        setSelectedFileName(name);
      }
    } catch {
      setSelectedFileName('id_card_scan.jpg');
    }
  };

  const handleUpload = () => {
    if (!docName.trim()) {
      Alert.alert('Required', 'Please enter what this document is.');
      return;
    }
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      const newDoc: DocumentItem = {
        id: `doc-${Date.now()}`,
        name: docName.trim(),
        fileName: selectedFileName || 'document_upload.pdf',
        size: '1.8 MB',
        uploadedAt: 'Today',
        status: 'pending',
      };
      setDocuments([newDoc, ...documents]);
      setShowAddForm(false);
      setSelectedFileName(null);
      Alert.alert('Document Uploaded', 'Your document is uploaded and secured in vault.');
    }, 1000);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Document', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDocuments(documents.filter((d) => d.id !== id));
        },
      },
    ]);
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
            FX & Float • Documents
          </Text>
          <Text style={[styles.headerTitle, { color: t.colors.textPrimary }]}>
            My documents
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.addToggleBtn,
            { backgroundColor: t.colors.brandPrimary },
          ]}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addToggleText}>
            {showAddForm ? 'Close' : 'Add'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Privacy Banner */}
        <View
          style={[
            styles.privacyBanner,
            {
              backgroundColor: t.colors.brandPrimarySubtle,
              borderColor: t.colors.brandPrimarySubtleActive,
            },
          ]}
        >
          <ShieldCheck size={18} color={t.colors.brandPrimary} style={styles.privacyIcon} />
          <Text style={[styles.privacyText, { color: t.colors.textSecondary }]}>
            Your documents are visible to you, HR and your company owner. They are not shared with
            other employees.
          </Text>
        </View>

        {/* Add Document Form (Collapsible/Conditional) */}
        {showAddForm && (
          <Card style={styles.formCard}>
            <View style={styles.formCardHeader}>
              <View>
                <Text style={[t.typography.h3, { color: t.colors.textPrimary }]}>
                  Add a document
                </Text>
                <Text style={[t.typography.caption, { color: t.colors.textTertiary, marginTop: 2 }]}>
                  Photo or PDF • up to 10 MB
                </Text>
              </View>
              <View style={[styles.newTag, { backgroundColor: t.colors.surfaceSunken }]}>
                <Text style={[styles.newTagText, { color: t.colors.textSecondary }]}>NEW</Text>
              </View>
            </View>

            {/* Field: What is it? */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textPrimary }]}>
                What is it? <Text style={{ color: t.colors.textTertiary }}>• Required</Text>
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
                placeholder="e.g. Passport, Tax Certificate, Address proof"
                placeholderTextColor={t.colors.textTertiary}
                value={docName}
                onChangeText={setDocName}
              />
              <Text style={[styles.fieldHint, { color: t.colors.textTertiary }]}>
                For example: ID proof, address proof, certificate.
              </Text>
            </View>

            {/* Field: File Picker */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: t.colors.textPrimary }]}>
                File <Text style={{ color: t.colors.textTertiary }}>• Required</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.filePickerBox,
                  {
                    borderColor: t.colors.borderDefault,
                    backgroundColor: t.colors.surfaceCanvas,
                  },
                ]}
                onPress={handlePickFile}
              >
                <View style={styles.filePickerTop}>
                  <View
                    style={[
                      styles.chooseBtn,
                      { backgroundColor: t.colors.brandPrimarySubtle },
                    ]}
                  >
                    <Paperclip size={14} color={t.colors.brandPrimary} />
                    <Text style={[styles.chooseBtnText, { color: t.colors.brandPrimary }]}>
                      Choose File
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.selectedFileText,
                      { color: selectedFileName ? t.colors.textPrimary : t.colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {selectedFileName || 'No file chosen'}
                  </Text>
                </View>
                <Text style={[styles.fileFormatsText, { color: t.colors.textTertiary }]}>
                  Supports JPG, PNG, or PDF formats
                </Text>
              </TouchableOpacity>
            </View>

            {/* Buttons */}
            <View style={styles.formBtnRow}>
              <TouchableOpacity
                style={[
                  styles.uploadBtn,
                  { backgroundColor: t.colors.brandPrimary },
                ]}
                onPress={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <UploadCloud size={16} color="#FFFFFF" />
                    <Text style={styles.uploadBtnText}>Upload</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: t.colors.surfaceDefault,
                    borderColor: t.colors.borderDefault,
                  },
                ]}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={[styles.cancelBtnText, { color: t.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Document List / Empty State */}
        {documents.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyIllustration}>
              <View style={[styles.bar1, { backgroundColor: '#FDE68A' }]} />
              <View style={[styles.bar2, { backgroundColor: '#F59E0B' }]} />
              <View style={[styles.bar3, { backgroundColor: '#B45309' }]} />
            </View>
            <Text style={[styles.emptyTitle, { color: t.colors.textPrimary }]}>
              No documents yet.
            </Text>
            <Text style={[styles.emptySubtitle, { color: t.colors.textSecondary }]}>
              HR may ask you for ID or address proof.
            </Text>
            <View
              style={[
                styles.vaultBadge,
                { backgroundColor: t.colors.surfaceSunken },
              ]}
            >
              <Lock size={12} color={t.colors.accentPositive} />
              <Text style={[styles.vaultText, { color: t.colors.textSecondary }]}>
                Vault Encrypted (AES-256)
              </Text>
            </View>
          </Card>
        ) : (
          <View style={styles.docListSection}>
            <Text style={[styles.sectionTitle, { color: t.colors.textSecondary }]}>
              STORED IN ENCRYPTED VAULT ({documents.length})
            </Text>

            {documents.map((doc) => (
              <Card key={doc.id} style={styles.docItemCard}>
                <View style={styles.docItemTop}>
                  <View style={styles.docItemLeft}>
                    <View
                      style={[
                        styles.docIconBox,
                        { backgroundColor: t.colors.brandPrimarySubtle },
                      ]}
                    >
                      <FileText size={20} color={t.colors.brandPrimary} />
                    </View>
                    <View style={styles.docInfo}>
                      <Text style={[styles.docName, { color: t.colors.textPrimary }]}>
                        {doc.name}
                      </Text>
                      <Text style={[t.typography.caption, { color: t.colors.textTertiary }]}>
                        {doc.fileName} • {doc.size} • {doc.uploadedAt}
                      </Text>
                    </View>
                  </View>

                  <StatusChip
                    status={
                      doc.status === 'verified'
                        ? { key: 'verified', label: 'Verified', tone: 'success' }
                        : { key: 'pending', label: 'Under Review', tone: 'warning' }
                    }
                    size="sm"
                  />
                </View>

                <View
                  style={[
                    styles.docActionsBar,
                    { borderTopColor: t.colors.borderSubtle },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.docActionLink}
                    onPress={() => Alert.alert('Viewing Document', `Opening ${doc.fileName}...`)}
                  >
                    <Eye size={14} color={t.colors.brandPrimary} />
                    <Text style={[styles.docActionText, { color: t.colors.brandPrimary }]}>
                      View
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.docActionLink}
                    onPress={() => handleDelete(doc.id)}
                  >
                    <Trash2 size={14} color={t.colors.status.error.fg} />
                    <Text style={[styles.docActionText, { color: t.colors.status.error.fg }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}

            <View
              style={[
                styles.vaultNoticeCard,
                {
                  backgroundColor: t.colors.surfaceDefault,
                  borderColor: t.colors.borderDefault,
                },
              ]}
            >
              <Lock size={14} color={t.colors.accentPositive} />
              <Text style={[styles.vaultNoticeText, { color: t.colors.textTertiary }]}>
                All uploaded documents are encrypted and accessible strictly per role scope.
              </Text>
            </View>
          </View>
        )}
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
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: 1,
  },
  addToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  addToggleText: {
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
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  privacyIcon: {
    marginTop: 1,
  },
  privacyText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  formCard: {
    padding: 16,
    marginBottom: 16,
  },
  formCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  newTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  newTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  fieldHint: {
    fontSize: 11,
    marginTop: 4,
  },
  filePickerBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 12,
  },
  filePickerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  chooseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chooseBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  selectedFileText: {
    flex: 1,
    fontSize: 12,
  },
  fileFormatsText: {
    fontSize: 10,
  },
  formBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyCard: {
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyIllustration: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 12,
  },
  bar1: { width: 24, height: 4, borderRadius: 2 },
  bar2: { width: 32, height: 4, borderRadius: 2 },
  bar3: { width: 20, height: 4, borderRadius: 2 },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  vaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 16,
  },
  vaultText: {
    fontSize: 11,
    fontWeight: '600',
  },
  docListSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  docItemCard: {
    padding: 14,
    marginBottom: 10,
  },
  docItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  docItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  docIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: '700',
  },
  docActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  docActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  vaultNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  vaultNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
});
