# CLAUDE.md - Project Context for AI Assistants

## What Is This App?
TalkingLabs is a patient-facing mobile app built with Expo and React Native that helps people understand lab reports in plain language. Users can upload photos of their reports, review extracted values, see a clear summary, and open metric-level explanations with trend context and text-to-speech support.

## Current Product Scope
- Patient mode only. There is no active clinician mode.
- On-device first parsing and interpretation design.
- Real uploaded data is stored locally and blended with demo/mock fallback data when needed.

## Core User Journey
1. Sign up and onboarding: user registers and completes demographics, medical history, and drug history.
2. Upload lab report: user uploads from camera or photo library. PDF upload is removed for now.
3. Parse and confirm: app attempts automatic extraction, then allows manual correction and entry.
4. Report-first review: user lands on a report summary with severity counts and key findings.
5. Metric deep dive: user opens individual metrics for trend chart, personalized explanation, and TTS playback.
6. Ongoing tracking: user revisits past uploads and trend views.

## Design Philosophy
- Exceptional UI and UX is required: simple, clear, and visually polished.
- Patient-first language: warm, non-alarming, plain explanations.
- Personalization by context: medications and conditions can influence explanation framing.
- Accessibility by default: interactive elements require accessibility labels.
- Safety-first communication: include clear medical safety disclaimers in patient-facing content.

## Data Flow
1. Capture: uploads are handled in LabUploadScreen.js using expo-image-picker.
2. Persist files: uploaded files and report metadata are saved on-device via PatientStorage.js.
3. Image parse path (primary): images first attempt direct multimodal extraction in LabReportParser.js through LlamaService.js.
4. OCR fallback path: if multimodal is unavailable or empty, app runs on-device OCR and text parsing in LabReportParser.js.
5. Regex fallback path: if model text parsing returns no structured values, regex extraction runs in LabReportParser.js.
6. Manual entry fallback: if automatic extraction is insufficient, users manually enter values in LabUploadScreen.js.
7. Classification and trends: deterministic severity and deviation come from reference_ranges.js, with trend and urgency helpers in interpretation_rules.js.
8. Personalization: medication and condition-aware deterministic context is generated in personalization.js using stored patient context from PatientStorage.js.
9. Interpretation: LabInterpretationAgent.js uses on-device inference when available and falls back to rule-based output; useLabInterpretation.js can then fall back to demo explanations when needed.
10. Render and navigation: upload and dashboard flows open ReportScreen.js, then MetricDetailScreen.js, wired through TabNavigator.js.
11. State ownership: auth and onboarding state lives in AuthContext.js, model readiness in ModelContext.js, and lightweight app-level mode/toast state in AppContext.js.

## Key Files to Understand First

### Data and Configuration
- reference_ranges.js - Reference ranges and severity/deviation logic
- mockData.js - Mock/demo patients, labs, alerts, and explanations
- types.js - JSDoc type definitions
- prompts/labInterpretation.js, prompts/labExtraction.js - Prompt templates imported by the agent and parser
- lab_interpretation.prompt.md - Original prompt write-up (reference only, not loaded at runtime)
- constants/inference.js - Provider and runtime selection from EXPO_PUBLIC_ env vars

### State and Context
- AuthContext.js - Session, onboarding, and profile overlay behavior
- ModelContext.js - Model initialization and readiness state
- AppContext.js - Patient mode and toast state
- PatientStorage.js - On-device persistence for profile, history, reports, and results

### Domain Logic
- reference_ranges.js - Deterministic classification and deviation
- personalization.js - Deterministic medication and condition-aware notes
- interpretation_rules.js - Trend and urgency helpers
- lab_groups.js - Body-system groups with patient-friendly titles; use for ordering result lists

### AI Agents
- types.js - Agent output interface and validation helpers
- AgentOrchestrator.js - Agent coordination entry point
- LabInterpretationAgent.js - On-device interpretation with robust fallback logic

### Services
- LabReportParser.js - Image/OCR parsing pipeline and structured extraction
- LlamaService.js - Inference entry point; routes to llama.rn or LiteRT
- LiteRTService.js - Android LiteRT-LM adapter (Gemma 4) with a crash-loop guard
- PatientStorage.js - Persistent storage API (health data, app settings, backup read/write)
- DataBackup.js - Export a backup file via the share sheet and restore one (not encrypted)
- AppLock.js - Biometric / phone PIN check via expo-local-authentication
- AkanTTSService.js - Akan TTS support
- ModelSetup.js - Model setup utilities

### Screens
- DashboardScreen.js - Main dashboard entry
- LabUploadScreen.js - Upload, parsing, and manual entry flow
- ReportScreen.js - Report-first summary and findings
- MetricDetailScreen.js - Metric deep dive, trend, Gemma explanation (via useMetricExplanation), and TTS
- TrendsScreen.js - Trend browsing and drill-in
- DemographicsScreen.js - Demographics onboarding
- MedicalHistoryScreen.js - Chronic conditions, including free-text "other" conditions; onboarding step, and editable later from Settings → My health
- DrugHistoryScreen.js - Medications; onboarding step, and editable later from Settings → My health
- PatientDetailScreen.js - Legacy detail screen; registered in navigation but not linked

### Components
- TrendChart.js - Trend chart UI
- TTSPlayer.js - Multi-language TTS player
- AIInsightCard.js - Insight and confidence presentation
- ModelStatusBar.js - Model readiness bar
- Toast.js - Toast feedback
- AppLockGate.js - Covers the app until unlock when App lock is on

### Native Modules
- modules/expo-ocr - On-device OCR (Apple Vision / ML Kit)
- modules/expo-litertlm - Android LiteRT-LM bridge (litertlm-android 0.10.2); iOS is a stub

### Tests
- __tests__/ - Jest unit tests for reference ranges, rules, personalization, parser regex, and password hashing. Run with npm test.

### Hooks
- useUserLabData.js - Real-data and mock-data bridge for labs, alerts, trends, and report sessions
- useLabInterpretation.js - Interpretation execution and fallback handling (legacy PatientDetailScreen)
- useMetricExplanation.js - Per-metric Gemma explanation: queued, saved on-device, cross-checked against severity
- usePatientData.js - Patient data access helper
- useAkanTTS.js - Akan speech helper

## When Generating New Code

### Data Rules
- Use reference_ranges.js as the single source of truth for severity logic.
- Use mockData.js for demo/mock data shapes.
- Check types.js before introducing new entities.
- Reuse helpers from helpers.js before adding duplicates.
- Check existing context boundaries in AuthContext.js, ModelContext.js, and AppContext.js before adding state.

### Personalization Rules
- Personalize explanations with medication, condition, and demographic context.
- Pull context from on-device storage via PatientStorage.js.
- Keep deterministic personalization logic in personalization.js.
- If data is incomplete, state uncertainty explicitly and avoid diagnosis language.

### Tone and Language
- Keep language warm, reassuring, and easy to understand.
- Avoid alarmist wording.
- End patient-facing recommendations with this exact phrase: Consult a licensed healthcare provider.
- Support EN, FR, and AK when generating multilingual explanations.

### AI and Safety Rules
- Never generate diagnoses.
- Keep agent outputs compatible with types.js.
- Route on-device inference through LlamaService.js.
- Route parsing through LabReportParser.js.
- Maintain fallback behavior:
Parse chain: multimodal image parse -> OCR text parse -> regex extraction -> manual entry.
Interpretation chain: on-device model -> rule-based fallback -> demo/prewritten fallback.
- Store new prompt templates in prompts, and avoid introducing new inline prompt literals in agent files.

### UI and Interaction Rules
- Patient mode only. Do not introduce clinician mode UX.
- Use expo-haptics for button interactions.
- Use react-native-reanimated entrances for cards and list items.
- Keep upload progress messaging clear and friendly.
- Include accessibility labels on interactive controls.
- Use StyleSheet.create for styles.
- Import order: React -> React Native -> Expo -> Reanimated -> Navigation -> Local.

## Safety
- It is not clinical decision support.
- It is not a substitute for professional medical care.
- No HIPAA guarantee is implied by this prototype architecture.
- Patient-facing medical text must include: Consult a licensed healthcare provider.
- Prefer deterministic cross-checks against reference_ranges.js before showing model-derived interpretations.
- Do not claim OCR confidence-gating behavior unless that logic is explicitly implemented in code.