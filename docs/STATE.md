# NeuroLogg Pro - State Management Documentation

## Overview

NeuroLogg Pro uses React Context for state management with localStorage persistence. All state is managed in `src/store/index.tsx` through the `DataProvider` component.

Each provider uses `createStorageSyncHandlers` from `src/store/storage.ts` to keep localStorage and multi-tab state in sync (including `STORAGE_REFRESH_EVENT` reloads).

---

## Architecture

```
DataProvider
├── AppContext          # Current context (home/school)
├── ChildProfileContext # Child profile data
├── SettingsContext     # App settings
├── LogsContext         # Emotion/arousal logs
├── CrisisContext       # Crisis events
├── ScheduleContext     # Daily schedules
└── GoalsContext        # IEP goal tracking
```

---

## Contexts & Hooks

### LogsContext

Manages emotion/arousal log entries.

```typescript
import { useLogs } from './store';

const {
  logs,                      // LogEntry[]
  addLog,                    // (log) => boolean
  updateLog,                 // (id, updates) => void
  deleteLog,                 // (id) => void
  getLogsByDateRange,        // (start, end) => LogEntry[]
  getLogsByContext,          // (context) => LogEntry[]
  getLogsNearTimestamp,      // (timestamp, windowMinutes) => LogEntry[]
  getLogsByContextAndDateRange // (context, start, end) => LogEntry[]
} = useLogs();
```

#### Adding a Log

```typescript
const success = addLog({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  context: 'school',
  arousal: 7,
  valence: 4,
  energy: 3,
  sensoryTriggers: ['Auditiv'],
  contextTriggers: ['Overgang'],
  strategies: ['Hodetelefoner'],
  strategyEffectiveness: 'helped',
  duration: 15,
  note: 'Difficult transition after lunch'
});

if (!success) {
  console.error('Validation failed');
}
```

#### Querying Logs

```typescript
// Last 7 days
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 7);
const recentLogs = getLogsByDateRange(weekAgo, new Date());

// School only
const schoolLogs = getLogsByContext('school');

// Near a timestamp
const nearby = getLogsNearTimestamp(crisisTimestamp, 30); // ±30 min
```

---

### CrisisContext

Manages crisis/meltdown events.

```typescript
import { useCrisis } from './store';

const {
  crisisEvents,              // CrisisEvent[]
  addCrisisEvent,            // (event) => boolean
  updateCrisisEvent,         // (id, updates) => void
  deleteCrisisEvent,         // (id) => void
  getCrisisByDateRange,      // (start, end) => CrisisEvent[]
  getAverageCrisisDuration,  // () => number (seconds)
  getCrisisCountByType,      // () => Record<string, number>
  getCrisisEventsByContext,  // (context) => CrisisEvent[]
  updateCrisisRecoveryTime   // (id, minutes) => void
} = useCrisis();
```

#### Adding a Crisis Event

```typescript
const success = addCrisisEvent({
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  context: 'school',
  type: 'meltdown',
  durationSeconds: 600,
  peakIntensity: 9,
  precedingArousal: 8,
  precedingEnergy: 2,
  warningSignsObserved: ['Økt motorisk uro', 'Dekker ører'],
  sensoryTriggers: ['Auditiv'],
  contextTriggers: ['Overgang'],
  strategiesUsed: ['Skjerming', 'Samregulering'],
  resolution: 'co_regulated',
  hasAudioRecording: false,
  notes: 'Fire alarm triggered meltdown'
});
```

#### Statistics

```typescript
// Average duration
const avgDuration = getAverageCrisisDuration(); // seconds

// Count by type
const byType = getCrisisCountByType();
// { meltdown: 5, shutdown: 2, anxiety: 3 }
```

---

### ScheduleContext

Manages daily schedules and templates.

```typescript
import { useSchedule } from './store';

const {
  scheduleEntries,      // ScheduleEntry[]
  scheduleTemplates,    // DailyScheduleTemplate[]
  addScheduleEntry,     // (entry) => void
  updateScheduleEntry,  // (id, updates) => void
  deleteScheduleEntry,  // (id) => void
  getEntriesByDate,     // (date: string) => ScheduleEntry[]
  addTemplate,          // (template) => void
  updateTemplate,       // (id, updates) => void
  deleteTemplate,       // (id) => void
  getCompletionRate     // (dateRange?) => number (0-100)
} = useSchedule();
```

#### Schedule Entry

```typescript
addScheduleEntry({
  id: crypto.randomUUID(),
  date: '2025-01-15',
  context: 'school',
  activity: {
    id: crypto.randomUUID(),
    title: 'Math Class',
    icon: '📐',
    scheduledStart: '09:00',
    scheduledEnd: '09:45',
    durationMinutes: 45
  },
  status: 'completed',
  actualStart: '09:00',
  actualEnd: '09:50',
  transitionDifficulty: 6,
  transitionSupport: ['Timer/Visuell Støtte']
});
```

---

### GoalsContext

Manages IEP goal tracking.

```typescript
import { useGoals } from './store';

const {
  goals,              // Goal[]
  addGoal,            // (goal) => void
  updateGoal,         // (id, updates) => void
  deleteGoal,         // (id) => void
  addGoalProgress,    // (goalId, progress) => void
  getGoalProgress,    // (goalId) => GoalProgress[]
  getOverallProgress  // () => number (0-100)
} = useGoals();
```

#### Goal with Progress Tracking

```typescript
// Add goal
addGoal({
  id: crypto.randomUUID(),
  title: 'Reduce meltdowns',
  description: 'Decrease weekly meltdowns from 5 to 2',
  category: 'regulation',
  targetValue: 2,
  targetUnit: 'times per week',
  targetDirection: 'decrease',
  startDate: '2025-01-01',
  targetDate: '2025-03-01',
  currentValue: 5,
  status: 'in_progress',
  progressHistory: []
});

// Log progress (auto-calculates status)
addGoalProgress(goalId, {
  date: new Date().toISOString(),
  value: 3,
  context: 'school',
  notes: 'Good week, only 3 meltdowns'
});
```

**Auto-Status Calculation:**
- `≥100%` → `achieved`
- `≥75%` → `on_track`
- `≥25%` → `in_progress` (or `at_risk` if deadline near)
- `<25%` near deadline → `at_risk`

---

### AppContext

Manages current context (home/school toggle).

```typescript
import { useAppContext } from './store';

const {
  currentContext,     // 'home' | 'school'
  setCurrentContext   // (context) => void
} = useAppContext();

// Toggle context
setCurrentContext(currentContext === 'home' ? 'school' : 'home');
```

---

### ChildProfileContext

Manages child profile for personalized AI analysis.

```typescript
import { useChildProfile } from './store';

const {
  childProfile,       // ChildProfile | null
  setChildProfile,    // (profile) => void
  updateChildProfile, // (updates) => void
  clearChildProfile   // () => void
} = useChildProfile();
```

#### Profile Structure

```typescript
interface ChildProfile {
  id: string;
  name: string;
  age?: number;
  diagnoses: string[];           // ['autism', 'adhd']
  communicationStyle: 'verbal' | 'limited_verbal' | 'non_verbal' | 'aac';
  sensorySensitivities: string[]; // ['Auditiv', 'Visuell']
  seekingSensory: string[];       // ['Vestibulær', 'Dypt Trykk']
  effectiveStrategies: string[];  // ['Hodetelefoner', 'Timer']
  additionalContext?: string;
  createdAt: string;
  updatedAt: string;
}
```

---

### SettingsContext

Manages app settings.

```typescript
import { useSettings } from './store';

const {
  hasCompletedOnboarding,  // boolean
  completeOnboarding,      // () => void
  refreshData              // () => void - reload from localStorage
} = useSettings();
```

---

## Data Persistence

### Storage Keys

All data persists to localStorage with `kreativium_*` prefix:

```typescript
const STORAGE_KEYS = {
  LOGS: 'kreativium_logs',
  CRISIS_EVENTS: 'kreativium_crisis_events',
  SCHEDULE_ENTRIES: 'kreativium_schedule_entries',
  SCHEDULE_TEMPLATES: 'kreativium_schedule_templates',
  GOALS: 'kreativium_goals',
  CURRENT_CONTEXT: 'kreativium_current_context',
  CHILD_PROFILE: 'kreativium_child_profile',
  ONBOARDING_COMPLETED: 'kreativium_onboarding_completed'
};
```

### Zod Validation

All data is validated on load using Zod schemas:

```typescript
// Invalid entries are filtered out, valid ones preserved
const logs = getStorageItem(
  STORAGE_KEYS.LOGS,
  [],
  z.array(LogEntrySchema)
);
```

### Quota Error Handling

```typescript
// Listen for storage quota errors
window.addEventListener('storage-quota-exceeded', (e) => {
  toast.error('Storage full! Consider exporting and clearing old data.');
});
```

---

## Multi-Tab Sync

State automatically syncs across browser tabs:

```typescript
// Tab 1: Add a log
addLog(newLog);

// Tab 2: Automatically receives the update via StorageEvent
// No manual refresh needed
```

---

## Data Enrichment

Logs and crisis events are automatically enriched with computed fields:

```typescript
// Input (minimal)
const log = {
  id: '...',
  timestamp: '2025-01-15T14:30:00Z',
  // ...
};

// After enrichLogEntry()
{
  ...log,
  dayOfWeek: 'wednesday',  // Computed
  timeOfDay: 'afternoon',  // Computed
  hourOfDay: 14            // Computed
}
```

---

## Data Export

Export all data for backup or LLM analysis:

```typescript
import { exportAllData } from './store';

const data = exportAllData();
// {
//   logs: LogEntry[],
//   crisisEvents: CrisisEvent[],
//   scheduleEntries: ScheduleEntry[],
//   goals: Goal[],
//   childProfile: ChildProfile | null,
//   exportedAt: string
// }

// Download as JSON
const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
```

---

## Performance Optimizations

### Memoized Context Values

All context values are memoized to prevent unnecessary re-renders:

```typescript
const logsValue = useMemo(() => ({
  logs,
  addLog,
  updateLog,
  // ...
}), [logs, addLog, updateLog /* deps */]);
```

### Lazy State Initialization

State loads from localStorage only once during initial render:

```typescript
const [logs, setLogs] = useState<LogEntry[]>(() =>
  getStorageItem(STORAGE_KEYS.LOGS, [], z.array(LogEntrySchema))
);
```
