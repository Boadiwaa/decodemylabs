/**
 * LabUploadScreen — upload lab reports via camera, gallery, or PDF.
 *
 * After upload:
 *  1. Shows a processing progress bar
 *  2. Parses the report with MedGemma (or regex fallback)
 *  3. Stores structured lab results on-device
 *  4. Shows extracted values for user confirmation
 *  5. Also offers manual entry for images without OCR support
 *
 * Reports are stored strictly on-device.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Image, Modal, Platform,
  StyleSheet, Alert, Dimensions, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn, FadeInDown, FadeInRight, FadeOut,
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import {
  saveLabReport, getLabReports, deleteLabReport,
  appendLabResults, deleteLabResultsByReport, deleteLabResultById,
} from '../services/PatientStorage';
import {
  parseLabReportFromImage, parseLabReportFromPdf, parseLabReportWithModel, recognizeTextFromImage,
} from '../services/LabReportParser';
import { classifySeverity, REFERENCE_RANGES } from '../domain/reference_ranges';
import Colors from '../constants/colors';
import Typography from '../constants/typography';

const { width } = Dimensions.get('window');

// Common test names for the manual entry dropdown
const COMMON_TESTS = [
  'Cholesterol', 'HbA1c', 'Glucose', 'Creatinine', 'Hemoglobin',
  'WBC', 'RBC', 'Platelets', 'ALT', 'AST', 'ALP', 'GGT', 'TSH',
  'Sodium', 'Potassium', 'Chloride', 'Calcium', 'Magnesium', 'BUN', 'Triglycerides',
  'LDL', 'HDL', 'Blood Pressure', 'eGFR', 'Bilirubin',
  'Direct Bilirubin', 'Indirect Bilirubin',
  'Albumin', 'Globulin', 'Total Protein',
];

export default function LabUploadScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const progressAnim = useSharedValue(0);
  const [parsedResults, setParsedResults] = useState(null);
  const [currentReportId, setCurrentReportId] = useState(null);

  // Report viewer state
  const [viewerReport, setViewerReport] = useState(null);

  // Manual entry state
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualTest, setManualTest] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [manualUnit, setManualUnit] = useState('');
  const [manualRange, setManualRange] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTestPicker, setShowTestPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const existing = await getLabReports(user.id);
    setReports(existing);
  };

  /** Animated progress bar style */
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%`,
  }));

  /** Copy the picked file to the app's document directory */
  const persistFile = async (sourceUri, fileName) => {
    const destDir = `${FileSystem.documentDirectory}lab_reports/`;
    const dirInfo = await FileSystem.getInfoAsync(destDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
    }
    const destUri = `${destDir}${Date.now()}_${fileName}`;
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return destUri;
  };

  const handleCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera access to photograph your lab report.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      await saveAndProcess(result.assets[0].uri, 'Lab_Photo.jpg', 'image');
    }
  };

  const handleGallery = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to select a lab report.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `Lab_Image_${Date.now()}.jpg`;
      await saveAndProcess(asset.uri, fileName, 'image');
    }
  };

  const handlePDF = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await saveAndProcess(asset.uri, asset.name || 'Lab_Report.pdf', 'pdf');
      }
    } catch (e) {
      console.warn('PDF pick error:', e);
    }
  };

  /**
   * Save the report file and start processing pipeline.
   */
  const saveAndProcess = async (sourceUri, fileName, type) => {
    setUploading(true);
    setProcessing(true);
    setProcessingMessage('Saving your report...');
    progressAnim.value = withTiming(0.1, { duration: 300 });
    setParsedResults(null);

    try {
      // Step 1: Save file
      const storedUri = await persistFile(sourceUri, fileName);
      const report = {
        id: Date.now().toString(),
        uri: storedUri,
        type,
        fileName,
      };
      await saveLabReport(user.id, report);
      setCurrentReportId(report.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadReports();

      // Step 2: For images, try direct MedGemma vision analysis first
      if (type === 'image') {
        setProcessingMessage('Analyzing lab report with AI vision...');
        progressAnim.value = withTiming(0.3, { duration: 500 });

        // Try direct image → MedGemma (bypasses OCR entirely)
        const visionResults = await parseLabReportFromImage(
          storedUri,
          report.id,
          (progress) => {
            progressAnim.value = withTiming(0.3 + progress * 0.6, { duration: 300 });
          }
        );

        if (visionResults && visionResults.length > 0) {
          // Vision analysis succeeded!
          setProcessingMessage(`Found ${visionResults.length} lab result${visionResults.length !== 1 ? 's' : ''}!`);
          progressAnim.value = withTiming(1, { duration: 300 });
          setParsedResults(visionResults);
          await appendLabResults(user.id, visionResults);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowManualEntry(true);
        } else {
          // Vision not available or returned nothing — fall back to OCR pipeline
          console.log('[LabUpload] Vision unavailable or empty, falling back to OCR...');
          await fallbackOcrPipeline(storedUri, report.id, type);
        }
      } else {
        // PDFs: direct model parsing path
        setProcessingMessage('Analyzing PDF with AI...');
        progressAnim.value = withTiming(0.3, { duration: 500 });

        const pdfResults = await parseLabReportFromPdf(
          storedUri,
          report.id,
          (progress) => {
            progressAnim.value = withTiming(0.3 + progress * 0.6, { duration: 300 });
          }
        );

        if (pdfResults && pdfResults.length > 0) {
          setProcessingMessage(`Found ${pdfResults.length} lab result${pdfResults.length !== 1 ? 's' : ''} from your PDF!`);
          progressAnim.value = withTiming(1, { duration: 300 });
          setParsedResults(pdfResults);
          await appendLabResults(user.id, pdfResults);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setShowManualEntry(true);
        } else {
          setProcessingMessage('Could not extract values automatically from this PDF. Please review and add manually below.');
          progressAnim.value = withTiming(1, { duration: 400 });
          setShowManualEntry(true);
        }
      }
    } catch (e) {
      console.error('Save/process error:', e);
      Alert.alert('Oops', 'Something went wrong. Please try again.');
      setProcessingMessage('');
    } finally {
      setUploading(false);
      setTimeout(() => setProcessing(false), 1500);
    }
  };

  /**
   * Fallback: OCR → text parsing pipeline when vision is unavailable.
   */
  const fallbackOcrPipeline = async (storedUri, reportId, type) => {
    setProcessingMessage('Running text recognition on your photo...');
    progressAnim.value = withTiming(0.4, { duration: 400 });

    let reportText = '';
    try {
      reportText = await recognizeTextFromImage(storedUri);
    } catch (e) {
      console.log('[LabUpload] OCR failed:', e.message);
    }

    if (reportText && reportText.length > 20) {
      setProcessingMessage('Analyzing lab values from text...');
      progressAnim.value = withTiming(0.6, { duration: 400 });

      const results = await parseLabReportWithModel(
        reportText,
        reportId,
        (progress) => {
          progressAnim.value = withTiming(0.6 + progress * 0.3, { duration: 300 });
        }
      );

      if (results.length > 0) {
        setProcessingMessage(`Found ${results.length} lab result${results.length !== 1 ? 's' : ''}!`);
        progressAnim.value = withTiming(1, { duration: 300 });
        setParsedResults(results);
        await appendLabResults(user.id, results);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowManualEntry(true);
      } else {
        setProcessingMessage('Could not extract values automatically.');
        progressAnim.value = withTiming(1, { duration: 300 });
        setShowManualEntry(true);
      }
    } else {
      setProcessingMessage(
        reportText
          ? 'Photo saved, but not enough text was found. Enter your values below.'
          : 'Photo saved! Could not read text — please enter your lab values below.'
      );
      progressAnim.value = withTiming(1, { duration: 400 });
      setShowManualEntry(true);
    }
  };

  /**
   * Save a manually entered lab result.
   * If a result with the same test_name already exists, replaces it.
   */
  const handleManualSave = async () => {
    if (!manualTest || !manualValue) {
      Alert.alert('Missing info', 'Please enter at least a test name and value.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const numericValue = parseFloat(manualValue);
    const ref = REFERENCE_RANGES[manualTest];
    const unit = manualUnit || ref?.unit || '';
    const range = manualRange || (ref ? `${ref.normal.min}-${ref.normal.max} ${ref.unit}` : '');

    const result = {
      id: `manual_${Date.now()}`,
      test_name: manualTest,
      result_value: `${numericValue} ${unit}`.trim(),
      numeric_value: isNaN(numericValue) ? 0 : numericValue,
      unit,
      normal_range: range,
      date: manualDate,
      severity: isNaN(numericValue) ? 'safe' : classifySeverity(manualTest, numericValue, unit),
      source_report_id: currentReportId || 'manual',
    };

    await appendLabResults(user.id, [result]);

    // Replace in local state: remove any existing result with the same test_name, add new one
    setParsedResults((prev) => {
      const filtered = (prev || []).filter((r) => r.test_name !== manualTest);
      return [...filtered, result];
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Reset form
    setManualTest('');
    setManualValue('');
    setManualUnit('');
    setManualRange('');
  };

  /**
   * Delete a single extracted/manual lab result.
   */
  const handleDeleteResult = async (resultToDelete) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await deleteLabResultById(user.id, resultToDelete.id);
    setParsedResults((prev) => (prev || []).filter((r) => r.id !== resultToDelete.id));
  };

  /** Handle date picker change */
  const onDatePickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setManualDate(selectedDate.toISOString().split('T')[0]);
    }
  };

  /** Auto-fill unit and range when test is selected */
  const selectTest = (testName) => {
    setManualTest(testName);
    setShowTestPicker(false);
    const ref = REFERENCE_RANGES[testName];
    if (ref) {
      setManualUnit(ref.unit);
      if (ref.normal.min === 0) {
        setManualRange(`<${ref.normal.max} ${ref.unit}`);
      } else {
        setManualRange(`${ref.normal.min}-${ref.normal.max} ${ref.unit}`);
      }
    }
  };

  const handleDelete = (report) => {
    Alert.alert(
      'Remove report?',
      `Delete "${report.fileName}" and its extracted results?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await FileSystem.deleteAsync(report.uri, { idempotent: true });
            } catch (_) {}
            await deleteLabReport(user.id, report.id);
            await deleteLabResultsByReport(user.id, report.id);
            await loadReports();
            setParsedResults(null);
          },
        },
      ]
    );
  };

  /** Open report in viewer (Modal for images, share sheet for PDFs) */
  const handleViewReport = async (report) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (report.type === 'image') {
      setViewerReport(report);
    } else {
      // PDF — open share sheet which includes a preview on iOS
      try {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(report.uri, {
            mimeType: 'application/pdf',
            dialogTitle: report.fileName,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Unavailable', 'Sharing is not available on this device.');
        }
      } catch (e) {
        console.warn('Share error:', e);
        Alert.alert('Error', 'Could not open the PDF.');
      }
    }
  };

  const handleDone = () => {
    const reportIdToOpen = currentReportId;

    // Reset session state so the screen is fresh on back-navigation
    setParsedResults(null);
    setCurrentReportId(null);
    setProcessing(false);
    setShowManualEntry(false);
    setShowDatePicker(false);

    if (reportIdToOpen) {
      navigation.navigate('Report', { patientId: 'self', reportId: reportIdToOpen });
      return;
    }

    navigation.navigate('DashboardMain');
  };

  const sevColor = (sev) =>
    sev === 'danger' ? Colors.danger : sev === 'warn' ? Colors.warn : Colors.safe;

  return (
    <View style={styles.screen}>
      {/* Header */}
      <Animated.View entering={FadeIn} style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={Colors.navy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Lab Reports</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Warm intro */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Text style={styles.heroEmoji}>📄</Text>
          <Text style={styles.heroTitle}>Upload your lab reports</Text>
          <Text style={styles.heroSubtitle}>
            Take a photo, pick from your gallery, or upload a PDF.
            We'll try to read your results automatically — and you can always add them manually too!
          </Text>
        </Animated.View>

        {/* Processing indicator */}
        {(processing || parsedResults) && (
          <Animated.View entering={FadeInDown.springify()} style={styles.processingCard}>
            {processing && (
              <>
                <View style={styles.progressBarBg}>
                  <Animated.View style={[styles.progressBarFill, progressStyle]} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                  <ActivityIndicator size="small" color={Colors.teal} />
                  <Text style={styles.processingText}>{processingMessage}</Text>
                </View>
              </>
            )}

            {/* Extracted results */}
            {parsedResults && parsedResults.length > 0 && (
              <View style={{ marginTop: processing ? 16 : 0 }}>
                <Text style={styles.extractedTitle}>
                  ✅ Extracted Lab Values ({parsedResults.length})
                </Text>
                {parsedResults.map((r, i) => (
                  <Animated.View
                    key={r.id}
                    entering={FadeInRight.delay(i * 80).springify()}
                    style={styles.resultRow}
                  >
                    <View style={[styles.sevDot, { backgroundColor: sevColor(r.severity) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultTestName}>{r.test_name}</Text>
                      <Text style={styles.resultRange}>Normal: {r.normal_range}</Text>
                    </View>
                    <Text style={[styles.resultValue, { color: sevColor(r.severity) }]}>
                      {r.result_value}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteResult(r)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={styles.deleteResultBtn}
                      accessibilityLabel={`Remove ${r.test_name}`}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </Animated.View>
                ))}

                <TouchableOpacity
                  style={styles.doneBtn}
                  activeOpacity={0.8}
                  onPress={handleDone}
                  accessibilityLabel="Done, go back to dashboard"
                >
                  <Text style={styles.doneBtnText}>Done — View My Dashboard</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )}

        {/* Manual entry form */}
        {showManualEntry && (
          <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.manualCard}>
            <Text style={styles.manualTitle}>📝 Add Lab Values Manually</Text>
            <Text style={styles.manualSub}>
              Type in the test name and value from your report.
            </Text>

            {/* Test name picker */}
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowTestPicker(!showTestPicker)}
              activeOpacity={0.7}
            >
              <Text style={manualTest ? styles.inputText : styles.inputPlaceholder}>
                {manualTest || 'Select test name...'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
            </TouchableOpacity>

            {showTestPicker && (
              <Animated.View entering={FadeInDown.duration(200)} style={styles.testPickerWrap}>
                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {COMMON_TESTS.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={styles.testPickerItem}
                      onPress={() => selectTest(t)}
                    >
                      <Text style={styles.testPickerText}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            )}

            {/* Value + unit row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                placeholder="Value (e.g. 240)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={manualValue}
                onChangeText={setManualValue}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Unit"
                placeholderTextColor={Colors.textMuted}
                value={manualUnit}
                onChangeText={setManualUnit}
              />
            </View>

            {/* Normal range */}
            <TextInput
              style={styles.input}
              placeholder="Normal range (e.g. <200 mg/dL)"
              placeholderTextColor={Colors.textMuted}
              value={manualRange}
              onChangeText={setManualRange}
            />

            {/* Date */}
            <TouchableOpacity
              style={styles.input}
              activeOpacity={0.7}
              onPress={() => setShowDatePicker(true)}
              accessibilityLabel="Select date"
            >
              <Text style={manualDate ? { color: Colors.navy } : { color: Colors.textMuted }}>
                {manualDate || 'Date (YYYY-MM-DD)'}
              </Text>
              <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showDatePicker && (
              <>
                <DateTimePicker
                  value={manualDate ? new Date(manualDate) : new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDatePickerChange}
                  maximumDate={new Date()}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(false)}
                    style={{ alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12 }}
                  >
                    <Text style={{ color: Colors.teal, fontWeight: '600', fontSize: 14 }}>Done</Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={styles.addResultBtn}
                activeOpacity={0.8}
                onPress={handleManualSave}
              >
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.addResultBtnText}>Add Result</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipBtn}
                activeOpacity={0.8}
                onPress={handleDone}
              >
                <Text style={styles.skipBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Upload options — hide during processing */}
        {!processing && !parsedResults && (
          <View style={styles.uploadOptions}>
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <TouchableOpacity
                onPress={handleCamera}
                style={[styles.uploadCard, { borderColor: Colors.tealMuted }]}
                activeOpacity={0.7}
                disabled={uploading}
                accessibilityLabel="Take photo of lab report"
              >
                <View style={[styles.uploadIconWrap, { backgroundColor: Colors.tealLight }]}>
                  <Ionicons name="camera" size={28} color={Colors.tealDark} />
                </View>
                <View>
                  <Text style={styles.uploadTitle}>Take a Photo</Text>
                  <Text style={styles.uploadDesc}>Point your camera at the lab report page</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(280).springify()}>
              <TouchableOpacity
                onPress={handleGallery}
                style={[styles.uploadCard, { borderColor: '#D0D1F0' }]}
                activeOpacity={0.7}
                disabled={uploading}
                accessibilityLabel="Choose photo from gallery"
              >
                <View style={[styles.uploadIconWrap, { backgroundColor: Colors.indigoLight }]}>
                  <Ionicons name="images" size={28} color={Colors.indigo} />
                </View>
                <View>
                  <Text style={styles.uploadTitle}>From Gallery</Text>
                  <Text style={styles.uploadDesc}>Pick a photo of your lab report</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(360).springify()}>
              <TouchableOpacity
                onPress={handlePDF}
                style={[styles.uploadCard, { borderColor: Colors.warnBorder }]}
                activeOpacity={0.7}
                disabled={uploading}
                accessibilityLabel="Upload PDF lab report"
              >
                <View style={[styles.uploadIconWrap, { backgroundColor: Colors.warnBg }]}>
                  <Ionicons name="document-text" size={28} color={Colors.warn} />
                </View>
                <View>
                  <Text style={styles.uploadTitle}>Upload PDF</Text>
                  <Text style={styles.uploadDesc}>Select a PDF lab report from your files</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        {/* Uploaded reports list */}
        {!processing && reports.length > 0 && (
          <View style={styles.reportsSection}>
            <Text style={styles.reportsSectionTitle}>
              Your saved reports ({reports.length})
            </Text>
            {reports.map((report, i) => (
              <Animated.View
                key={report.id}
                entering={FadeInRight.delay(i * 60).springify()}
                exiting={FadeOut.duration(150)}
              >
                <TouchableOpacity
                  style={styles.reportCard}
                  activeOpacity={0.7}
                  onPress={() => handleViewReport(report)}
                  accessibilityLabel={`View ${report.fileName}`}
                >
                  {report.type === 'image' ? (
                    <Image source={{ uri: report.uri }} style={styles.reportThumb} />
                  ) : (
                    <View style={[styles.reportThumb, styles.pdfThumb]}>
                      <Ionicons name="document-text" size={24} color={Colors.warn} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reportName} numberOfLines={1}>{report.fileName}</Text>
                    <Text style={styles.reportDate}>
                      {report.uploadedAt
                        ? new Date(report.uploadedAt).toLocaleDateString()
                        : 'Recently uploaded'}
                    </Text>
                    <Text style={styles.reportTapHint}>
                      Tap to {report.type === 'image' ? 'view' : 'open'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDelete(report)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel={`Delete ${report.fileName}`}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}

        {/* Privacy */}
        <Animated.View entering={FadeIn.delay(600)} style={styles.privacy}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.safe} />
          <Text style={styles.privacyText}>
            All reports and results are stored on this device only. Nothing leaves your phone.
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Image viewer Modal */}
      <Modal
        visible={!!viewerReport}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerReport(null)}
      >
        <View style={styles.viewerOverlay}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              onPress={() => setViewerReport(null)}
              style={styles.viewerCloseBtn}
              accessibilityLabel="Close viewer"
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.viewerTitle} numberOfLines={1}>
              {viewerReport?.fileName}
            </Text>
            <View style={{ width: 40 }} />
          </View>
          {viewerReport?.uri && (
            <Image
              source={{ uri: viewerReport.uri }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgPrimary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: Colors.tealLight,
    borderBottomWidth: 1, borderBottomColor: Colors.tealMuted,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: Colors.white, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  headerTitle: { ...Typography.h3, color: Colors.navy },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },

  heroEmoji: { fontSize: 36, marginBottom: 8 },
  heroTitle: { ...Typography.h2, color: Colors.navy, marginBottom: 8 },
  heroSubtitle: {
    ...Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 24,
  },

  // Processing
  processingCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: Colors.tealMuted, marginBottom: 20,
  },
  progressBarBg: {
    height: 6, borderRadius: 3, backgroundColor: Colors.bgSecondary, overflow: 'hidden',
  },
  progressBarFill: {
    height: 6, borderRadius: 3, backgroundColor: Colors.teal,
  },
  processingText: {
    ...Typography.bodySmall, color: Colors.textSecondary, flex: 1,
  },
  extractedTitle: {
    ...Typography.body, fontWeight: '700', color: Colors.navy, marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  sevDot: { width: 10, height: 10, borderRadius: 5 },
  resultTestName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.navy },
  resultRange: { ...Typography.caption, color: Colors.textMuted, marginTop: 2, fontSize: 11 },
  resultValue: { ...Typography.body, fontWeight: '700', fontSize: 16 },
  deleteResultBtn: { padding: 4, marginLeft: 4 },

  doneBtn: {
    marginTop: 16, backgroundColor: Colors.teal, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { ...Typography.button, color: '#fff', fontSize: 15 },

  // Manual entry
  manualCard: {
    backgroundColor: Colors.white, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: Colors.borderLight, marginBottom: 20,
  },
  manualTitle: { ...Typography.body, fontWeight: '700', color: Colors.navy, marginBottom: 4 },
  manualSub: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 14 },
  input: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.borderLight, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10,
    backgroundColor: Colors.bgPrimary,
  },
  inputText: { ...Typography.bodySmall, color: Colors.navy },
  inputPlaceholder: { ...Typography.bodySmall, color: Colors.textMuted },
  testPickerWrap: {
    backgroundColor: Colors.white, borderRadius: 12, borderWidth: 1,
    borderColor: Colors.borderLight, marginBottom: 10, marginTop: -6,
  },
  testPickerItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  testPickerText: { ...Typography.bodySmall, color: Colors.navy },
  addResultBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: Colors.teal, borderRadius: 14, paddingVertical: 12,
  },
  addResultBtnText: { ...Typography.button, color: '#fff', fontSize: 14 },
  skipBtn: {
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  skipBtnText: { ...Typography.body, fontWeight: '600', color: Colors.textSecondary },

  // Upload options
  uploadOptions: { gap: 12, marginBottom: 28 },
  uploadCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.white, borderRadius: 18,
    borderWidth: 1, padding: 18,
  },
  uploadIconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  uploadTitle: { ...Typography.body, fontWeight: '700', color: Colors.navy, marginBottom: 2 },
  uploadDesc: { ...Typography.caption, color: Colors.textMuted, fontSize: 11 },

  // Reports list
  reportsSection: { marginBottom: 24 },
  reportsSectionTitle: { ...Typography.label, color: Colors.textSecondary, marginBottom: 12 },
  reportCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.white, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.borderLight,
    padding: 12, marginBottom: 8,
  },
  reportThumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: Colors.bgSecondary },
  pdfThumb: { alignItems: 'center', justifyContent: 'center' },
  reportName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.navy },
  reportDate: { ...Typography.caption, color: Colors.textMuted, marginTop: 2, fontSize: 11 },
  reportTapHint: { ...Typography.caption, color: Colors.teal, marginTop: 2, fontSize: 10, fontWeight: '500' },

  // Image viewer modal
  viewerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  viewerHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  viewerCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerTitle: {
    ...Typography.bodySmall, color: '#fff', fontWeight: '600',
    flex: 1, textAlign: 'center', marginHorizontal: 8,
  },
  viewerImage: {
    width: width - 32, height: '75%', borderRadius: 12,
  },

  privacy: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    justifyContent: 'center', paddingBottom: 20, marginTop: 16,
  },
  privacyText: {
    ...Typography.caption, color: Colors.textMuted, fontSize: 11, textAlign: 'center',
  },
});
