# TalkingLabs

> **Lab results you can actually understand — in your language, on your phone, no internet required.**

TalkingLabs is a mobile health app that transforms lab reports into plain-language explanations with voice playback. Patients photograph or upload a saved copy of their lab report, and the app uses an on-device MedGemma model to extract values, flag abnormal results, and explain what they mean in English, French, or Akan.

Built for [HAI-DEF Hackathon 2026](https://hai-def.org).

---

## The Problem

In low- and middle-income countries (LMICs), the typical lab result journey looks like this:

1. Patient waits weeks for an appointment.
2. Labs are ordered and a significant wait and financial cost follows.
3. A paper report is handed over with numbers the patient cannot interpret.
4. The clinician glances at it, gives verbal feedback, and the paper is lost by the next visit.
5. No longitudinal tracking. No patient ownership. No understanding.

TalkingLabs addresses each of these gaps.

---

## Solution Overview

```
┌─────────────────────────────────────────────────────────┐
│  Patient photographs their lab report                   │
│                         ↓                              │
│  expo-ocr (Apple Vision / ML Kit) extracts text        │
│                         ↓                              │
│  MedGemma (on-device, llama.rn) parses lab values      │
│  → structured JSON: test name, value, unit, range      │
│                         ↓                              │
│  Domain rules classify severity: safe / warn / danger  │
│                         ↓                              │
│  MedGemma generates plain-language explanation         │
│  in English, French, and Akan                          │
│                         ↓                              │
│  expo-speech reads the explanation aloud               │
│                         ↓                              │
│  Results stored on-device for longitudinal tracking    │
└─────────────────────────────────────────────────────────┘
```

Everything runs **fully on-device** — no server, no cloud API, no internet required after initial setup.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Photo → data** | Point the camera at any lab report. MedGemma vision extracts all values automatically. |
| **Plain-language explanation** | Each result explained in simple terms, not medical jargon. |
| **Trilingual TTS** | Listen to your explanation in English, French, or Akan. |
| **Severity flags** | Color-coded: green (normal), amber (elevated), red (critical). |
| **Trend tracking** | Chart your lab values over time. See if things are getting better or worse. |
| **Fully offline** | MedGemma runs on your device via `llama.rn`. No data ever leaves the phone. |
| **3-tier parsing** | MedGemma vision → OCR + MedGemma text → regex fallback ensures reliable extraction even on low-end devices. |

---

## Why MedGemma?

A generic vision or language model cannot reliably interpret medical abbreviations (SGPT → ALT), handle unit variations (mg/dL vs mmol/L), or calibrate urgency language correctly. MedGemma's medical pre-training handles all of this natively, with a dramatically lower hallucination rate on clinical content compared to general-purpose models.

See the [Technical Write-up](#technical-write-up) section for full details.

---

## Architecture

```
src/
├── agents/
│   ├── AgentOrchestrator.js   ← Runs all agents for one lab result
│   ├── LabInterpretationAgent.js  ← MedGemma: generates explanation + next steps
│   └── types.js               ← Agent interface contract (createAgentOutput)
│
├── services/
│   ├── LlamaService.js        ← llama.rn singleton: model load, inference, queue
│   ├── LabReportParser.js     ← 3-tier extraction pipeline (vision → OCR → regex)
│   ├── PatientStorage.js      ← AsyncStorage CRUD for on-device records
│   └── AkanTTSService.js      ← Akan language TTS via expo-av
│
├── domain/
│   ├── reference_ranges.js    ← ALL clinical thresholds (single source of truth)
│   └── interpretation_rules.js ← Trend analysis, urgency assessment
│
├── screens/
│   ├── DashboardScreen.js     ← Patient list with severity summary
│   ├── LabUploadScreen.js     ← Photo capture + parsing flow
│   ├── PatientDetailScreen.js ← Result detail, chart, TTS player
│   └── TrendsScreen.js        ← Historical trend charts
│
├── components/
│   ├── AIInsightCard.js       ← Renders MedGemma explanation
│   ├── TrendChart.js          ← react-native-chart-kit wrapper
│   ├── TTSPlayer.js           ← Language selector + playback controls
│   └── ModelStatusBar.js      ← Shows model loading progress
│
└── context/
    ├── AppContext.js           ← Global state: patient data, toasts
    └── ModelContext.js         ← Model load state, progress

modules/
└── expo-ocr/                  ← Custom native module (Apple Vision / ML Kit)

models/                        ← GITIGNORED — download via scripts/download-models.sh
├── medgemma-1.5-4b-it-Q3_K_M.gguf
└── mmproj-F16.gguf

prompts/
└── lab_interpretation.prompt.md  ← Prompt template for MedGemma
```

### Data Flow (detailed)

```
LabUploadScreen
  → LabReportParser.parseLabReportFromImage(imageUri)
      1. llamaService.completeWithImage()  ← MedGemma vision (Tier 1)
         OR
      2. recognizeText(imageUri)            ← expo-ocr (Apple Vision / ML Kit)
         → llamaService.complete()          ← MedGemma text (Tier 2)
         OR
      3. extractWithRegex(text)             ← 30+ pattern regex engine (Tier 3)
  → [ParsedLabResult, ...]                  ← normalized, severity-classified

PatientDetailScreen
  → AgentOrchestrator.runAll({ patient, lab, trend, mode })
      → LabInterpretationAgent.run()
          → buildUserPrompt()               ← patient context + lab data
          → llamaService.complete()         ← MedGemma generates explanation
          → parseModelOutput()              ← extract structured sections
      → AgentOutput { summary, actions, next_steps, en, fr, ak }

  → AIInsightCard renders the explanation
  → TTSPlayer speaks the text via expo-speech / AkanTTSService
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile framework | Expo SDK 54 / React Native 0.81 |
| On-device LLM | `llama.rn` + MedGemma `Q3_K_M` GGUF |
| OCR | Custom `expo-ocr` module (Apple Vision on iOS, ML Kit on Android) |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| Charts | `react-native-chart-kit` |
| TTS | `expo-speech` (EN/FR) + custom Akan TTS via `expo-av` |
| Animation | `react-native-reanimated` 4 |
| Storage | `@react-native-async-storage/async-storage` |

---

## Getting Started

See [SETUP.md](SETUP.md) for full step-by-step instructions.

**Quick start (requires physical device):**

```bash
git clone https://github.com/your-org/talkinglabs.git
cd talkinglabs
npm install
export HF_TOKEN=hf_your_token_here
chmod +x scripts/download-models.sh && ./scripts/download-models.sh
npx expo run:ios   # or: npx expo run:android
```

---

## Project Structure Notes

- **Clinical reference ranges** live exclusively in `src/domain/reference_ranges.js` — never hardcoded elsewhere.
- **Mock data** for UI development lives in `src/data/mockData.js`.
- **LLM prompts** live in `prompts/` — never inlined in agent code.
- **Models** (~3 GB) are gitignored. See `scripts/download-models.sh`.

---

## Safety & Disclaimers

This is a **prototype with mock data**. It is:
- **Not** FDA-cleared or CE-marked medical software
- **Not** a substitute for professional clinical judgment
- **Not** HIPAA-compliant (demo encryption only)

Every AI-generated explanation includes: *"Please consult your healthcare provider for clinical decisions."*

---

## Technical Write-up

For the full hackathon technical write-up including MedGemma usage rationale, deployment challenges, and impact analysis, see the submission document.

---

## License

MIT — see LICENSE.
