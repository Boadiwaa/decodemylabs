# TalkingLabs

> **Lab results you can actually understand — in your language, on your phone, with on-device AI.**

TalkingLabs is a mobile health app that transforms lab reports into plain-language explanations with voice playback. Patients photograph or upload a saved copy of their lab report, and the app uses Google's Gemma 4 model, running on the phone, to extract values, flag abnormal results, and explain what they mean in English, French, or Akan.

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
Patient photographs or uploads a lab report (image or PDF)
        ↓
On-device model reads the report directly
  (Gemma 4 via LiteRT-LM on Android, or via llama.rn on iOS)
  → structured values: test name, value, unit, range
        ↓  if the model is unavailable or returns nothing
expo-ocr text → model text parsing → regex extraction → manual entry
        ↓
reference_ranges.js classifies each value: safe / warn / danger
        ↓
Plain-language explanation in English, French, and Akan
        ↓
expo-speech (EN/FR) or Akan TTS reads it aloud
        ↓
Results stored on-device for longitudinal tracking
```

Parsing, classification, and storage run **on-device**. Two features use the network: Akan voice playback (Hugging Face-hosted translation and speech models) and the optional remote Gemma provider (see [Configuration](#configuration)). In remote mode, photos are redacted on-device before upload; PDFs and extracted report text are currently sent without redaction.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Photo → data** | Point the camera at any lab report. On-device vision extracts all values automatically. |
| **Plain-language explanation** | Each result explained in simple terms, not medical jargon. |
| **Trilingual TTS** | Listen to your explanation in English, French, or Akan. |
| **Severity flags** | Color-coded: green (normal), amber (elevated), red (critical). |
| **Trend tracking** | Chart your lab values over time. See if things are getting better or worse. |
| **On-device AI** | Lab parsing runs on the phone. Report images stay on the device unless you enable the remote provider. |
| **Layered parsing** | Model vision → OCR + model text → regex → manual entry, so extraction still works when the model is unavailable. |

---

## Model Runtimes

| Runtime | Model | Platforms | Notes |
|---------|-------|-----------|-------|
| `litertlm` | Gemma 4 E2B (`gemma-4-E2B-it.litertlm`, 2.59 GB) | Android | Default in `.env.local`. Text and image input on CPU. Requires LiteRT-LM ≥ 0.10.1. |
| `llama` | Gemma 4 E2B GGUF (`gemma-4-E2B-it-Q4_0.gguf` 2.84 GB + `mmproj-gemma-4-E2B-it-Q8_0.gguf` 0.56 GB) | iOS, Android | Via `llama.rn` ≥ 0.12 (earlier versions can't load Gemma 4). iOS has no LiteRT bridge, so it uses this runtime. |
| `remote` provider | Gemma API you host | Both | Set `EXPO_PUBLIC_MODEL_PROVIDER=remote`. Needs a server; see [Configuration](#configuration). |

Both runtimes run the same model, so results should be similar across platforms. Severity always comes from the deterministic rules in `reference_ranges.js`, not from the model.

If a native model load crashes the app, the next launch skips that runtime and continues in rule-based mode (see `LiteRTService.js`).

---

## Architecture

```
src/
├── agents/
│   ├── AgentOrchestrator.js   ← Runs all agents for one lab result
│   ├── LabInterpretationAgent.js  ← Gemma: generates explanation + next steps
│   └── types.js               ← Agent interface contract (createAgentOutput)
│
├── services/
│   ├── LlamaService.js        ← Inference entry point: picks llama.rn, LiteRT, or remote
│   ├── LiteRTService.js       ← Android LiteRT-LM adapter + crash-loop guard
│   ├── RemoteGemmaService.js  ← Optional hosted Gemma API client
│   ├── PIIRedactionService.js ← Redacts images before any remote upload
│   ├── LabReportParser.js     ← Extraction pipeline (vision → OCR → regex)
│   ├── PatientStorage.js      ← AsyncStorage CRUD for on-device records
│   └── AkanTTSService.js      ← Akan TTS via Hugging Face models + expo-av
│
├── domain/
│   ├── reference_ranges.js    ← ALL clinical thresholds (single source of truth)
│   ├── interpretation_rules.js ← Trend analysis, urgency assessment
│   └── personalization.js     ← Medication/condition-aware notes
│
├── screens/
│   ├── DashboardScreen.js     ← Entry point with severity summary
│   ├── LabUploadScreen.js     ← Photo/PDF capture, parsing, manual entry
│   ├── ReportScreen.js        ← Report summary and key findings
│   ├── MetricDetailScreen.js  ← Per-metric trend, explanation, TTS
│   ├── PatientDetailScreen.js ← Legacy; only screen that runs model interpretation
│   └── TrendsScreen.js        ← Historical trend charts
│
├── components/
│   ├── AIInsightCard.js       ← Renders the model's explanation
│   ├── TrendChart.js          ← react-native-chart-kit wrapper
│   ├── TTSPlayer.js           ← Language selector + playback controls
│   └── ModelStatusBar.js      ← Shows model loading progress
│
└── context/
    ├── AppContext.js           ← Global state: patient data, toasts
    └── ModelContext.js         ← Model load state, progress

modules/
├── expo-ocr/                  ← Custom native module (Apple Vision / ML Kit)
└── expo-litertlm/             ← Android LiteRT-LM bridge (iOS stub)

models/                        ← GITIGNORED — download via scripts/download-models.sh
├── gemma-4-E2B-it.litertlm
├── gemma-4-E2B-it-Q4_0.gguf
└── mmproj-gemma-4-E2B-it-Q8_0.gguf

prompts/
├── labInterpretation.js       ← Interpretation prompts (imported by the agent)
├── labExtraction.js           ← Text / image / PDF extraction prompts
└── lab_interpretation.prompt.md  ← Original prompt write-up (reference only)

__tests__/                     ← Jest unit tests (npm test)
```

### Data Flow (detailed)

```
LabUploadScreen
  → LabReportParser.parseLabReportFromImage(imageUri)
      1. llamaService.completeWithImage()  ← Gemma vision (Tier 1)
         OR
      2. recognizeText(imageUri)            ← expo-ocr (Apple Vision / ML Kit)
         → llamaService.complete()          ← Gemma text (Tier 2)
         OR
      3. extractWithRegex(text)             ← 30+ pattern regex engine (Tier 3)
  → [ParsedLabResult, ...]                  ← normalized, severity-classified

ReportScreen / MetricDetailScreen
  → deterministic summaries from reference_ranges.js + personalization.js

PatientDetailScreen (legacy, not linked from the main flow)
  → AgentOrchestrator.runAll({ patient, lab, trend, mode })
      → LabInterpretationAgent.run()
          → buildUserPrompt()               ← patient context + lab data
          → llamaService.complete()         ← Gemma generates explanation
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
| On-device LLM | Gemma 4 E2B via LiteRT-LM 0.10.2 (Android) or `llama.rn` 0.12.9 GGUF (iOS) |
| OCR | Custom `expo-ocr` module (Apple Vision on iOS, ML Kit on Android) |
| Navigation | React Navigation 7 (native stack + bottom tabs) |
| Charts | `react-native-chart-kit` |
| TTS | `expo-speech` (EN/FR) + custom Akan TTS via `expo-av` |
| Animation | `react-native-reanimated` 4 |
| Storage | `@react-native-async-storage/async-storage` |
| Tests | Jest (`jest-expo` preset), run in GitHub Actions |

---

## Getting Started

See [SETUP.md](SETUP.md) for full step-by-step instructions.

**Quick start (requires physical device):**

```bash
git clone https://github.com/Boadiwaa/talkinglabs.git
cd talkinglabs
npm install
chmod +x scripts/download-models.sh && ./scripts/download-models.sh
# create .env.local (see Configuration below)
npx expo run:ios   # or: npx expo run:android
```

Run the unit tests with `npm test`.

---

## Configuration

Settings are read from `.env.local` (gitignored) at bundle time. Restart Metro after changing it.

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXPO_PUBLIC_MODEL_PROVIDER` | `local` | `local` (on-device) or `remote` (hosted Gemma API) |
| `EXPO_PUBLIC_LOCAL_INFERENCE_RUNTIME` | `auto` | `litertlm`, `llama`, or `auto` (LiteRT on Android, then llama.rn if allowed) |
| `EXPO_PUBLIC_ALLOW_ANDROID_LLAMA_FALLBACK` | `false` | Let `auto` fall back to llama.rn on Android |
| `EXPO_PUBLIC_ALLOW_EMULATOR_MODEL_LOAD` | `false` | Allow model loading on Android emulators |
| `EXPO_PUBLIC_MIN_ANDROID_MODEL_RAM_GB` | `5.5` | RAM floor for local models on Android (skipped when runtime is `litertlm`) |
| `EXPO_PUBLIC_LITERT_MODEL_FILENAME` | `gemma-4-E2B-it.litertlm` | LiteRT model file name |
| `EXPO_PUBLIC_LLAMA_MODEL_FILENAME` / `EXPO_PUBLIC_LLAMA_MMPROJ_FILENAME` | Gemma 4 GGUF files | llama.rn model files |
| `EXPO_PUBLIC_HF_API_TOKEN` | — | Hugging Face token for Akan translation |
| `EXPO_PUBLIC_GEMMA_API_*` | — | Remote provider URL, model, endpoints, timeout, and key |

Example for Android on-device Gemma 4:

```
EXPO_PUBLIC_MODEL_PROVIDER=local
EXPO_PUBLIC_LOCAL_INFERENCE_RUNTIME=litertlm
```

> **Warning:** every `EXPO_PUBLIC_` value is compiled into the app bundle and can be extracted from an installed app. Use personal development tokens only. For a public release, route Hugging Face and Gemma API calls through a server that holds the secrets.

---

## Project Structure Notes

- **Clinical reference ranges** live exclusively in `src/domain/reference_ranges.js` — never hardcoded elsewhere.
- **Mock data** for UI development lives in `src/data/mockData.js`.
- **LLM prompts** live in `prompts/` as JS modules — never inlined in agent or parser code.
- **Models** (~6 GB for both runtimes) are gitignored. See `scripts/download-models.sh`.

---

## Safety & Disclaimers

This is a **prototype with mock data**. It is:
- **Not** FDA-cleared or CE-marked medical software
- **Not** a substitute for professional clinical judgment
- **Not** HIPAA-compliant. Data stays in on-device AsyncStorage, which is not encrypted, and passwords are stored as salted SHA-256 hashes, which is not production-grade credential storage.

Every AI-generated explanation includes: *"Consult a licensed healthcare provider."*

---

## License

MIT — see LICENSE.
