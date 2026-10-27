/**
 * useUserLabData — provides lab results, alerts, and trends from
 * on-device storage for the current patient user.
 *
 * Falls back to mock data if no stored data exists.
 * This is the bridge between real uploaded data and the display layer.
 *
 * Supports "current" (latest report) and "past" (previous reports) views.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getLabResults as fetchLabResults,
  getLabReports as fetchLabReports,
  getProfile,
  buildTrendFromResults,
} from '../services/PatientStorage';
import { classifySeverity } from '../domain/reference_ranges';
import {
  patients as mockPatients,
  labResults as mockLabResults,
  alerts as mockAlerts,
  trends as mockTrends,
  reminders as mockReminders,
} from '../data/mockData';

function parseNumericValue(resultValue) {
  const match = String(resultValue || '').match(/-?\d+\.?\d*/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Convert stored lab results into the shapes the app already expects:
 * labResults[], alerts[], trends[], patient record.
 *
 * @param {Array} storedResults - All stored results (or those filtered by report)
 * @param {Array} allResults - ALL results across reports (for trend building)
 * @param {object} profile
 * @param {object} user
 */
function buildDisplayData(storedResults, allResults, profile, user) {
  if (!storedResults || storedResults.length === 0) return null;

  // Group by test_name — keep only the latest result per test
  const latestByTest = new Map();
  for (const r of storedResults) {
    const existing = latestByTest.get(r.test_name);
    if (!existing || r.date > existing.date) {
      latestByTest.set(r.test_name, r);
    }
  }

  // Build labResults array (shape matches mockData)
  const labResults = [];
  const alerts = [];
  const trends = [];
  let idx = 1;

  for (const [testName, result] of latestByTest) {
    const patientId = 'self';
    const severity = result.severity || 'safe';
    const numericValue = Number.isFinite(result.numeric_value)
      ? Number(result.numeric_value)
      : parseNumericValue(result.result_value);

    labResults.push({
      id: idx,
      patient_id: patientId,
      test_name: testName,
      result_value: result.result_value,
      numeric_value: numericValue,
      unit: result.unit || '',
      normal_range: result.normal_range,
      date: result.date,
      severity,
      source_report_id: result.source_report_id || null,
      explanation: '',
    });

    // Build alert
    const alertMessages = {
        danger: `${testName} at ${result.result_value} is critically abnormal. Consult a licensed healthcare provider.`,
      warn: `${testName} at ${result.result_value} is outside the normal range. Worth keeping an eye on.`,
      safe: `${testName} at ${result.result_value} is within normal limits. Looking good!`,
    };
    alerts.push({
      id: idx,
      patient_id: patientId,
      alert_message: alertMessages[severity],
      severity,
    });

    // Build trend from ALL results (not just current report) for historical context
    const trendData = buildTrendFromResults(allResults || storedResults, testName);
    if (trendData) {
      trends.push({
        id: idx,
        patient_id: patientId,
        ...trendData,
      });
    }

    idx++;
  }

  // Sort by severity: danger first, then warn, then safe
  const sevOrder = { danger: 0, warn: 1, safe: 2 };
  const sortedIndices = labResults
    .map((_, i) => i)
    .sort((a, b) => (sevOrder[alerts[a].severity] ?? 2) - (sevOrder[alerts[b].severity] ?? 2));

  const sortedLabResults = sortedIndices.map((i, newIdx) => ({ ...labResults[i], id: newIdx + 1 }));
  const sortedAlerts = sortedIndices.map((i, newIdx) => ({ ...alerts[i], id: newIdx + 1 }));

  // Trends are indexed by test_name, not array position — use a map lookup
  const trendMap = new Map(trends.map(t => [t.test_name, t]));
  const sortedTrends = sortedLabResults
    .map(lr => trendMap.get(lr.test_name))
    .filter(Boolean)
    .map((t, i) => ({ ...t, id: i + 1 }));

  // Build patient record from profile + auth
  const nameParts = (user?.fullName || 'User').trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : (nameParts[0]?.[0] || 'U').toUpperCase();

  const patient = {
    id: 'self',
    name: user?.fullName || 'You',
    dob: profile?.dob || '1990-01-01',
    gender: profile?.sex || 'Not specified',
    profile_description: buildProfileDesc(profile),
    initials,
    color: '#2BB5A8',
  };

  return { patient, labResults: sortedLabResults, alerts: sortedAlerts, trends: sortedTrends };
}

/**
 * Build a "report session" — a single upload event with its results.
 * Used for the Past Reports list.
 */
function buildReportSession(report, results) {
  const reportResults = results.filter(r => r.source_report_id === report.id);
  if (reportResults.length === 0) return null;

  const worstSeverity = reportResults.reduce((worst, r) => {
    if (r.severity === 'danger') return 'danger';
    if (r.severity === 'warn' && worst !== 'danger') return 'warn';
    return worst;
  }, 'safe');

  return {
    reportId: report.id,
    fileName: report.fileName || 'Lab Report',
    uploadedAt: report.uploadedAt,
    date: reportResults[0]?.date || report.uploadedAt?.split('T')[0] || 'Unknown',
    testCount: reportResults.length,
    severity: worstSeverity,
    results: reportResults,
  };
}

function buildProfileDesc(profile) {
  if (!profile) return 'No medical history on file.';
  const parts = [];
  if (profile.race) parts.push(profile.race);
  if (profile.nationality) parts.push(`from ${profile.nationality}`);
  if (profile.residence) parts.push(`living in ${profile.residence}`);
  return parts.length > 0 ? parts.join(', ') + '.' : 'Demographics on file.';
}

/**
 * Hook: returns patient-specific lab data from storage.
 * Falls back to mock data if no stored data exists.
 *
 * Adds support for current vs past report views.
 */
export function useUserLabData() {
  const { user, currentPatientId, getPatientProfile } = useAuth();

  const [userData, setUserData] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [reportSessions, setReportSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasRealData, setHasRealData] = useState(false);

  const loadUserData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const [storedResults, reports, profile] = await Promise.all([
        fetchLabResults(user.id),
        fetchLabReports(user.id),
        getProfile(user.id),
      ]);

      if (storedResults.length > 0) {
        // Build display data from ALL results (current dashboard = latest per test)
        const display = buildDisplayData(storedResults, storedResults, profile, user);
        setUserData(display);
        setAllResults(storedResults);
        setHasRealData(true);

        // Build report sessions for past dashboards
        const sessions = reports
          .map(r => buildReportSession(r, storedResults))
          .filter(Boolean)
          .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
        setReportSessions(sessions);
      } else {
        setUserData(null);
        setAllResults([]);
        setReportSessions([]);
        setHasRealData(false);
      }
    } catch (e) {
      console.warn('[useUserLabData] Load error:', e);
      setUserData(null);
      setAllResults([]);
      setReportSessions([]);
      setHasRealData(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Build display data for a specific past report session
  const getReportSessionData = useCallback((reportId) => {
    if (!user || allResults.length === 0) return null;
    const sessionResults = allResults.filter(r => r.source_report_id === reportId);
    if (sessionResults.length === 0) return null;
    return buildDisplayData(sessionResults, allResults, null, user);
  }, [allResults, user]);

  // Convenience: resolve which data to use
  const getPatients = useCallback(() => {
    if (hasRealData && userData?.patient) return [userData.patient];
    // Fallback to mock with overlay
    return mockPatients.filter((p) => p.id === currentPatientId).map(getPatientProfile);
  }, [hasRealData, userData, currentPatientId, getPatientProfile]);

  const getLabResultsFn = useCallback((patientId) => {
    if (hasRealData && userData?.labResults) return userData.labResults;
    return mockLabResults.filter((l) => l.patient_id === currentPatientId);
  }, [hasRealData, userData, currentPatientId]);

  const getAlerts = useCallback((patientId) => {
    if (hasRealData && userData?.alerts) return userData.alerts;
    return mockAlerts.filter((a) => a.patient_id === currentPatientId);
  }, [hasRealData, userData, currentPatientId]);

  const getTrends = useCallback((patientId) => {
    if (hasRealData && userData?.trends) return userData.trends;
    return mockTrends.filter((t) => t.patient_id === currentPatientId);
  }, [hasRealData, userData, currentPatientId]);

  const getAllAlerts = useCallback(() => {
    if (hasRealData && userData?.alerts) return userData.alerts;
    return mockAlerts.filter((a) => a.patient_id === currentPatientId);
  }, [hasRealData, userData, currentPatientId]);

  return {
    isLoading,
    hasRealData,
    userData,
    reportSessions,
    getPatients,
    getLabResultsFn,
    getAlerts,
    getTrends,
    getAllAlerts,
    getReportSessionData,
    refresh: loadUserData,
  };
}
