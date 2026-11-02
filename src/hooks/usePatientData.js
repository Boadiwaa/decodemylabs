import { patients, labResults, alerts, trends, reminders } from '../data/mockData';

export function usePatientData(patientId) {
  const patient = patients.find(p => p.id === patientId);
  const lab = labResults.find(l => l.patient_id === patientId);
  const alert = alerts.find(a => a.patient_id === patientId);
  const trend = trends.find(t => t.patient_id === patientId);
  const reminder = reminders.find(r => r.patient_id === patientId);
  return { patient, lab, alert, trend, reminder };
}