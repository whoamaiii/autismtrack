# NeuroLogg Pro - Comprehensive Roadmap

**Created**: 2026-01-11
**Target Platform**: Android PWA (100% local, offline-first)
**AI Strategy**: OpenRouter API (current) → Local Kreativium 27B (future)
**Database**: localStorage (current) → IndexedDB (migration planned)

---

## Executive Summary

This roadmap addresses critical issues identified in the app analysis, organized into 5 phases over an estimated development timeline. All features maintain the privacy-first, fully-local architecture.

### Key Constraints
- No cloud database - all data stays on device
- No user accounts or authentication
- Must work 100% offline after initial install
- Final deployment: Android PWA with local AI inference
- AI transition: OpenRouter → Kreativium 27B (local)

---

## Phase 1: Critical Fixes (Foundation)

**Goal**: Fix issues that undermine core value proposition before any user testing.

### 1.1 Statistical Validity Fixes

#### 1.1.1 Multiple Comparison Correction
- [ ] **File**: `src/utils/multiFactorAnalysis.ts`
- [ ] Implement Benjamini-Hochberg FDR correction
- [ ] Add `applyFDRCorrection(pValues: number[], alpha: number)` function
- [ ] Update `findSignificantPatterns()` to use corrected significance
- [ ] Add tests for FDR correction accuracy
- **Why Critical**: Currently generating ~7.5 false positive patterns per analysis

#### 1.1.2 Fix Invalid P-Value Calculation
- [ ] **File**: `src/utils/multiFactorAnalysis.ts:140-145`
- [ ] Replace `Math.exp(-chiSquared / 2)` with proper chi-squared CDF
- [ ] Implement `chiSquaredCDF(x: number, degreesOfFreedom: number)` utility
- [ ] Add lookup table or numerical approximation (Wilson-Hilferty)
- [ ] Unit test against known chi-squared values
- **Why Critical**: Current math is statistically invalid

#### 1.1.3 Personalized Thresholds
- [ ] **File**: `src/utils/predictions.ts`
- [ ] Add `calculatePersonalizedThresholds(logs: LogEntry[])` function
- [ ] Compute P75 for high arousal threshold (not hardcoded 7)
- [ ] Compute P25 for recovery threshold (not hardcoded 5)
- [ ] Store thresholds in ChildProfile for persistence
- [ ] Update all threshold checks to use personalized values
- **Files to update**: `predictions.ts`, `recoveryAnalysis.ts`, `multiFactorAnalysis.ts`

#### 1.1.4 Confidence Intervals for All Estimates
- [ ] **File**: `src/utils/statistics.ts` (new file)
- [ ] Implement `wilsonScoreInterval(successes, total, confidence)`
- [ ] Implement `bootstrapMeanCI(values, confidence, iterations)`
- [ ] Add CI to strategy effectiveness percentages
- [ ] Add CI to trigger frequency calculations
- [ ] Add CI to risk predictions
- [ ] Display as "72% (95% CI: 58-83%)" format

### 1.2 AI Insight Validation

#### 1.2.1 Ground AI Claims in Data
- [ ] **File**: `src/services/aiValidation.ts` (new file)
- [ ] Create `validateAIInsight(claim: string, data: AnalysisData)` function
- [ ] Extract numerical claims from AI response (regex patterns)
- [ ] Cross-reference against computed statistics
- [ ] Flag discrepancies > 10% as potential hallucinations
- [ ] Add "[Based on N observations]" citations to all insights

#### 1.2.2 AI Response Post-Processing
- [ ] **File**: `src/services/ai.ts`
- [ ] Add validation layer after AI response received
- [ ] Inject computed statistics into AI prompt for grounding
- [ ] Add disclaimer if validation fails: "AI insight could not be verified"
- [ ] Log validation failures for debugging

### 1.3 Storage Health & Migration Prep

#### 1.3.1 Storage Monitoring
- [ ] **File**: `src/utils/storageHealth.ts` (new file)
- [ ] Implement `getStorageUsage()` - estimate localStorage usage
- [ ] Implement `getStorageLimit()` - detect available quota
- [ ] Add `StorageHealthIndicator` component showing usage bar
- [ ] Warning at 70% capacity, critical at 90%
- [ ] Add to Settings page

#### 1.3.2 Data Integrity Validation
- [ ] **File**: `src/utils/dataValidation.ts` (new file)
- [ ] Implement `validateLogEntry(entry: LogEntry)` with rules:
  - Timestamp in valid range (not future, not > 1 year old)
  - Arousal/valence/energy within 1-10
  - Required fields present
- [ ] Implement `detectSuspiciousPatterns(logs: LogEntry[])`:
  - Multiple identical entries in < 5 minutes
  - All values identical across 10+ entries
  - Impossible timestamps
- [ ] Add confirmation dialog for extreme values (arousal 10, energy 1)
- [ ] Add bulk-edit/delete UI for data cleaning

---

## Phase 2: UX Overhaul (Reduce Friction)

**Goal**: Make the app usable during actual stressful parenting moments.

### 2.1 Quick Log Mode

#### 2.1.1 Traffic Light Quick Entry
- [ ] **File**: `src/components/QuickLog.tsx` (new file)
- [ ] Create 3-button interface: 🟢 Good / 🟡 Struggling / 🔴 Crisis
- [ ] Auto-capture: timestamp, day of week, time of day
- [ ] Auto-detect context from time (school hours = school, else = home)
- [ ] Map traffic light to arousal ranges:
  - 🟢 = arousal 1-3, valence 7-10, energy 6-10
  - 🟡 = arousal 4-6, valence 4-6, energy 3-6
  - 🔴 = arousal 7-10, valence 1-3, energy 1-3
- [ ] "Add details" expandable section (optional)
- [ ] Haptic feedback on tap (navigator.vibrate)

#### 2.1.2 Smart Defaults
- [ ] **File**: `src/components/LogEntryForm.tsx`
- [ ] Pre-fill most common triggers from history
- [ ] Pre-fill most effective strategies from history
- [ ] Remember last context (home/school) as default
- [ ] Time-based defaults (morning arousal typically X)

#### 2.1.3 Batch Detail Entry
- [ ] **File**: `src/components/LogHistory.tsx` (new or enhanced)
- [ ] Show recent quick logs with "Add details" button
- [ ] Allow editing triggers/strategies after the fact
- [ ] "End of day review" prompt to enrich quick logs
- [ ] Swipe gestures for quick editing

### 2.2 Crisis Mode Redesign

#### 2.2.1 One-Tap Crisis Start
- [ ] **File**: `src/components/CrisisMode.tsx`
- [ ] Replace current UI with single large "CRISIS STARTED" button
- [ ] Auto-start timer on tap
- [ ] Auto-capture pre-crisis state from most recent log
- [ ] Minimal UI during crisis: just timer + "Crisis Ended" button
- [ ] Optional: Start audio recording automatically (with permission)

#### 2.2.2 Post-Crisis Guided Reflection
- [ ] **File**: `src/components/PostCrisisReflection.tsx` (new file)
- [ ] Trigger 30 minutes after crisis ends (or manual)
- [ ] Step-by-step wizard (not all fields at once):
  1. "What type of crisis?" (meltdown/shutdown/anxiety/sensory)
  2. "What triggered it?" (smart suggestions from history)
  3. "What helped?" (strategy checklist)
  4. "How long to recover?" (slider or "still recovering")
- [ ] Save partial progress if interrupted
- [ ] Calm, supportive UI tone

#### 2.2.3 Crisis Quick Actions
- [ ] **File**: `src/components/CrisisQuickActions.tsx` (new file)
- [ ] During crisis, show: "Strategies that worked before"
- [ ] One-tap to mark strategy as "trying now"
- [ ] Post-crisis: "Did [strategy] help?" quick feedback

### 2.3 Onboarding Redesign

#### 2.3.1 Skip-First Experience
- [ ] **File**: `src/components/onboarding/` (refactor)
- [ ] Load app with demo data showing "after 1 week" insights
- [ ] "This is what your dashboard will look like" overlay
- [ ] "Start tracking" button goes directly to Quick Log
- [ ] Collect profile data progressively over first week

#### 2.3.2 Progressive Profile Collection
- [ ] **File**: `src/components/ProfilePrompts.tsx` (new file)
- [ ] After 3 logs: "What's your child's name?" (optional)
- [ ] After 5 logs: "Any diagnoses we should know about?"
- [ ] After 10 logs: "What strategies have worked before?"
- [ ] Never block app usage for profile completion

#### 2.3.3 First Insight Celebration
- [ ] **File**: `src/components/InsightUnlocked.tsx` (new file)
- [ ] After 5 entries: "🎉 Your first pattern detected!"
- [ ] Show one concrete insight with explanation
- [ ] "Keep logging to discover more patterns"
- [ ] Gamification: insight unlock milestones (5, 10, 25, 50 logs)

### 2.4 Simplified Insights Display

#### 2.4.1 Plain Language Summaries
- [ ] **File**: `src/components/InsightsSummary.tsx` (new file)
- [ ] Replace heatmap with: "Your child struggles most on: Monday mornings, Friday afternoons"
- [ ] Top 3 triggers in plain text, not charts
- [ ] Top 3 effective strategies with success rate
- [ ] "This week vs last week" simple comparison

#### 2.4.2 Heatmap as Advanced View
- [ ] **File**: `src/components/DysregulationHeatmap.tsx`
- [ ] Move heatmap to "Advanced Analysis" section
- [ ] Add "What am I looking at?" explanation overlay
- [ ] Add tutorial on first view
- [ ] Keep for therapist/professional use

---

## Phase 3: Missing Core Features

**Goal**: Add features essential for real-world neurodivergent family use.

### 3.1 School Documentation & IEP Support

#### 3.1.1 Professional PDF Reports
- [ ] **File**: `src/services/pdfReports.ts` (enhance existing)
- [ ] Create "IEP Evidence Packet" template:
  - Executive summary (1 page)
  - Trigger frequency table with dates
  - Pattern analysis with statistical backing
  - Strategy effectiveness rankings
  - Crisis event log with details
  - Progress toward goals (if tracked)
- [ ] School-friendly formatting (formal tone, no jargon)
- [ ] Date range selector for report period
- [ ] Include "Prepared for [School Name]" customization

#### 3.1.2 Communication Cards
- [ ] **File**: `src/components/CommunicationCard.tsx` (new file)
- [ ] Generate printable 1-page "About [Child]" card:
  - Photo placeholder
  - Key triggers to avoid
  - Calming strategies that work
  - Warning signs of escalation
  - Emergency contact
- [ ] PDF export for printing
- [ ] QR code linking to detailed profile (optional)

#### 3.1.3 Accommodation Request Generator
- [ ] **File**: `src/components/AccommodationLetter.tsx` (new file)
- [ ] Template letter requesting specific accommodations
- [ ] Auto-fill based on tracked patterns:
  - "Data shows 73% of crises occur during transitions"
  - "Recommend: 5-minute warning before activity changes"
- [ ] Editable before export
- [ ] Multiple formats: email draft, formal letter, bullet points

### 3.2 Proactive Notifications

#### 3.2.1 Push Notification System
- [ ] **File**: `src/services/notifications.ts` (new file)
- [ ] Request notification permission (with explanation)
- [ ] Service worker notification scheduling
- [ ] Store notification preferences in Settings

#### 3.2.2 Risk Window Alerts
- [ ] **File**: `src/services/riskAlerts.ts` (new file)
- [ ] Calculate next 24h risk windows from predictions
- [ ] Schedule notification before high-risk periods:
  - "Tomorrow 3pm: High risk window detected"
  - "Consider: quiet time after school"
- [ ] Evening summary: "Tomorrow's predicted challenging times"
- [ ] Configurable alert threshold (only alert if risk > X%)

#### 3.2.3 Logging Reminders
- [ ] **File**: `src/services/loggingReminders.ts` (new file)
- [ ] Gentle reminders if no log in X hours (configurable)
- [ ] Smart timing: not during detected crisis patterns
- [ ] "How is [Child] doing right now?" prompt
- [ ] Snooze/disable options

### 3.3 Additional Tracking Dimensions

#### 3.3.1 Medication Tracking
- [ ] **File**: `src/types.ts` - Add MedicationEntry interface
```typescript
interface MedicationEntry {
  id: string;
  timestamp: string;
  medication: string;
  dose: string;
  taken: boolean;
  notes?: string;
}
```
- [ ] **File**: `src/store/medication.tsx` (new context)
- [ ] **File**: `src/components/MedicationTracker.tsx` (new file)
- [ ] Daily medication checklist
- [ ] Correlation analysis: arousal patterns vs medication timing
- [ ] Missed dose tracking and alerts
- [ ] Do NOT send medication data to AI (privacy)

#### 3.3.2 Sleep Tracking
- [ ] **File**: `src/types.ts` - Add SleepEntry interface
```typescript
interface SleepEntry {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  quality: 1 | 2 | 3 | 4 | 5;
  nightWakings: number;
  notes?: string;
}
```
- [ ] **File**: `src/store/sleep.tsx` (new context)
- [ ] **File**: `src/components/SleepTracker.tsx` (new file)
- [ ] Simple sleep log: bedtime, wake time, quality
- [ ] Correlation: sleep quality vs next-day arousal
- [ ] "Poor sleep last night" warning on dashboard

#### 3.3.3 Voice Notes
- [ ] **File**: `src/components/VoiceNote.tsx` (new file)
- [ ] Quick audio recording during/after events
- [ ] Stored locally as blob in IndexedDB
- [ ] Playback in log history
- [ ] Optional: speech-to-text transcription (local only)
- [ ] Compress audio to minimize storage

#### 3.3.4 Photo Documentation
- [ ] **File**: `src/components/PhotoCapture.tsx` (new file)
- [ ] Attach photo to log entry (environment, trigger, etc.)
- [ ] Stored locally, compressed
- [ ] Gallery view in log history
- [ ] Privacy: photos never sent to AI or exported without consent

### 3.4 Multi-Child Support

#### 3.4.1 Child Profile Switcher
- [ ] **File**: `src/store/childProfiles.tsx` (enhance existing)
- [ ] Support multiple ChildProfile objects
- [ ] Profile switcher in header/settings
- [ ] Separate data stores per child (prefixed keys)
- [ ] Quick-switch between children

#### 3.4.2 Per-Child Data Isolation
- [ ] **File**: `src/constants/storage.ts`
- [ ] Update storage keys: `kreativium_${childId}_logs`
- [ ] Migration script for existing single-child data
- [ ] Ensure complete data isolation between profiles

### 3.5 Schedule Templates

#### 3.5.1 Routine Templates
- [ ] **File**: `src/components/ScheduleTemplates.tsx` (new file)
- [ ] Pre-built templates: "School Day", "Weekend", "Holiday"
- [ ] Import template to populate daily schedule
- [ ] Customizable templates saved locally
- [ ] Share templates via QR code (between caregivers)

#### 3.5.2 School Schedule Import
- [ ] **File**: `src/utils/scheduleImport.ts` (new file)
- [ ] Parse simple text/CSV format for class schedules
- [ ] Map to ScheduleEntry format
- [ ] Handle recurring events (every Monday, etc.)

---

## Phase 4: Storage & Performance

**Goal**: Prepare for long-term use and large datasets.

### 4.1 IndexedDB Migration

#### 4.1.1 IndexedDB Schema Design
- [ ] **File**: `src/services/database.ts` (new file)
- [ ] Design schema with object stores:
  - `logs` - LogEntry objects, indexed by timestamp, childId
  - `crises` - CrisisEvent objects
  - `schedules` - ScheduleEntry objects
  - `goals` - Goal objects
  - `profiles` - ChildProfile objects
  - `settings` - App settings
  - `media` - Audio/photo blobs
- [ ] Use Dexie.js wrapper for cleaner API
- [ ] Version management for schema migrations

#### 4.1.2 Migration Script
- [ ] **File**: `src/services/migration.ts` (new file)
- [ ] Detect existing localStorage data
- [ ] Copy all data to IndexedDB
- [ ] Verify migration integrity (count records)
- [ ] Keep localStorage backup for 30 days
- [ ] Clear localStorage after successful migration

#### 4.1.3 Update All Data Access
- [ ] **Files**: All store/*.tsx files
- [ ] Replace localStorage calls with IndexedDB operations
- [ ] Maintain same React Context API (transparent to components)
- [ ] Add async loading states where needed

### 4.2 Performance Optimization

#### 4.2.1 Lazy Load Heavy Components
- [ ] **File**: `src/App.tsx`
- [ ] Ensure Three.js only loads on heatmap route
- [ ] Lazy load PDF generation only when exporting
- [ ] Lazy load audio recording components

#### 4.2.2 Data Pagination
- [ ] **File**: `src/components/LogHistory.tsx`
- [ ] Load logs in batches of 50
- [ ] Infinite scroll or "Load more" button
- [ ] Virtual scrolling for very long lists (react-window)

#### 4.2.3 Analysis Caching
- [ ] **File**: `src/utils/analysisCache.ts` (new file)
- [ ] Cache computed statistics (not just AI responses)
- [ ] Invalidate on new log entry
- [ ] Background recalculation on data change

### 4.3 Bundle Optimization

#### 4.3.1 Remove Unused WebLLM Bundle
- [ ] **File**: `vite.config.ts`
- [ ] Remove @mlc-ai/web-llm from main bundle
- [ ] Create separate chunk loaded only when local AI enabled
- [ ] Reduce initial bundle by ~5.5MB

#### 4.3.2 Dynamic AI Model Loading
- [ ] **File**: `src/services/localModel.ts`
- [ ] Download Kreativium 27B only when user opts in
- [ ] Show download progress (model is large)
- [ ] Store model in IndexedDB/Cache API
- [ ] Graceful fallback if download fails

---

## Phase 5: Local AI Transition

**Goal**: Replace OpenRouter API with fully local Kreativium 27B inference.

### 5.1 Kreativium 27B Integration

#### 5.1.1 Model Selection & Quantization
- [ ] Research Kreativium 27B quantization options (Q4, Q8)
- [ ] Test model size vs quality tradeoffs
- [ ] Target: < 2GB download for mobile viability
- [ ] Benchmark inference speed on mid-range Android

#### 5.1.2 WebLLM/Transformers.js Setup
- [ ] **File**: `src/services/localAI.ts` (new file)
- [ ] Choose runtime: WebLLM vs Transformers.js vs llama.cpp WASM
- [ ] Implement model loading with progress callback
- [ ] Implement inference with streaming support
- [ ] Memory management (unload when not in use)

#### 5.1.3 Prompt Engineering for Local Model
- [ ] **File**: `src/services/localPrompts.ts` (new file)
- [ ] Optimize prompts for smaller model capabilities
- [ ] Shorter, more structured prompts
- [ ] Few-shot examples for behavioral analysis
- [ ] Test and iterate on response quality

#### 5.1.4 Hybrid AI Strategy
- [ ] **File**: `src/services/aiRouter.ts` (new file)
- [ ] Default: Local Kreativium 27B
- [ ] Fallback: OpenRouter API (if user has key)
- [ ] User setting: "Always use local" / "Use cloud if available"
- [ ] Seamless switching based on availability

### 5.2 Local AI UX

#### 5.2.1 Model Download Flow
- [ ] **File**: `src/components/LocalAISetup.tsx` (new file)
- [ ] Explain benefits of local AI (privacy, offline, no cost)
- [ ] Show model size and estimated download time
- [ ] Download progress with pause/resume
- [ ] "Download on WiFi only" option
- [ ] Storage space check before download

#### 5.2.2 Inference Feedback
- [ ] **File**: `src/components/AIThinking.tsx` (new file)
- [ ] Show "Analyzing locally..." with spinner
- [ ] Progress indicator for long analyses
- [ ] "This may take 30-60 seconds on this device"
- [ ] Option to cancel long-running inference

#### 5.2.3 Offline Indicator
- [ ] **File**: `src/components/OfflineIndicator.tsx` (new file)
- [ ] Show when device is offline
- [ ] Confirm local AI is available
- [ ] "Full functionality available offline"

### 5.3 Norwegian Language Optimization

#### 5.3.1 Norwegian Prompt Templates
- [ ] **File**: `src/services/norwegianPrompts.ts` (new file)
- [ ] All AI prompts in Norwegian (primary language)
- [ ] Neurodivergent-specific Norwegian terminology
- [ ] Cultural context for Norwegian school system

#### 5.3.2 Response Validation in Norwegian
- [ ] **File**: `src/services/aiValidation.ts`
- [ ] Update validation to handle Norwegian responses
- [ ] Norwegian number formats, date formats
- [ ] Norwegian-specific pattern matching

---

## Phase 6: Collaboration & Sharing

**Goal**: Enable data sharing between caregivers without cloud infrastructure.

### 6.1 Local Data Sharing

#### 6.1.1 QR Code Export/Import
- [ ] **File**: `src/components/QRShare.tsx` (new file)
- [ ] Generate QR code containing encrypted data subset
- [ ] Scan QR to import data from another device
- [ ] Compression for larger datasets (chunked QR codes)
- [ ] End-to-end encryption with user-defined password

#### 6.1.2 File-Based Sharing
- [ ] **File**: `src/utils/secureExport.ts` (new file)
- [ ] Export encrypted JSON file
- [ ] Import with password decryption
- [ ] Merge imported data with existing (conflict resolution)
- [ ] Share via any file transfer method (AirDrop, email, etc.)

#### 6.1.3 Selective Sharing
- [ ] **File**: `src/components/ShareSelector.tsx` (new file)
- [ ] Choose what to share: all data, date range, specific types
- [ ] Privacy preview: "This will share X logs, Y crises"
- [ ] Redact sensitive fields option (notes, audio)

### 6.2 Caregiver Roles (Local Only)

#### 6.2.1 Profile Access Levels
- [ ] **File**: `src/types.ts` - Add Caregiver interface
- [ ] Define roles: primary, secondary, professional
- [ ] Professional role: read-only, anonymized option
- [ ] Store roles locally (no authentication)

#### 6.2.2 Sync Conflict Resolution
- [ ] **File**: `src/utils/dataMerge.ts` (new file)
- [ ] When importing, detect conflicts (same timestamp, different data)
- [ ] UI to resolve: keep mine, keep theirs, keep both
- [ ] Automatic merge for non-conflicting data

---

## Phase 7: Quality & Polish

**Goal**: Production-ready quality and accessibility.

### 7.1 Testing & Validation

#### 7.1.1 Increase Test Coverage to 80%
- [ ] Unit tests for all utility functions
- [ ] Integration tests for data flows
- [ ] Component tests for critical UI paths
- [ ] E2E tests for key user journeys

#### 7.1.2 Statistical Validation Suite
- [ ] **File**: `src/test/statisticalValidation.test.ts` (new file)
- [ ] Test FDR correction against known datasets
- [ ] Test chi-squared calculation accuracy
- [ ] Test confidence interval coverage
- [ ] Calibration tests for predictions

#### 7.1.3 Accessibility Audit
- [ ] WCAG 2.1 AA compliance check
- [ ] Screen reader testing (TalkBack on Android)
- [ ] Keyboard navigation complete
- [ ] Color contrast verification
- [ ] Motion reduction respect

### 7.2 Error Handling & Recovery

#### 7.2.1 Graceful Degradation
- [ ] App works without AI (statistical insights only)
- [ ] App works without notifications permission
- [ ] App works without camera/microphone
- [ ] Clear messaging when features unavailable

#### 7.2.2 Data Recovery
- [ ] **File**: `src/services/backup.ts` (new file)
- [ ] Automatic daily backup to separate IndexedDB store
- [ ] "Restore from backup" in Settings
- [ ] Export backup to file for safekeeping

### 7.3 Onboarding & Help

#### 7.3.1 In-App Tutorial
- [ ] First-run tutorial overlay for key screens
- [ ] "?" help button on complex features
- [ ] Video tutorials (embedded, not streaming)
- [ ] FAQ section in Settings

#### 7.3.2 Tooltips & Explanations
- [ ] Explain what each metric means on hover/tap
- [ ] "What does this insight mean?" expandable
- [ ] Link to relevant resources (external)

---

## Implementation Priority Matrix

### Must Have (MVP)
| Item | Phase | Effort | Impact |
|------|-------|--------|--------|
| Statistical fixes (1.1.1, 1.1.2) | 1 | Medium | Critical |
| Quick Log Mode (2.1.1) | 2 | Medium | Critical |
| Crisis Mode Redesign (2.2.1, 2.2.2) | 2 | Medium | High |
| Storage Monitoring (1.3.1) | 1 | Low | High |
| AI Validation (1.2.1) | 1 | Medium | High |

### Should Have (v1.0)
| Item | Phase | Effort | Impact |
|------|-------|--------|--------|
| PDF Reports for IEP (3.1.1) | 3 | Medium | High |
| IndexedDB Migration (4.1) | 4 | High | High |
| Push Notifications (3.2.1) | 3 | Medium | Medium |
| Sleep Tracking (3.3.2) | 3 | Low | Medium |
| Medication Tracking (3.3.1) | 3 | Medium | Medium |

### Nice to Have (v1.x)
| Item | Phase | Effort | Impact |
|------|-------|--------|--------|
| Local Kreativium 27B (5.1) | 5 | High | High |
| Multi-Child Support (3.4) | 3 | Medium | Medium |
| QR Data Sharing (6.1.1) | 6 | Medium | Medium |
| Voice Notes (3.3.3) | 3 | Medium | Low |
| Photo Documentation (3.3.4) | 3 | Medium | Low |

---

## Technical Debt to Address

### Code Quality
- [ ] Extract magic numbers to constants (partially done)
- [ ] Consistent error handling across services
- [ ] Remove dead code paths
- [ ] Standardize async patterns

### Architecture
- [ ] Separate UI components from business logic
- [ ] Create proper service layer abstraction
- [ ] Implement proper TypeScript strict mode
- [ ] Add error boundaries to all routes

### Documentation
- [ ] API documentation for all services
- [ ] Component storybook for UI library
- [ ] Architecture decision records (ADRs)
- [ ] User documentation / help content

---

## Success Metrics

### User Engagement
- [ ] Average logs per user per week > 10
- [ ] Crisis logging completion rate > 80%
- [ ] Return user rate after 1 week > 60%

### Data Quality
- [ ] Statistical false positive rate < 5%
- [ ] Prediction calibration error < 10%
- [ ] User-reported insight accuracy > 70%

### Technical
- [ ] Initial load time < 3 seconds (3G)
- [ ] Time to interactive < 5 seconds
- [ ] Offline functionality 100%
- [ ] Crash rate < 0.1%

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Kreativium 27B too slow on mobile | Medium | High | Benchmark early, have cloud fallback |
| IndexedDB migration data loss | Low | Critical | Backup before migration, verification |
| Statistical fixes break existing insights | Medium | Medium | A/B test, gradual rollout |
| Storage limits hit before migration | Medium | High | Implement monitoring first (Phase 1) |
| User adoption of quick log low | Low | Medium | User testing, iterate on UX |

---

## Appendix: File Change Summary

### New Files to Create
```
src/components/
  QuickLog.tsx
  PostCrisisReflection.tsx
  CrisisQuickActions.tsx
  ProfilePrompts.tsx
  InsightUnlocked.tsx
  InsightsSummary.tsx
  CommunicationCard.tsx
  AccommodationLetter.tsx
  MedicationTracker.tsx
  SleepTracker.tsx
  VoiceNote.tsx
  PhotoCapture.tsx
  ScheduleTemplates.tsx
  LocalAISetup.tsx
  AIThinking.tsx
  OfflineIndicator.tsx
  QRShare.tsx
  ShareSelector.tsx

src/services/
  aiValidation.ts
  notifications.ts
  riskAlerts.ts
  loggingReminders.ts
  database.ts (IndexedDB)
  migration.ts
  localAI.ts
  localPrompts.ts
  norwegianPrompts.ts
  aiRouter.ts
  backup.ts

src/utils/
  statistics.ts
  storageHealth.ts
  dataValidation.ts
  analysisCache.ts
  scheduleImport.ts
  secureExport.ts
  dataMerge.ts

src/store/
  medication.tsx
  sleep.tsx
```

### Files to Significantly Modify
```
src/components/CrisisMode.tsx - Simplify for actual crisis use
src/components/LogEntryForm.tsx - Add smart defaults
src/components/onboarding/* - Progressive collection
src/services/ai.ts - Add validation layer
src/services/pdfReports.ts - IEP templates
src/utils/multiFactorAnalysis.ts - Statistical fixes
src/utils/predictions.ts - Personalized thresholds
src/store/*.tsx - IndexedDB migration
src/App.tsx - New routes
```

---

## Version Milestones

### v0.9 (Current → MVP)
- Phase 1 complete (statistical fixes, validation)
- Phase 2.1 complete (quick log mode)
- Phase 2.2 complete (crisis mode redesign)

### v1.0 (Production Ready)
- Phase 3.1 complete (IEP documentation)
- Phase 3.2 complete (notifications)
- Phase 4.1 complete (IndexedDB)
- 80% test coverage

### v1.5 (Enhanced)
- Phase 3.3 complete (medication, sleep tracking)
- Phase 5 complete (local Kreativium 27B)
- Phase 6 complete (caregiver sharing)

### v2.0 (Full Featured)
- Phase 7 complete (polish, accessibility)
- Native Android wrapper (Capacitor/TWA)
- App store release
