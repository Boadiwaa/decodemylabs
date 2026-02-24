export const patients = [
  { id: 1, name: "John Doe", dob: "1985-06-15", gender: "Male", profile_description: "History of high cholesterol.", initials: "JD", color: "#1A8A7D" },
  { id: 2, name: "Jane Smith", dob: "1990-03-22", gender: "Female", profile_description: "Diabetes and hypertension.", initials: "JS", color: "#6366F1" },
  { id: 3, name: "Alice Johnson", dob: "1978-11-30", gender: "Female", profile_description: "Family history of heart disease.", initials: "AJ", color: "#E5484D" },
  { id: 4, name: "Bob Brown", dob: "1965-01-05", gender: "Male", profile_description: "Chronic kidney disease.", initials: "BB", color: "#0F2B46" },
  { id: 5, name: "Charlie White", dob: "2000-07-19", gender: "Male", profile_description: "No significant medical history.", initials: "CW", color: "#30A46C" },
];

export const labResults = [
  { id: 1, patient_id: 1, test_name: "Cholesterol", result_value: "240 mg/dL", normal_range: "<200 mg/dL", date: "2023-09-01", explanation: "Your cholesterol level is significantly high." },
  { id: 2, patient_id: 2, test_name: "HbA1c", result_value: "7.5%", normal_range: "<5.7%", date: "2023-09-15", explanation: "Your HbA1c level indicates diabetes management needs improvement." },
  { id: 3, patient_id: 3, test_name: "Blood Pressure", result_value: "150/95 mmHg", normal_range: "<120/80 mmHg", date: "2023-09-10", explanation: "Your blood pressure is high." },
  { id: 4, patient_id: 4, test_name: "Creatinine", result_value: "2.5 mg/dL", normal_range: "0.6-1.2 mg/dL", date: "2023-09-20", explanation: "Your creatinine level is elevated, indicating potential kidney issues." },
  { id: 5, patient_id: 5, test_name: "Lipid Panel", result_value: "Normal", normal_range: "Normal", date: "2023-09-25", explanation: "Your lipid panel results are within normal limits." },
];

export const reminders = [
  { id: 1, patient_id: 1, test_name: "Cholesterol", due_date: "2023-10-01", message: "Your cholesterol test is due next week." },
  { id: 2, patient_id: 2, test_name: "HbA1c", due_date: "2023-10-15", message: "Your HbA1c test is due in two weeks." },
  { id: 3, patient_id: 3, test_name: "Blood Pressure", due_date: "2023-10-10", message: "Your blood pressure check is due next week." },
  { id: 4, patient_id: 4, test_name: "Creatinine", due_date: "2023-10-20", message: "Your creatinine test is due in three weeks." },
  { id: 5, patient_id: 5, test_name: "Lipid Panel", due_date: "2023-10-25", message: "Your lipid panel test is due in four weeks." },
];

export const alerts = [
  { id: 1, patient_id: 1, alert_message: "Clinically significant high cholesterol. Immediate follow-up recommended.", severity: "danger" },
  { id: 2, patient_id: 2, alert_message: "High HbA1c level. Review diabetes management plan.", severity: "danger" },
  { id: 3, patient_id: 3, alert_message: "High blood pressure detected. Consult healthcare provider.", severity: "warn" },
  { id: 4, patient_id: 4, alert_message: "Elevated creatinine. Potential kidney issues require attention.", severity: "danger" },
  { id: 5, patient_id: 5, alert_message: "No alerts. Normal lipid panel results.", severity: "safe" },
];

export const trends = [
  { id: 1, patient_id: 1, test_name: "Cholesterol", unit: "mg/dL", values: [{ date: "Jun", value: 220 }, { date: "Jul", value: 230 }, { date: "Aug", value: 240 }] },
  { id: 2, patient_id: 2, test_name: "HbA1c", unit: "%", values: [{ date: "Jun", value: 7.0 }, { date: "Jul", value: 7.2 }, { date: "Aug", value: 7.5 }] },
  { id: 3, patient_id: 3, test_name: "BP (Systolic)", unit: "mmHg", values: [{ date: "Jun", value: 140 }, { date: "Jul", value: 145 }, { date: "Aug", value: 150 }] },
  { id: 4, patient_id: 4, test_name: "Creatinine", unit: "mg/dL", values: [{ date: "Jun", value: 2.0 }, { date: "Jul", value: 2.2 }, { date: "Aug", value: 2.5 }] },
  { id: 5, patient_id: 5, test_name: "Lipid Panel", unit: "", values: [{ date: "Jun", value: 1 }, { date: "Jul", value: 1 }, { date: "Aug", value: 1 }] },
];

export const patientExplanations = {
  1: {
    en: "Your cholesterol is at 240, which is higher than the recommended level of under 200. This means there's extra fat in your blood that could build up in your arteries over time. With diet changes, exercise, and possibly medication, this can be managed well. Please schedule a visit with your doctor this week.",
    fr: "Votre cholestérol est à 240, supérieur au niveau recommandé de 200. Cela signifie qu'il y a un excès de graisse dans votre sang. Avec des changements alimentaires, de l'exercice et éventuellement des médicaments, cela peut être bien géré. Veuillez prendre rendez-vous avec votre médecin.",
    ak: "Wo cholesterol no yɛ 240, a ɛsen deɛ wɔhyɛ no a ɛyɛ 200 ase. Eyi kyerɛ sɛ srade a ɛboro so wɔ wo mogya mu. Nsakrae nketewa bɛtumi aboa. Kɔ wo dɔkota nkyɛn dapɛn yi mu.",
  },
  2: {
    en: "Your HbA1c level is 7.5%, above the normal range of under 5.7%. This shows your average blood sugar over 3 months. A higher number means your diabetes plan may need adjusting. Let's work with your doctor to review your medications, diet, and activity level.",
    fr: "Votre taux d'HbA1c est de 7,5%, au-dessus de la plage normale de 5,7%. Ce test montre votre glycémie moyenne sur 3 mois. Travaillons avec votre médecin pour ajuster votre plan.",
    ak: "Wo HbA1c level yɛ 7.5%, a ɛsen 5.7%. Saa nhwehwɛmu yi kyerɛ wo mogya mu asikire a ɛwɔ abosome 3 mu. Yɛne wo dɔkota bɛhwɛ wo nnuro ne wo aduane mu.",
  },
  3: {
    en: "Your blood pressure is 150/95, higher than the healthy target of 120/80. High blood pressure often has no symptoms but can affect your heart over time. Reducing salt, staying active, managing stress, and taking medications can make a big difference.",
    fr: "Votre tension est de 150/95, supérieure à l'objectif de 120/80. L'hypertension peut affecter votre cœur. Réduire le sel et rester actif peut faire une grande différence.",
    ak: "Wo mogya mu ahoɔden yɛ 150/95, a ɛsen 120/80. Nkyene a wotew so ne mmɔden a wobɔ no bɛtumi aboa. Kɔ wo dɔkota nkyɛn ntɛm.",
  },
  4: {
    en: "Your creatinine level is 2.5, above the normal range of 0.6 to 1.2. Creatinine is a waste product your kidneys filter out. A higher level may mean your kidneys need extra support. It's important to follow up with your doctor to understand what's happening.",
    fr: "Votre créatinine est de 2,5, au-dessus de la plage normale de 0,6 à 1,2. Un niveau plus élevé peut signifier que vos reins ont besoin de soutien. Veuillez faire un suivi avec votre médecin.",
    ak: "Wo creatinine level yɛ 2.5, a ɛsen 0.6-1.2. Creatinine yɛ fi a wo asabo tew mu. Ɛho hia sɛ wone wo dɔkota di nkɔmmɔ.",
  },
  5: {
    en: "Great news! Your lipid panel results are completely normal. Your cholesterol and fat levels are healthy. Keep up your current lifestyle — eating well, staying active, and getting regular check-ups.",
    fr: "Bonne nouvelle! Vos résultats de bilan lipidique sont normaux. Continuez vos bonnes habitudes de vie!",
    ak: "Asɛm pa! Wo lipid panel no nyinaa yɛ papa. Toa wo abrabɔ papa no so!",
  },
};

export const patientNextSteps = {
  1: ["Schedule a doctor's appointment this week", "Eat more fruits, vegetables, and whole grains", "Walk for 30 minutes most days"],
  2: ["Review your meal plan with your care team", "Check your blood sugar regularly", "Stay active — even short walks help"],
  3: ["Reduce salt in your meals", "Practice deep breathing daily", "Take medications as prescribed"],
  4: ["See your kidney specialist soon", "Drink plenty of water unless told otherwise", "Avoid OTC pain medicines like ibuprofen"],
  5: ["Keep up your healthy eating habits", "Stay physically active", "Schedule your next annual check-up"],
};