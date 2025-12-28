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

### Test Environment
- Uses `happy-dom` (fast, lightweight DOM implementation)
- Setup file: `src/test/setup.ts` (mocks localStorage, matchMedia, crypto.randomUUID)
- Tests located in: `src/**/*.test.{ts,tsx}`

## Architecture Overview

**NeuroLogg Pro** is a PWA for tracking and analyzing emotional/behavioral patterns in neurodivergent children. Built with React 19 + TypeScript + Vite.

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

**Current (Cloud APIs):**
- `ai.ts` - OpenRouter API (primary, premium model chain: Grok-4 → GPT-5.1 → Gemini 2.5 Pro)
- `gemini.ts` - Google Gemini API (alternative)

**Future (Local Inference):**
- `localModel.ts` - WebLLM integration for offline-first AI (currently disabled)
- Uses `@mlc-ai/web-llm` package (~5.5MB bundle, will be optimized when enabled)
- Planned: Fine-tuned Gemma model for Norwegian behavioral analysis
- Context: `src/contexts/ModelContext.tsx` manages model loading state

> **Note:** Local model support is intentionally disabled. The app currently uses OpenRouter.
> When ready to enable local inference, set `LOCAL_SERVER_CONFIG.enabled = true` in `localModel.ts`
> or implement the WebLLM flow via the ModelLoader component.

App works without API keys using mock data.

### Key Technologies
- **UI**: Tailwind CSS v4, Framer Motion, Lucide icons
- **Charts**: Recharts, Three.js with @react-three/fiber (lazy-loaded)
- **i18n**: i18next (Norwegian primary, English fallback) - translations in `src/locales/`
- **PDF**: jsPDF + jspdf-autotable
- **Local AI**: @mlc-ai/web-llm (future, currently bundled but disabled)

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
├── components/     # React components (23 files)
│   └── onboarding/ # Onboarding wizard steps
├── contexts/       # React contexts (ModelContext for local AI)
├── services/       # AI APIs (ai.ts, gemini.ts, localModel.ts) + PDF generation
├── utils/          # Data generation, export, predictions, transition analysis
├── locales/        # i18n translations (en.json, no.json)
├── test/           # Vitest setup and mocks
├── store.tsx       # All React Context providers
└── types.ts        # TypeScript data models with enums/constants
```
