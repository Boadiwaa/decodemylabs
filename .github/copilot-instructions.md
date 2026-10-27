# Copilot Instructions for TalkingLabs

## Project Overview
Clinical AI mobile app (Expo/React Native) that interprets lab results.
Patient-friendly explanations with TTS in EN/FR/Akan.

## Tech Stack
- Expo SDK (managed workflow)
- React Native with JavaScript (NOT TypeScript)
- React Navigation (bottom tabs + native stack)
- react-native-chart-kit for trend charts
- expo-speech for TTS
- expo-haptics for haptic feedback
- react-native-reanimated for animations

## Project Structure
- src/screens/       → Full screen components
- src/components/    → Reusable UI components
- src/context/       → React Context providers (AppContext.js)
- src/data/          → Mock data and type definitions
- src/utils/         → Pure utility functions
- src/domain/        → Clinical rules and reference ranges
- src/agents/        → AI agent abstractions
- src/hooks/         → Custom React hooks
- src/constants/     → Colors, typography, layout values
- src/navigation/    → Navigator components and route types
- prompts/           → Prompt templates as markdown files

## Critical Rules
1. NEVER generate actual medical advice. Always include: "Consult a licensed healthcare provider."
2. All clinical reference ranges come from src/domain/reference_ranges.js — never hardcode.
3. All mock data comes from src/data/mockData.js — never create inline mock data.
4. LLM prompts live in prompts/ directory — never inline prompt strings in agent code.
5. All agents must conform to the interface in src/agents/types.js.
6. App is patient-mode only — no clinician mode exists.
7. Use expo-haptics for all button interactions.
8. Use react-native-reanimated (FadeInDown, FadeIn) for list/card animations.

## Code Style
- Functional components with hooks only
- Named exports for utilities, default exports for components/screens
- Destructure props in function signature
- Use StyleSheet.create for all styles
- Import order: React → React Native → Expo → Navigation → Local

## Color Palette
- Brand primary teal: #2BB5A8
- Brand teal dark: #1E998E
- Brand teal light: #E0F5F3
- Danger/Critical (pastel): #D98E93
- Warning/Elevated (pastel): #D4AA6A
- Safe/Normal (pastel): #7BBFA0
- Info/Patient mode (pastel): #9B9EE0
- Backgrounds: #F4FAFA, #EDF4F3, #FFFFFF
- Text primary (navy): #0F2B46
- Text secondary: #5A7184
- Text muted: #94A3B0