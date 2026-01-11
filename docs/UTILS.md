# NeuroLogg Pro - Utility Functions Reference

## Overview

The `src/utils/` directory contains analysis utilities, data validation, and helper functions. These utilities power the app's behavioral insights features.

---

## Table of Contents

1. [Risk Prediction](#risk-prediction)
2. [Transition Analysis](#transition-analysis)
3. [Data Export/Import](#data-exportimport)
4. [Validation](#validation)
5. [Analysis Configuration](#analysis-configuration)
6. [Date Utilities](#date-utilities)
7. [UUID Generation](#uuid-generation)

---

## Risk Prediction

### `src/utils/predictions.ts`

Calculates risk forecasts based on historical patterns with recency weighting.

#### `calculateRiskForecast()`

Predicts risk level for the current moment based on historical data patterns.

```typescript
import { calculateRiskForecast } from './utils/predictions';

const forecast = calculateRiskForecast(logs, {
  historyDays: 30,           // Days of data to analyze
  highArousalThreshold: 7,   // Arousal >= this = high arousal
  recencyDecayHalfLife: 7,   // Recent data weights more
});
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `logs` | `LogEntry[]` | Yes | Historical log entries |
| `config` | `Partial<RiskPredictionConfig>` | No | Override default settings |

**Returns:** `RiskForecast`

```typescript
interface RiskForecast {
  level: 'low' | 'moderate' | 'high';
  score: number;                    // 0-100 (capped)
  contributingFactors: RiskFactor[];
  predictedHighArousalTime?: string; // "14:00 - 16:00"
  rawScore?: number;                // Uncapped score
  confidence?: 'low' | 'medium' | 'high';
  sampleSize?: number;
  recencyWeightedScore?: number;
  peakTimeMinutes?: number;         // Minutes since midnight
  hourlyRiskDistribution?: HourlyRisk[];
}
```

**Algorithm:**
1. Filter logs from the configured history window (default: 30 days)
2. Filter for same day of week (e.g., all past Tuesdays)
3. Apply exponential decay weighting (recent data matters more)
4. Analyze time-of-day patterns for high arousal events
5. Boost score if entering a known risk time window

**Example Output:**
```typescript
{
  level: 'moderate',
  score: 45,
  contributingFactors: [
    { key: 'risk.factors.highStressTime', params: { timeRange: '14:00-15:00' } }
  ],
  predictedHighArousalTime: '14:00 - 15:00',
  confidence: 'medium',
  sampleSize: 12
}
```

---

## Transition Analysis

### `src/utils/transitionAnalysis.ts`

Analyzes activity transition difficulty patterns with statistical trend detection.

#### `calculateTransitionStats()`

Calculates comprehensive transition statistics from schedule entries.

```typescript
import { calculateTransitionStats } from './utils/transitionAnalysis';

const stats = calculateTransitionStats(scheduleEntries, {
  minSamplesForTrend: 6,
  trendSignificanceThreshold: 0.5,
});
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entries` | `ScheduleEntry[]` | Yes | Schedule entries with transition data |
| `config` | `Partial<TransitionAnalysisConfig>` | No | Override defaults |

**Returns:** `TransitionAnalysisResult`

```typescript
interface TransitionAnalysisResult {
  overallAvgDifficulty: number;
  totalTransitions: number;
  hardestTransitions: TransitionStat[];
  easiestTransitions: TransitionStat[];
  effectiveSupports: {
    strategy: string;
    usageCount: number;
    avgDifficultyWhenUsed: number;
  }[];
  recentDifficulties: { date: string; difficulty: number }[];
  confidenceWarning?: string;
  weeklySummary?: WeeklySummary[];
  monthlySummary?: MonthlySummary[];
  dataWindowStart?: string;
  dataWindowEnd?: string;
}

interface TransitionStat {
  activityName: string;
  avgDifficulty: number;
  count: number;
  trend: 'improving' | 'worsening' | 'stable';
  history: { date: string; difficulty: number }[];
  trendConfidence?: 'low' | 'medium' | 'high';
  standardDeviation?: number;
  trendPValue?: number;
}
```

**Statistical Features:**
- Uses Welch's t-test for trend significance (p < 0.05)
- Calculates standard deviation for variability analysis
- Provides confidence levels based on sample size
- Aggregates weekly and monthly summaries

---

## Data Export/Import

### `src/utils/exportData.ts`

Handles full data export and import with validation and atomic rollback.

#### `exportAllData()`

Exports all app data to a structured object.

```typescript
import { exportAllData, downloadExport } from './utils/exportData';

// Get data object
const data = exportAllData();

// Or download as JSON file
downloadExport(); // Downloads kreativium-backup-YYYY-MM-DD.json
```

**Returns:** `ExportedData`

```typescript
interface ExportedData {
  version: string;
  exportedAt: string;
  logs: LogEntry[];
  crisisEvents: CrisisEvent[];
  scheduleEntries: ScheduleEntry[];
  scheduleTemplates: DailyScheduleTemplate[];
  goals: Goal[];
  childProfile: ChildProfile | null;
  dailySchedules?: Record<string, DailyScheduleActivity[]>;
  summary: {
    totalLogs: number;
    totalCrisisEvents: number;
    averageCrisisDuration: number;
    scheduleCompletionRate: number;
    goalProgress: number;
    dateRange: { start: string; end: string } | null;
  };
}
```

#### `importData()`

Imports data from a backup file with validation and atomic rollback.

```typescript
import { importData } from './utils/exportData';

// Replace all existing data
const result = importData(jsonString, 'replace');

// Merge with existing data (skip duplicates by ID)
const result = importData(jsonString, 'merge');
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `jsonString` | `string` | Yes | JSON string from backup file |
| `mergeMode` | `'replace' \| 'merge'` | No | Import strategy (default: 'replace') |

**Returns:** `ImportResult`

```typescript
interface ImportResult {
  success: boolean;
  error?: string;
  validationErrors?: ValidationError[];
  imported?: {
    logs: number;
    crisisEvents: number;
    scheduleEntries: number;
    scheduleTemplates: number;
    goals: number;
    childProfile: boolean;
    dailySchedules: number;
  };
  merged?: {
    logsAdded: number;
    logsSkipped: number;
    crisisAdded: number;
    crisisSkipped: number;
    goalsAdded: number;
    goalsSkipped: number;
  };
}
```

**Safety Features:**
- Creates backup before any writes
- Validates all data with Zod schemas
- Atomic rollback on any failure
- Handles localStorage quota errors

---

## Validation

### `src/utils/validation.ts`

Zod schemas and validation functions for runtime type checking.

#### Schemas

| Schema | Description |
|--------|-------------|
| `LogEntrySchema` | Full log entry validation |
| `LogEntryInputSchema` | Log creation (without computed fields) |
| `CrisisEventSchema` | Crisis event validation |
| `ScheduleEntrySchema` | Schedule entry validation |
| `GoalSchema` | Goal validation |
| `ChildProfileSchema` | Child profile validation |
| `AnalysisResultSchema` | AI analysis result validation |

#### `validateLogEntry()`

Validates a log entry.

```typescript
import { validateLogEntry } from './utils/validation';

const result = validateLogEntry(data);
if (result.success) {
  // result.data is typed LogEntry
} else {
  // result.errors is string[] of validation messages
}
```

#### `validateLogEntryInput()`

Validates log entry input (for form submission).

```typescript
import { validateLogEntryInput } from './utils/validation';

const result = validateLogEntryInput(formData);
// Omits dayOfWeek, timeOfDay, hourOfDay (computed server-side)
```

#### `validateCrisisEvent()`

Validates a crisis event.

```typescript
import { validateCrisisEvent } from './utils/validation';

const result = validateCrisisEvent(data);
```

#### `validateImportedData()`

Validates imported backup data structure.

```typescript
import { validateImportedData } from './utils/validation';

const result = validateImportedData(parsedJson);
```

---

## Analysis Configuration

### `src/utils/analysisConfig.ts`

Centralized configuration for all analysis utilities.

#### Risk Prediction Config

```typescript
interface RiskPredictionConfig {
  minSamplesForPrediction: number;  // Default: 5
  minIncidentsForPattern: number;   // Default: 2
  hoursAheadWindow: number;         // Default: 4
  riskZoneBoost: number;            // Default: 30
  highRiskThreshold: number;        // Default: 60
  moderateRiskThreshold: number;    // Default: 30
  historyDays: number;              // Default: 30
  recencyDecayHalfLife: number;     // Default: 7
  highArousalThreshold: number;     // Default: 7
}
```

#### Transition Analysis Config

```typescript
interface TransitionAnalysisConfig {
  minSamplesForTrend: number;           // Default: 6
  minSamplesForHighConfidence: number;  // Default: 12
  trendSignificanceThreshold: number;   // Default: 0.5
  maxHistoryEntries: number;            // Default: 90
  recentEntriesLimit: number;           // Default: 14
  topTransitionsLimit: number;          // Default: 5
}
```

#### Multi-Factor Analysis Config

```typescript
interface MultiFactorConfig {
  minOccurrencesForPattern: number;   // Default: 3
  minConfidenceThreshold: number;     // Default: 0.6 (60%)
  significanceLevel: number;          // Default: 0.05
  maxFactorsPerPattern: number;       // Default: 4
  energyThresholds: { low: 4, high: 7 };
  timeWindows: { beforeCrisis: 60, afterStrategy: 30 };
  minLogsForAnalysis: number;         // Default: 10
}
```

#### Recovery Analysis Config

```typescript
interface RecoveryAnalysisConfig {
  normalArousalThreshold: number;     // Default: 5
  normalEnergyThreshold: number;      // Default: 5
  maxRecoveryWindow: number;          // Default: 240 minutes
  minRecoveryDataPoints: number;      // Default: 3
  vulnerabilityWindowMinutes: number; // Default: 60
  minFactorSampleSize: number;        // Default: 3
}
```

#### Context Comparison Config

```typescript
interface ContextComparisonConfig {
  minLogsPerContext: number;              // Default: 5
  topTriggersLimit: number;               // Default: 5
  topStrategiesLimit: number;             // Default: 5
  significantDifferenceThreshold: number; // Default: 20%
  minSampleForStatisticalTest: number;    // Default: 10
}
```

#### Usage

```typescript
import {
  DEFAULT_RISK_CONFIG,
  DEFAULT_TRANSITION_CONFIG,
  DEFAULT_MULTI_FACTOR_CONFIG,
} from './utils/analysisConfig';

// Use defaults
const forecast = calculateRiskForecast(logs);

// Override specific values
const forecast = calculateRiskForecast(logs, {
  ...DEFAULT_RISK_CONFIG,
  historyDays: 60,
  highArousalThreshold: 8,
});
```

---

## Date Utilities

### `src/utils/dateUtils.ts`

Date parsing, formatting, and time calculations.

#### `parseDate()`

Parses various date formats to Date object.

```typescript
import { parseDate } from './utils/dateUtils';

const date = parseDate('2025-01-11');
const date = parseDate('2025-01-11T14:30:00Z');
```

#### `formatRelativeTime()`

Formats date as relative time string.

```typescript
import { formatRelativeTime } from './utils/dateUtils';

formatRelativeTime(date); // "2 hours ago", "yesterday", etc.
```

---

## UUID Generation

### `src/utils/uuid.ts`

UUID generation with browser fallbacks.

#### `generateUUID()`

Generates a UUID v4 with graceful fallbacks.

```typescript
import { generateUUID } from './utils/uuid';

const id = generateUUID(); // Uses crypto.randomUUID() if available
```

**Fallback Chain:**
1. `crypto.randomUUID()` (modern browsers)
2. `crypto.getRandomValues()` (older browsers)
3. `Math.random()` (legacy fallback)

---

## Best Practices

### Error Handling

All analysis functions handle edge cases gracefully:

```typescript
// Empty data returns safe defaults
const forecast = calculateRiskForecast([]);
// Returns: { level: 'low', score: 0, contributingFactors: [] }

// Insufficient data is flagged
const stats = calculateTransitionStats(fewEntries);
// Returns: { confidenceWarning: 'Only 3 data points...' }
```

### Performance

- Analysis functions are memoized via React hooks
- Results are cached with configurable TTL
- Large datasets are handled efficiently with early termination

### Configuration

Override defaults only when needed:

```typescript
// Good: Override specific values
calculateRiskForecast(logs, { highArousalThreshold: 8 });

// Avoid: Overriding all values unless necessary
calculateRiskForecast(logs, {
  minSamplesForPrediction: 5,
  minIncidentsForPattern: 2,
  // ... all other values
});
```
