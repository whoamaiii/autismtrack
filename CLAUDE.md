# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start dev server (Vite, http://localhost:5173)
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint validation
npm run preview  # Preview production build
npm run test     # Run Vitest in watch mode
npm run test:run # Run tests once
npm run test:run -- src/path/to/file.test.ts  # Run single test file
npm run test -- --coverage                     # Run tests with coverage
```

### Android Build Commands

```bash
# Build and sync to Android
npm run build && npx cap sync android

# Open in Android Studio (for emulator testing or APK generation)
npx cap open android

# Build debug APK directly (without Android Studio)
cd android && ./gradlew assembleDebug
# APK location: android/app/build/outputs/apk/debug/app-debug.apk

# Build release APK (requires signing configuration)
cd android && ./gradlew assembleRelease

# Build APK with bundled model (offline-first, ~2GB APK)
# First download model to: android/app/src/main/assets/models/gemma3-4b-it-int4-web.task
# Then build normally - model auto-extracts on first launch
```

**Prerequisites for Android builds:**
- Java JDK 21+ (`brew install openjdk@21` on macOS)
- Android Studio with Android SDK
- Accept Android SDK licenses

### Test Environment
- Uses `happy-dom` (fast, lightweight DOM implementation)
- Setup file: `src/test/setup.ts` (mocks localStorage, matchMedia, crypto.randomUUID)
- Tests located in: `src/**/*.test.{ts,tsx}`

## Architecture Overview

**NeuroLogg Pro** is a PWA and native Android app for tracking and analyzing emotional/behavioral patterns in neurodivergent children. Built with React 19 + TypeScript + Vite, with Capacitor for native Android builds.

### Entry Points & Routing
- `src/main.tsx` - React root with PWA service worker registration
- `src/App.tsx` - React Router v6 with code splitting (Home/Dashboard eager, all others lazy)
- 14 routes: `/`, `/dashboard`, `/log`, `/analysis`, `/crisis`, `/schedule`, `/goals`, `/behavior-insights`, `/sensory-profile`, `/energy-regulation`, `/heatmap`, `/transitions`, `/reports`, `/settings`

### State Management
React Context-based (no Redux). All state in `src/store.tsx`:
- `LogsContext` - Emotion/arousal entries
- `CrisisContext` - Crisis events
- `ScheduleContext` - Daily schedules and templates
- `GoalsContext` - IEP goal tracking
- `ChildProfileContext` - Child profile with diagnoses/strategies
- `AppContext` - Home/school context toggle

All data persists to `localStorage` with `kreativium_*` key prefix.

### AI Integration
Three-tier AI support in `src/services/`:

**Local Model (Android Native - Primary):**
- `localModel.ts` - Kreativium 4B via MediaPipe LLM Inference
- Runs entirely on-device using Snapdragon NPU (90+ tokens/sec on S25 Ultra)
- Model size: ~2.6GB (int4 quantized)
- Context: `src/contexts/ModelContext.tsx` manages download/loading state
- UI: `ModelDownloadPrompt.tsx` (first-launch), `ModelManager.tsx` (settings)
- Native plugin: `android/app/src/main/java/.../KreativiumPlugin.java`

**Bundled Model Support:**
- Model can be bundled directly in the APK for offline-first deployment
- Location: `android/app/src/main/assets/models/gemma3-4b-it-int4-web.task`
- See `android/app/src/main/assets/models/README.md` for download instructions
- Auto-extracts on first launch (no download prompt shown)
- APK size with bundled model: ~2.0GB

**Cloud APIs (Fallback):**
- `ai.ts` - OpenRouter API (premium model chain: Gemini 2.5 Pro → Claude 3.5 → GPT-4o)
- `gemini.ts` - Google Gemini API (alternative)

**AI Priority Order (on Android):**
1. Local Kreativium 4B (bundled in APK or downloaded)
2. Google Gemini API (if configured)
3. OpenRouter API (if configured)
4. Mock data (development fallback)

> **Bundled vs Downloaded:** If model is bundled in APK, it auto-extracts on first launch (~30-60 seconds). If not bundled, user is prompted to download (~2.6GB) or use cloud APIs.

> **Note:** On web/PWA, only cloud APIs are available. On Android native, local model is preferred when downloaded.
> All AI features (`analyzeLogs`, `analyzeLogsDeep`, `analyzeLogsStreaming`) use local model first.

App works without API keys using mock data on web, or local model on Android.

### Privacy-First Architecture (Planned)

**Important:** This app is designed to be **fully local/offline-first** in production. Current implementation details that will change:

1. **API Keys are Temporary**
   - Current cloud AI (OpenRouter/Gemini) is for development/testing only
   - Production will use local LLM inference (WebLLM with fine-tuned Kreativium)
   - No API keys will be needed in final release
   - Do NOT treat API key exposure as a security issue to fix - it's a known dev-only pattern

2. **All Data Stays Local**
   - localStorage is the intentional storage mechanism (no backend)
   - Sensitive data (logs, crisis events, audio) never leaves the device
   - Export/import is user-controlled JSON files
   - This is a feature, not a limitation

3. **Target Deployment**
   - PWA installable on device
   - Works completely offline after initial load
   - No user accounts, no cloud sync, no telemetry
   - Parents/caregivers own their data entirely

### Authentication System

The app uses a **biometric + QR code** two-factor authentication system for device security:

**Auth Flow:**
1. **App Launch** → Biometric prompt (fingerprint/face)
2. **QR TTL Check** → If 30-minute session expired, scan QR code
3. **Unlock** → App accessible with derived encryption key

**Key Files:**
- `src/contexts/AuthContext.tsx` - Auth state machine and enrollment logic
- `src/services/biometricAuth.ts` - Cross-platform biometric wrapper
- `src/services/qrScanner.ts` - ML Kit QR scanning service
- `src/services/crypto/` - AES-256-GCM encryption, HKDF key derivation
- `src/utils/qrPayloadSchema.ts` - QR payload validation (Zod schema)
- `src/utils/qrPayloadGenerator.ts` - Generate test/admin QR payloads
- `src/components/auth/` - UI components (LockScreen, BiometricPrompt, QRScanScreen, etc.)
- `android/app/src/main/java/.../BiometricPlugin.java` - Native Android biometric

**Auth States:**
```
initializing → locked → biometricPending → qrPending → unlocked
                  ↓              ↓               ↓
                error ←←←←←←←←←←←←←←←←←←←←←←←←←←
```

**QR Payload Format:**
```json
{
  "version": "1.0.0",
  "deviceKey": "<base64 256-bit key>",
  "pgpPublicKey": "<armored PGP public key>",
  "issuedAt": "2025-01-14T...",
  "permissions": {
    "canExport": true,
    "canDeleteData": false,
    "canModifyProfile": true
  }
}
```

**Development/Testing:**
```javascript
// In browser console (dev mode):
generateTestQR()  // Creates a valid test QR payload
```

**Toggle Auth (for development):**
```typescript
// In src/App.tsx:
const BYPASS_AUTH = true;  // Skip auth for development
const BYPASS_AUTH = false; // Enable full auth (default)
```

**Security Features:**
- Biometric via AndroidX BiometricPrompt (Class 3 strong authentication)
- QR-derived encryption key using HKDF (SHA-256)
- AES-256-GCM for local storage encryption
- 30-minute QR TTL requires physical QR possession
- Device salt stored locally, key never stored

### Native App (Android)

The app uses **Capacitor** to run as a native Android app. Key differences from PWA:

**Platform Detection** (`src/utils/platform.ts`):
```typescript
import { isNative, isAndroid, isWeb } from './utils/platform';
```

**Platform-Specific Behavior:**
| Feature | PWA (Web) | Native (Android) |
|---------|-----------|------------------|
| Haptic feedback | `navigator.vibrate()` | `@capacitor/haptics` |
| Audio recording | Full support | **Disabled** (UI hidden) |
| Data export | Browser download | `@capacitor/filesystem` + `@capacitor/share` |
| Microphone permission | Checked on mount | Skipped (unavailable) |
| Biometric auth | Manual input only | Native BiometricPrompt |
| QR code scanning | Manual input only | ML Kit camera scanner |

**Why Audio Recording is Disabled on Native:**
- Simplifies implementation (no native audio plugins needed)
- Crisis mode features remain functional without audio
- Can be enabled later by adding `@capacitor/microphone` plugin

**Capacitor Plugins Installed:**
- `@capacitor/core` - Core Capacitor runtime
- `@capacitor/haptics` - Native vibration feedback
- `@capacitor/filesystem` - File system access for exports
- `@capacitor/share` - Native share dialog for exports
- `@capacitor-mlkit/barcode-scanning` - QR code camera scanning (ML Kit)

**Files Modified for Native Support:**
- `src/utils/platform.ts` - Platform detection utilities
- `src/utils/exportData.ts` - Native file export via Filesystem + Share
- `src/components/QuickLog.tsx` - Capacitor Haptics integration
- `src/components/CrisisFloatingButton.tsx` - Capacitor Haptics integration
- `src/components/CrisisMode.tsx` - Audio UI hidden, permission check skipped
- `src/components/Settings.tsx` - Async export handler
- `vite.config.ts` - `base: './'` for Capacitor compatibility
- `capacitor.config.ts` - Capacitor configuration

### Key Technologies
- **UI**: Tailwind CSS v4, Framer Motion, Lucide icons
- **Charts**: Recharts, Three.js with @react-three/fiber (lazy-loaded)
- **i18n**: i18next (Norwegian primary, English fallback) - translations in `src/locales/`
- **PDF**: jsPDF + jspdf-autotable
- **Native**: Capacitor with @capacitor/haptics, @capacitor/filesystem, @capacitor/share
- **Local AI**: MediaPipe LLM Inference with Kreativium 4B (Android native, fully functional)

### Design System
"Liquid Glass" dark theme aesthetic:
- Custom Tailwind utilities: `liquid-glass`, `liquid-glass-card`, `liquid-glass-active`
- Backdrop blur with saturate effects
- Neon accent colors (cyan, purple, green)
- Mobile-first (max-width 448px)

### Build Optimization
Vite config splits chunks: `vendor-three` (deferred), `vendor-react`, `vendor-ui`, `vendor-webllm` (future local AI), `utils`

## Environment Variables

```env
VITE_GEMINI_API_KEY=...      # Optional - primary AI API
VITE_OPENROUTER_API_KEY=...  # Optional - fallback AI API
VITE_SITE_URL=...            # For AI API headers
```

## Project Structure

```
src/
├── components/     # React components
│   ├── auth/       # Auth UI (LockScreen, BiometricPrompt, QRScanScreen, etc.)
│   └── onboarding/ # Onboarding wizard steps
├── contexts/       # React contexts (AuthContext, ModelContext)
├── services/       # AI, auth, crypto services
│   ├── crypto/     # AES-GCM encryption, HKDF key derivation
│   ├── biometricAuth.ts  # Cross-platform biometric wrapper
│   ├── qrScanner.ts      # ML Kit QR scanning
│   └── ai.ts, gemini.ts, localModel.ts  # AI APIs
├── utils/          # Data generation, export, predictions
│   ├── platform.ts       # Platform detection (isNative, isAndroid, isWeb)
│   ├── qrPayloadSchema.ts    # QR validation (Zod)
│   └── qrPayloadGenerator.ts # Generate test QR payloads
├── locales/        # i18n translations (en.json, no.json)
├── test/           # Vitest setup and mocks
├── store/          # React Context providers (split by domain)
├── constants/      # Storage keys, auth config
├── types/          # TypeScript types
│   └── auth.ts     # Auth type definitions
└── types.ts        # Core data models with enums/constants

android/            # Capacitor Android project (generated)
├── app/            # Android app module
│   ├── src/main/   # Android source and resources
│   │   ├── assets/models/  # Bundled model (optional, ~2.6GB)
│   │   └── java/.../
│   │       ├── KreativiumPlugin.java     # MediaPipe LLM native plugin
│   │       └── BiometricPlugin.java # Native biometric authentication
│   └── build/outputs/apk/  # Built APK files
└── gradle/         # Gradle wrapper

docs/
├── API.md          # AI service integration
├── COMPONENTS.md   # React component reference
├── SETUP.md        # Development setup guide
├── STATE.md        # State management with React Context
├── STORAGE.md      # Data persistence and localStorage
├── TESTING.md      # Testing guide and patterns
├── TYPES.md        # TypeScript type definitions
└── UTILS.md        # Utility functions reference

capacitor.config.ts # Capacitor configuration (appId, webDir)
```

## Documentation

Detailed documentation is available in the `docs/` directory:

| Document | Description |
|----------|-------------|
| [API.md](docs/API.md) | AI service integration, model fallbacks, streaming |
| [COMPONENTS.md](docs/COMPONENTS.md) | React component props and usage |
| [SETUP.md](docs/SETUP.md) | Development environment setup |
| [STATE.md](docs/STATE.md) | React Context state management |
| [STORAGE.md](docs/STORAGE.md) | localStorage architecture, backup/restore |
| [TESTING.md](docs/TESTING.md) | Testing patterns, mocking, coverage |
| [TYPES.md](docs/TYPES.md) | TypeScript interfaces and enums |
| [UTILS.md](docs/UTILS.md) | Risk prediction, transition analysis, validation |

## Task Tracking Workflow

When working on bug fixes or features from a task list:

1. **Before Starting Each Task:**
   - Mark the task as "in progress" in the tracking document (`.claude/BUG_FIXES.md`)

2. **After Completing Each Task:**
   - Run `npm run build` to verify no type errors
   - Run `npm run test:run` to verify tests pass
   - Test the fix manually if applicable
   - Mark task as "completed" in tracking document
   - Add completion date and notes to the Completion Log table

3. **Double-Check Protocol:**
   - Verify the fix addresses the exact issue described
   - Confirm no regressions introduced
   - Update tracking document with completion notes

4. **Tracking Document Location:**
   - Bug fixes: `.claude/BUG_FIXES.md`
   - Format: Checkbox list with status, date, and notes
