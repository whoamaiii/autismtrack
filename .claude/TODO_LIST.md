# Code Review Fixes - Todo List

Last updated: 2026-01-11

## High Priority

- [x] **Fix division by zero in goal progress calculation**
  - File: `src/utils/exportData.ts:164-174`
  - Added clarifying comment for `range <= 0` edge case

- [x] **Fix unbounded cache growth**
  - File: `src/services/aiCommon.ts:282-299`
  - Now enforces max cache size after cleaning expired entries

## Medium Priority

- [x] **Standardize UUID usage on `crypto.randomUUID()`**
  - [x] `src/components/VisualSchedule.tsx`
  - [x] `src/components/CrisisMode.tsx`
  - [x] `src/components/LogEntryForm.tsx`
  - [x] `src/components/GoalTracking.tsx`
  - [x] `src/store/childProfile.tsx` (already using generateUUID)

- [x] **Add ARIA attributes to CrisisMode slider**
  - File: `src/components/CrisisMode.tsx:637-654`
  - Added aria-valuemin, aria-valuemax, aria-valuenow, aria-describedby

- [x] **Fix color-only arousal indicators**
  - File: `src/components/Analysis.tsx:154-159, 283-289`
  - Added getArousalLabel helper + aria-label with level description

## Low Priority

- [x] **Fix misleading comment in gemini.ts**
  - File: `src/services/gemini.ts:44-46`
  - Updated comment to match MODEL_ID (Gemini 2.0 Flash)

- [x] **Extract magic numbers to constants**
  - File: `src/utils/predictions.ts:12-14`
  - Added HOURS_PER_DAY, MS_PER_DAY, MINUTES_PER_DAY constants
  - Replaced 6 occurrences of magic `24` with HOURS_PER_DAY

---

## Completion Log

| Task | Status | Date | Notes |
|------|--------|------|-------|
| Division by zero fix | Completed | 2026-01-11 | Added clarifying comment |
| Cache growth fix | Completed | 2026-01-11 | Added second pass to remove oldest entries |
| UUID standardization | Completed | 2026-01-11 | 4 files updated to crypto.randomUUID() |
| ARIA slider attributes | Completed | 2026-01-11 | Peak intensity slider now accessible |
| Arousal indicators | Completed | 2026-01-11 | Added getArousalLabel + aria-label |
| Gemini comment | Completed | 2026-01-11 | Fixed model name in docstring |
| Magic numbers | Completed | 2026-01-11 | Extracted to named constants (6 replacements) |
| Verification | Completed | 2026-01-11 | Build OK, 483 tests passed |

## Verification Results

```
Build: ✓ Success (4.79s)
Tests: ✓ 483 passed, 5 skipped
```

---

# Prediction & Analysis Accuracy Improvements

## High-Impact Improvements (Significant Accuracy Gains)

### 1. Multiple Comparison Correction
- [ ] **File:** `src/utils/multiFactorAnalysis.ts`
- **Issue:** Testing 150+ pattern combinations inflates false positive rate (5% × 150 = ~7.5 expected false positives)
- **Fix:** Apply Bonferroni correction (`significanceLevel / numTests`) or Benjamini-Hochberg FDR
- **Impact:** Eliminates spurious patterns that appear significant by chance

### 2. Add Confidence Intervals to All Estimates
- [ ] **Files:** `src/utils/predictions.ts`, `src/utils/multiFactorAnalysis.ts`
- **Issue:** Point estimates (averages, percentages) shown without uncertainty bounds
- **Fix:** Calculate and display 95% CI using Wilson score interval for proportions, bootstrap for means
- **Impact:** Users see reliability of predictions; prevents overconfidence in small samples

### 3. Multi-Factor Risk Scoring
- [ ] **File:** `src/utils/predictions.ts`
- **Issue:** Risk only uses arousal + time; ignores energy, context, recent strategies
- **Fix:** Add weighted factors: `riskScore = f(arousal, energy, context, recentStrategySuccess, triggerPresence)`
- **Current gap:** Only `weightedHighArousalRate` is considered in risk calculation
- **Impact:** More accurate predictions by leveraging all tracked data

### 4. Personalized Thresholds
- [ ] **Files:** `src/utils/predictions.ts`, `src/utils/recoveryAnalysis.ts`
- **Issue:** Hard-coded thresholds (arousal >= 7, recovery arousal <= 5) don't adapt to individual baselines
- **Fix:** Calculate per-child percentile thresholds: `highArousal = P75(child's arousal)`, `recovery = P25(child's arousal)`
- **Impact:** More accurate for children with naturally higher/lower baseline arousal

### 5. Temporal Lag Effects
- [ ] **File:** `src/utils/predictions.ts`
- **Issue:** Only same-day patterns; misses "yesterday's dysregulation predicts today's risk"
- **Fix:** Add cross-day correlation: analyze arousal patterns 24h, 48h, 72h after high-arousal days
- **Impact:** Better next-day predictions; identifies cumulative stress effects

---

## Medium-Impact Improvements

### 6. Proper Statistical Tests
- [ ] **File:** `src/utils/multiFactorAnalysis.ts:140-145`
- **Issue:** P-value approximation `Math.exp(-chiSquared / 2)` is not statistically valid
- **Fix:** Use chi-squared CDF from proper calculation or lookup table
- **Impact:** Correct significance levels; no false positives from math errors

### 7. Adaptive Discretization
- [ ] **File:** `src/utils/multiFactorAnalysis.ts:25-40`
- **Issue:** Hard-coded buckets (energy < 4 = low) lose individual variance
- **Fix:** Use quantile-based binning: `low = bottom 33%`, `moderate = middle 33%`, `high = top 33%`
- **Impact:** Patterns reflect individual child's distribution, not arbitrary cutoffs

### 8. Interaction Effect Testing
- [ ] **File:** `src/utils/multiFactorAnalysis.ts`
- **Issue:** Factors tested independently; misses synergistic effects
- **Fix:** Explicitly test 2-way interactions: `energy×timeOfDay`, `context×trigger`, `transition×arousal`
- **Impact:** Discovers compound triggers (e.g., "low energy + afternoon" is worse than either alone)

### 9. Data-Driven Vulnerability Window
- [ ] **File:** `src/utils/recoveryAnalysis.ts`
- **Issue:** Fixed 60-minute vulnerability window is arbitrary
- **Fix:** Calculate from data: find time at which re-escalation probability drops below 10%
- **Impact:** Personalized warning periods; some children may need 30min, others 90min

### 10. Stratified Factor Analysis
- [ ] **File:** `src/utils/multiFactorAnalysis.ts`
- **Issue:** Patterns don't control for confounders (a trigger might only matter at school)
- **Fix:** Run analysis separately for home/school contexts; compare context-specific patterns
- **Impact:** Context-aware insights; avoids misleading aggregated patterns

---

## Lower-Impact but Valuable

### 11. Visualization Uncertainty
- [ ] **File:** `src/components/BehaviorInsights.tsx`
- **Issue:** Heatmap shows averages without variability; percentages lack confidence
- **Fix:** Add ± ranges, opacity/saturation for confidence, hover showing sample size
- **Impact:** Visual indication of data reliability

### 12. LLM Validation Layer
- [ ] **Files:** `src/services/ai.ts`, `src/services/gemini.ts`
- **Issue:** LLM conclusions not validated against statistical patterns
- **Fix:** Post-process LLM output to check claims match computed statistics
- **Impact:** Catches hallucinations; increases trust in AI insights

### 13. Proper Trend Detection
- [ ] **File:** `src/utils/recoveryAnalysis.ts`
- **Issue:** First-half vs second-half comparison is crude
- **Fix:** Use Mann-Kendall trend test or linear regression slope with significance
- **Impact:** Detects gradual trends, not just before/after changes

### 14. Multi-Modal Peak Detection
- [ ] **File:** `src/utils/predictions.ts`
- **Issue:** Single peak hour calculated; misses morning AND afternoon peaks
- **Fix:** Cluster high-arousal times; report multiple peak windows if distribution is bimodal
- **Impact:** Better scheduling; doesn't hide secondary risk periods

### 15. Outlier Detection
- [ ] **File:** New utility function needed
- **Issue:** No data quality validation; outliers skew all calculations
- **Fix:** Flag logs with: identical arousal every entry, impossible timestamps, missing context
- **Impact:** Cleaner data = more reliable patterns

---

## Validation & Testing Needs

### 16. Prediction Calibration Check
- [ ] **File:** `src/utils/predictions.ts`
- **Task:** Add function to compare predicted vs actual outcomes
- **Metric:** If we predict 70% risk, do crises happen ~70% of the time?
- **Impact:** Validates prediction accuracy; identifies systematic over/under-prediction

### 17. Cross-Validation for Patterns
- [ ] **File:** `src/utils/multiFactorAnalysis.ts`
- **Task:** Split data 80/20, train patterns on 80%, validate on 20%
- **Metric:** Do discovered patterns generalize to held-out data?
- **Impact:** Prevents overfitting to noise in small datasets

---

## Quick Wins (Can implement immediately)

### A. Increase Minimum Sample Requirements
- [ ] **Current:** 5 logs for prediction, 3 for pattern
- [ ] **Recommended:** 10 logs for prediction, 5 for pattern
- [ ] **Location:** `src/utils/analysisConfig.ts`
- [ ] **Why:** Reduces noise-driven false positives

### B. Add Sample Size to Pattern Display
- [ ] **File:** `src/components/BehaviorInsights.tsx`
- [ ] Show "Based on N observations" next to each pattern
- [ ] **Why:** Users can judge reliability themselves

### C. Decay Half-Life Configuration
- [ ] **File:** `src/utils/predictions.ts`
- [ ] Make `HALF_LIFE_DAYS = 7` configurable in settings
- [ ] **Why:** Some children have stable patterns (use 14d), others change weekly (use 3d)

---

## Implementation Priority Order

1. **#1 Multiple Comparison Correction** - Highest ROI, prevents false positives
2. **#3 Multi-Factor Risk Scoring** - Uses existing data for better predictions
3. **#6 Proper Statistical Tests** - Fixes mathematical correctness
4. **#4 Personalized Thresholds** - Adapts to individual children
5. **#2 Confidence Intervals** - Communicates uncertainty properly
6. **Quick Wins A, B, C** - Fast to implement, immediate benefit

---

## Architecture Notes

All analysis utilities are in `src/utils/`:
- `predictions.ts` - Risk prediction engine
- `multiFactorAnalysis.ts` - Pattern discovery
- `recoveryAnalysis.ts` - Post-crisis analysis
- `contextComparison.ts` - Home vs school comparison

Configuration lives in `src/utils/analysisConfig.ts` - adjust thresholds here.

Visualizations in `src/components/`:
- `BehaviorInsights.tsx` - Main analysis dashboard
- `Analysis.tsx` - Overview analysis
- `DysregulationHeatmap.tsx` - Temporal patterns
