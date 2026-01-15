# NeuroLogg Pro - Storage & Data Persistence

## Overview

NeuroLogg Pro uses browser localStorage for all data persistence. This is an intentional design choice to ensure:

- **Privacy First**: All data stays on the user's device
- **Offline Capability**: Works without internet connection
- **No Accounts**: No user registration or cloud sync required
- **User Ownership**: Parents/caregivers fully control their data

---

## Table of Contents

1. [Storage Architecture](#storage-architecture)
2. [Storage Keys](#storage-keys)
3. [Storage Utilities](#storage-utilities)
4. [Multi-Tab Synchronization](#multi-tab-synchronization)
5. [Quota Management](#quota-management)
6. [Data Migration](#data-migration)
7. [Backup & Restore](#backup--restore)

---

## Storage Architecture

### Key Prefix Convention

All app data uses the `kreativium_` prefix to avoid conflicts:

```
kreativium_logs                 # Log entries
kreativium_crisis_events        # Crisis events
kreativium_crisis_reflections   # Crisis reflections
kreativium_schedule_entries     # Schedule entries
kreativium_schedule_templates   # Schedule templates
kreativium_goals                # IEP goals
kreativium_child_profile        # Child profile
kreativium_current_context      # Home/school toggle
kreativium_onboarding_completed # Onboarding status
kreativium_analysis_settings    # Analysis settings
kreativium_daily_schedule_YYYY-MM-DD_context # Daily schedule modifications
```

### Data Flow

```
User Action → React Context → localStorage → Other Tabs (via StorageEvent)
```

---

## Storage Keys

### `src/constants/storage.ts`

```typescript
export const STORAGE_KEYS = {
  LOGS: 'kreativium_logs',
  CRISIS_EVENTS: 'kreativium_crisis_events',
  CRISIS_REFLECTIONS: 'kreativium_crisis_reflections',
  SCHEDULE_ENTRIES: 'kreativium_schedule_entries',
  SCHEDULE_TEMPLATES: 'kreativium_schedule_templates',
  GOALS: 'kreativium_goals',
  CHILD_PROFILE: 'kreativium_child_profile',
  CURRENT_CONTEXT: 'kreativium_current_context',
  ONBOARDING_COMPLETED: 'kreativium_onboarding_completed',
  ANALYSIS_SETTINGS: 'kreativium_analysis_settings',
} as const;

export const STORAGE_PREFIXES = {
  DAILY_SCHEDULE: 'kreativium_daily_schedule_',
} as const;
```

### Data Sizes (Typical)

| Key | Typical Size | Max Records |
|-----|-------------|-------------|
| `logs` | 50-500 KB | ~1000-5000 entries |
| `crisis_events` | 10-100 KB | ~100-500 entries |
| `schedule` | 20-200 KB | ~500-2000 entries |
| `goals` | 5-50 KB | ~10-50 goals |
| `child_profile` | 1-5 KB | 1 profile |

---

## Storage Utilities

### `src/store/storage.ts`

#### `getStorageItem()`

Safely retrieves and validates data from localStorage.

```typescript
import { getStorageItem } from '../store/storage';
import { LogEntrySchema } from '../utils/validation';
import { z } from 'zod';

// With Zod validation
const logs = getStorageItem(
  STORAGE_KEYS.LOGS,
  [],                          // Fallback value
  z.array(LogEntrySchema)      // Validation schema
);

// Without validation
const rawData = getStorageItem('some_key', null);
```

**Features:**
- Returns fallback on parse errors
- For arrays: filters invalid items instead of failing completely
- Logs warnings in development mode

#### `safeSetItem()`

Writes to localStorage with quota error handling.

```typescript
import { safeSetItem } from '../store/storage';

const success = safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));

if (!success) {
  // Handle quota exceeded or save failure
}
```

**Features:**
- Returns `boolean` success status
- Dispatches `STORAGE_ERROR_EVENT` on failure
- Handles `QuotaExceededError` gracefully

#### `safeRemoveItem()`

Removes an item from localStorage safely.

```typescript
import { safeRemoveItem } from '../store/storage';

safeRemoveItem(STORAGE_KEYS.LOGS);
```

#### `getStorageContext()`

Retrieves the current home/school context.

```typescript
import { getStorageContext } from '../store/storage';

const context = getStorageContext(STORAGE_KEYS.CURRENT_CONTEXT, 'home');
// Returns: 'home' | 'school'
```

#### `createStorageSyncHandlers()`

Creates consistent `StorageEvent` and refresh handlers for context providers.

```typescript
import { createStorageSyncHandlers } from '../store/storage';

const sync = createStorageSyncHandlers({
  key: STORAGE_KEYS.LOGS,
  getLatest: () => getStorageItem(STORAGE_KEYS.LOGS, [], z.array(LogEntrySchema)),
  onUpdate: setLogs,
  refreshDelay: 100
});
```

---

## Multi-Tab Synchronization

### How It Works

Each context provider uses `createStorageSyncHandlers` to sync across tabs:

```typescript
import { createStorageSyncHandlers, getStorageItem, STORAGE_REFRESH_EVENT } from '../store/storage';

useEffect(() => {
  const sync = createStorageSyncHandlers({
    key: STORAGE_KEYS.LOGS,
    getLatest: () => getStorageItem(STORAGE_KEYS.LOGS, [], z.array(LogEntrySchema)),
    onUpdate: setLogs,
    refreshDelay: 100
  });

  window.addEventListener('storage', sync.handleStorageChange);
  window.addEventListener(STORAGE_REFRESH_EVENT, sync.handleRefresh);
  return () => {
    window.removeEventListener('storage', sync.handleStorageChange);
    window.removeEventListener(STORAGE_REFRESH_EVENT, sync.handleRefresh);
  };
}, []);
```

### Refresh Event

The `STORAGE_REFRESH_EVENT` triggers all providers to reload from localStorage:

```typescript
import { STORAGE_REFRESH_EVENT } from '../store/storage';

// Trigger refresh (e.g., after import)
window.dispatchEvent(new Event(STORAGE_REFRESH_EVENT));
```

Providers can debounce refresh by passing `refreshDelay`:

```typescript
const sync = createStorageSyncHandlers({
  key: STORAGE_KEYS.LOGS,
  getLatest: () => getStorageItem(STORAGE_KEYS.LOGS, [], z.array(LogEntrySchema)),
  onUpdate: setLogs,
  refreshDelay: 100
});

window.addEventListener(STORAGE_REFRESH_EVENT, sync.handleRefresh);
```

---

## Quota Management

### localStorage Limits

| Browser | Typical Limit |
|---------|--------------|
| Chrome | 5-10 MB |
| Firefox | 5-10 MB |
| Safari | 5 MB |
| Mobile Safari | 2.5 MB |

### Handling Quota Exceeded

```typescript
// Listen for quota errors
useEffect(() => {
  const handleStorageError = (e: CustomEvent) => {
    if (e.detail.error === 'quota_exceeded') {
      showToast('Storage full. Consider exporting and clearing old data.');
    }
  };

  window.addEventListener(STORAGE_ERROR_EVENT, handleStorageError);
  return () => window.removeEventListener(STORAGE_ERROR_EVENT, handleStorageError);
}, []);
```

### Strategies for Large Datasets

1. **Export old data** - Use `downloadExport()` to backup
2. **Clear old entries** - Remove logs older than N months
3. **Compress history** - Store aggregates instead of raw data

---

## Data Migration

### Version-Aware Import

The export format includes a version number:

```typescript
{
  "version": "1.0.0",
  "exportedAt": "2025-01-11T10:00:00Z",
  // ... data
}
```

Future versions can migrate older formats:

```typescript
// In importData()
if (data.version === '0.9.0') {
  // Migrate v0.9 format to v1.0
  data = migrateV09ToV10(data);
}
```

### Schema Evolution

When adding new fields:

1. Make new fields optional in Zod schema
2. Use `.optional()` or `.default()`
3. Handle missing fields in code

```typescript
// Adding a new optional field
export const LogEntrySchema = z.object({
  // ... existing fields
  newField: z.string().optional(), // Safe for old data
});
```

---

## Backup & Restore

### Creating Backups

```typescript
import { downloadExport, exportAllData } from '../utils/exportData';

// Download JSON file
downloadExport();
// Creates: kreativium-backup-2025-01-11.json

// Or get data object
const data = exportAllData();
```

### Restoring Backups

```typescript
import { importData } from '../utils/exportData';

// From file input
const handleFile = async (file: File) => {
  const jsonString = await file.text();

  // Replace all data
  const result = importData(jsonString, 'replace');

  // Or merge with existing
  const result = importData(jsonString, 'merge');

  if (result.success) {
    // Trigger UI refresh
    window.dispatchEvent(new Event(STORAGE_REFRESH_EVENT));
  } else {
    showError(result.error);
  }
};
```

### Atomic Import with Rollback

The import process is atomic:

1. **Backup** - Saves current state
2. **Validate** - Checks all data with Zod
3. **Write** - Saves new data
4. **Rollback** - Restores backup if any write fails

```typescript
// Simplified flow in importData()
const backup = createBackup();

try {
  // Validate with Zod
  const validationResult = validateExportData(rawData);
  if (!validationResult.success) {
    return { success: false, error: formatValidationErrors(validationResult.errors) };
  }

  // Write all data
  const writeResults = [];
  writeResults.push(safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs)));
  // ... more writes

  // Check for failures
  if (writeResults.some(r => !r)) {
    restoreBackup(backup);
    return { success: false, error: 'Storage quota exceeded' };
  }

  return { success: true, imported: { /* counts */ } };
} catch (error) {
  restoreBackup(backup);
  throw error;
}
```

---

## Security Considerations

### Data Visibility

- localStorage is accessible to any JavaScript on the same origin
- Data is visible in browser DevTools
- No encryption by default

### Private Browsing

- localStorage may be blocked or limited
- The app handles `SecurityError` gracefully
- Users see appropriate error messages

### Recommendations

1. **Don't store sensitive data** - No passwords, API keys, etc.
2. **Inform users** - Make data visibility clear
3. **Provide export** - Let users control their data
4. **Handle errors** - Gracefully degrade when storage fails

---

## Debugging

### View Storage in DevTools

```javascript
// In browser console
Object.keys(localStorage)
  .filter(k => k.startsWith('kreativium_'))
  .forEach(k => console.log(k, JSON.parse(localStorage.getItem(k))));
```

### Clear All App Data

```javascript
// In browser console
Object.keys(localStorage)
  .filter(k => k.startsWith('kreativium_'))
  .forEach(k => localStorage.removeItem(k));
```

### Check Storage Usage

```javascript
// Estimate storage used
const used = Object.keys(localStorage)
  .filter(k => k.startsWith('kreativium_'))
  .reduce((sum, k) => sum + localStorage.getItem(k).length, 0);

console.log(`App storage: ${(used / 1024).toFixed(2)} KB`);
```
