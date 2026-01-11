/**
 * Data Export/Import Utility
 * Separated from store.tsx to satisfy React Fast Refresh requirements
 */

import type {
    LogEntry,
    CrisisEvent,
    ScheduleEntry,
    Goal,
    ChildProfile,
    DailyScheduleTemplate
} from '../types';
import { STORAGE_KEYS, STORAGE_PREFIXES } from '../constants/storage';
import {
    validateExportData,
    formatValidationErrors,
    type ValidationError
} from './exportValidation';

// Activity type for daily schedules (matches DailyPlanComponents.tsx)
interface DailyScheduleActivity {
    id: string;
    time: string;
    endTime: string;
    title: string;
    status: 'completed' | 'current' | 'upcoming';
    icon: string;
    durationMinutes?: number;
    color?: string;
}

// Use centralized prefix
const DAILY_SCHEDULE_PREFIX = STORAGE_PREFIXES.DAILY_SCHEDULE;

export interface ExportedData {
    version: string;
    exportedAt: string;
    logs: LogEntry[];
    crisisEvents: CrisisEvent[];
    scheduleEntries: ScheduleEntry[];
    scheduleTemplates: DailyScheduleTemplate[];
    goals: Goal[];
    childProfile: ChildProfile | null;
    // Daily schedule modifications (keyed by "date_context", e.g., "2025-12-23_home")
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

const EXPORT_VERSION = '1.0.0';

// Safe JSON parse helper to handle corrupted localStorage data
function safeJsonParse<T>(key: string, fallback: T): T {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
    } catch {
        return fallback;
    }
}

// Safe localStorage write helper with quota error handling
function safeSetItem(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        // Handle QuotaExceededError or SecurityError (private browsing)
        if (import.meta.env.DEV) {
            console.error(`Failed to write to localStorage key "${key}":`, error);
        }
        return false;
    }
}

// Collect all daily schedule keys from localStorage
function collectDailySchedules(): Record<string, DailyScheduleActivity[]> {
    const dailySchedules: Record<string, DailyScheduleActivity[]> = {};

    try {
        // Check if localStorage is accessible (may throw SecurityError in private browsing)
        const storageLength = localStorage.length;

        for (let i = 0; i < storageLength; i++) {
            try {
                const key = localStorage.key(i);
                if (key && key.startsWith(DAILY_SCHEDULE_PREFIX)) {
                    // Extract the "date_context" part (e.g., "2025-12-23_home")
                    const suffix = key.slice(DAILY_SCHEDULE_PREFIX.length);
                    const value = localStorage.getItem(key);
                    if (value) {
                        try {
                            const activities = JSON.parse(value) as DailyScheduleActivity[];
                            if (Array.isArray(activities) && activities.length > 0) {
                                dailySchedules[suffix] = activities;
                            }
                        } catch {
                            // Skip invalid entries
                        }
                    }
                }
            } catch {
                // Skip individual key access errors
            }
        }
    } catch (error) {
        // Handle SecurityError in private browsing mode
        if (import.meta.env.DEV) {
            console.warn('localStorage access restricted:', error);
        }
        // Return partial results (may be empty)
    }

    return dailySchedules;
}

export function exportAllData(): ExportedData {
    const logs: LogEntry[] = safeJsonParse(STORAGE_KEYS.LOGS, []);
    const crisisEvents: CrisisEvent[] = safeJsonParse(STORAGE_KEYS.CRISIS_EVENTS, []);
    const scheduleEntries: ScheduleEntry[] = safeJsonParse(STORAGE_KEYS.SCHEDULE_ENTRIES, []);
    const scheduleTemplates: DailyScheduleTemplate[] = safeJsonParse(STORAGE_KEYS.SCHEDULE_TEMPLATES, []);
    const goals: Goal[] = safeJsonParse(STORAGE_KEYS.GOALS, []);
    const childProfile: ChildProfile | null = safeJsonParse(STORAGE_KEYS.CHILD_PROFILE, null);

    // Calculate date range
    const allDates = [
        ...logs.map(l => l.timestamp),
        ...crisisEvents.map(e => e.timestamp),
        ...scheduleEntries.map(e => e.date)
    ].filter(Boolean).map(d => new Date(d).getTime());

    const dateRange = allDates.length > 0
        ? {
            start: new Date(Math.min(...allDates)).toISOString(),
            end: new Date(Math.max(...allDates)).toISOString()
        }
        : null;

    // Calculate averages
    const avgCrisisDuration = crisisEvents.length > 0
        ? Math.round(crisisEvents.reduce((sum, e) => sum + e.durationSeconds, 0) / crisisEvents.length)
        : 0;

    const completionRate = scheduleEntries.length > 0
        ? Math.round((scheduleEntries.filter(e => e.status === 'completed').length / scheduleEntries.length) * 100)
        : 0;

    const goalProgress = goals.length > 0
        ? Math.round(goals.reduce((sum, g) => {
            if (g.targetValue === 0) return sum;
            let progress: number;
            if (g.targetDirection === 'decrease') {
                // For decrease goals, use first progress entry as baseline
                const baseline = g.progressHistory.length > 0
                    ? g.progressHistory[0].value
                    : g.currentValue;
                const range = baseline - g.targetValue;
                // If currentValue at or below target, 100% progress
                if (g.currentValue <= g.targetValue) {
                    progress = 100;
                } else if (range <= 0) {
                    // Edge case: baseline equals or is below target value
                    // This can happen if first recorded value was already at/below target
                    // Cannot calculate meaningful progress, default to 0%
                    progress = 0;
                } else {
                    progress = Math.min(100, Math.max(0, (baseline - g.currentValue) / range * 100));
                }
            } else {
                progress = Math.min(100, (g.currentValue / g.targetValue) * 100);
            }
            return sum + progress;
        }, 0) / goals.length)
        : 0;

    // Collect daily schedule modifications
    const dailySchedules = collectDailySchedules();

    return {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        logs,
        crisisEvents,
        scheduleEntries,
        scheduleTemplates,
        goals,
        childProfile,
        dailySchedules,
        summary: {
            totalLogs: logs.length,
            totalCrisisEvents: crisisEvents.length,
            averageCrisisDuration: avgCrisisDuration,
            scheduleCompletionRate: completionRate,
            goalProgress,
            dateRange
        }
    };
}

/**
 * Downloads the exported data as a JSON file
 */
export function downloadExport(): void {
    const data = exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const date = new Date().toISOString().split('T')[0];
    const filename = `kreativium-backup-${date}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Import result type with detailed stats and validation errors
 */
export interface ImportResult {
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

/**
 * Backup structure for atomic import recovery
 */
interface ImportBackup {
    logs: string | null;
    crisisEvents: string | null;
    scheduleEntries: string | null;
    scheduleTemplates: string | null;
    goals: string | null;
    childProfile: string | null;
    dailyScheduleKeys: string[];
    dailyScheduleValues: (string | null)[];
}

/**
 * Create a backup of current localStorage state before import
 */
function createBackup(dailyScheduleKeysToBackup: string[] = []): ImportBackup {
    return {
        logs: localStorage.getItem(STORAGE_KEYS.LOGS),
        crisisEvents: localStorage.getItem(STORAGE_KEYS.CRISIS_EVENTS),
        scheduleEntries: localStorage.getItem(STORAGE_KEYS.SCHEDULE_ENTRIES),
        scheduleTemplates: localStorage.getItem(STORAGE_KEYS.SCHEDULE_TEMPLATES),
        goals: localStorage.getItem(STORAGE_KEYS.GOALS),
        childProfile: localStorage.getItem(STORAGE_KEYS.CHILD_PROFILE),
        dailyScheduleKeys: dailyScheduleKeysToBackup,
        dailyScheduleValues: dailyScheduleKeysToBackup.map(key => localStorage.getItem(key))
    };
}

/**
 * Restore localStorage from backup after failed import
 */
function restoreBackup(backup: ImportBackup): void {
    try {
        // Restore main data (set or remove based on backup state)
        if (backup.logs !== null) {
            localStorage.setItem(STORAGE_KEYS.LOGS, backup.logs);
        } else {
            localStorage.removeItem(STORAGE_KEYS.LOGS);
        }

        if (backup.crisisEvents !== null) {
            localStorage.setItem(STORAGE_KEYS.CRISIS_EVENTS, backup.crisisEvents);
        } else {
            localStorage.removeItem(STORAGE_KEYS.CRISIS_EVENTS);
        }

        if (backup.scheduleEntries !== null) {
            localStorage.setItem(STORAGE_KEYS.SCHEDULE_ENTRIES, backup.scheduleEntries);
        } else {
            localStorage.removeItem(STORAGE_KEYS.SCHEDULE_ENTRIES);
        }

        if (backup.scheduleTemplates !== null) {
            localStorage.setItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, backup.scheduleTemplates);
        } else {
            localStorage.removeItem(STORAGE_KEYS.SCHEDULE_TEMPLATES);
        }

        if (backup.goals !== null) {
            localStorage.setItem(STORAGE_KEYS.GOALS, backup.goals);
        } else {
            localStorage.removeItem(STORAGE_KEYS.GOALS);
        }

        if (backup.childProfile !== null) {
            localStorage.setItem(STORAGE_KEYS.CHILD_PROFILE, backup.childProfile);
        } else {
            localStorage.removeItem(STORAGE_KEYS.CHILD_PROFILE);
        }

        // Restore daily schedules
        backup.dailyScheduleKeys.forEach((key, index) => {
            const value = backup.dailyScheduleValues[index];
            if (value !== null) {
                localStorage.setItem(key, value);
            } else {
                localStorage.removeItem(key);
            }
        });
    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('Failed to restore backup:', error);
        }
    }
}

/**
 * Validates and imports data from a backup file with atomic rollback on failure
 * Uses Zod schema validation for robust data checking
 */
export function importData(jsonString: string, mergeMode: 'replace' | 'merge' = 'replace'): ImportResult {
    try {
        // Parse JSON first
        let rawData: unknown;
        try {
            rawData = JSON.parse(jsonString);
        } catch {
            return { success: false, error: 'Ugyldig JSON-format. Filen kan være korrupt.' };
        }

        // Validate with Zod schema
        const validationResult = validateExportData(rawData);

        if (!validationResult.success) {
            const errorMessage = formatValidationErrors(validationResult.errors || []);
            return {
                success: false,
                error: errorMessage || 'Ugyldig filformat. Data validering feilet.',
                validationErrors: validationResult.errors,
            };
        }

        // Use validated data (type-safe)
        const data = validationResult.data!;

        // Collect daily schedule keys that will be affected
        const dailyScheduleKeysToBackup: string[] = [];
        if (data.dailySchedules && typeof data.dailySchedules === 'object') {
            for (const suffix of Object.keys(data.dailySchedules)) {
                dailyScheduleKeysToBackup.push(`${DAILY_SCHEDULE_PREFIX}${suffix}`);
            }
        }

        // Create backup BEFORE any writes
        const backup = createBackup(dailyScheduleKeysToBackup);

        // Helper to perform all writes atomically (all succeed or rollback)
        const writeResults: boolean[] = [];

        // Track merge statistics for merge mode
        let mergeStats: ImportResult['merged'] | undefined;

        try {
            if (mergeMode === 'replace') {
                // Replace all data
                writeResults.push(safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs)));
                writeResults.push(safeSetItem(STORAGE_KEYS.CRISIS_EVENTS, JSON.stringify(data.crisisEvents)));
                writeResults.push(safeSetItem(STORAGE_KEYS.SCHEDULE_ENTRIES, JSON.stringify(data.scheduleEntries)));
                writeResults.push(safeSetItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, JSON.stringify(data.scheduleTemplates || [])));
                writeResults.push(safeSetItem(STORAGE_KEYS.GOALS, JSON.stringify(data.goals)));

                if (data.childProfile) {
                    writeResults.push(safeSetItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(data.childProfile)));
                }
            } else {
                // Merge mode - add new entries, skip duplicates by ID, track counts
                const existingLogs: LogEntry[] = safeJsonParse(STORAGE_KEYS.LOGS, []);
                const existingCrisis: CrisisEvent[] = safeJsonParse(STORAGE_KEYS.CRISIS_EVENTS, []);
                const existingSchedule: ScheduleEntry[] = safeJsonParse(STORAGE_KEYS.SCHEDULE_ENTRIES, []);
                const existingTemplates: DailyScheduleTemplate[] = safeJsonParse(STORAGE_KEYS.SCHEDULE_TEMPLATES, []);
                const existingGoals: Goal[] = safeJsonParse(STORAGE_KEYS.GOALS, []);

                const existingLogIds = new Set(existingLogs.map(l => l.id));
                const existingCrisisIds = new Set(existingCrisis.map(c => c.id));
                const existingScheduleIds = new Set(existingSchedule.map(s => s.id));
                const existingTemplateIds = new Set(existingTemplates.map(t => t.id));
                const existingGoalIds = new Set(existingGoals.map(g => g.id));

                const newLogs = data.logs.filter(l => !existingLogIds.has(l.id));
                const newCrisis = data.crisisEvents.filter(c => !existingCrisisIds.has(c.id));
                const newSchedule = data.scheduleEntries.filter(s => !existingScheduleIds.has(s.id));
                const newTemplates = (data.scheduleTemplates || []).filter(t => !existingTemplateIds.has(t.id));
                const newGoals = data.goals.filter(g => !existingGoalIds.has(g.id));

                // Track merge statistics
                mergeStats = {
                    logsAdded: newLogs.length,
                    logsSkipped: data.logs.length - newLogs.length,
                    crisisAdded: newCrisis.length,
                    crisisSkipped: data.crisisEvents.length - newCrisis.length,
                    goalsAdded: newGoals.length,
                    goalsSkipped: data.goals.length - newGoals.length,
                };

                writeResults.push(safeSetItem(STORAGE_KEYS.LOGS, JSON.stringify([...existingLogs, ...newLogs])));
                writeResults.push(safeSetItem(STORAGE_KEYS.CRISIS_EVENTS, JSON.stringify([...existingCrisis, ...newCrisis])));
                writeResults.push(safeSetItem(STORAGE_KEYS.SCHEDULE_ENTRIES, JSON.stringify([...existingSchedule, ...newSchedule])));
                writeResults.push(safeSetItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, JSON.stringify([...existingTemplates, ...newTemplates])));
                writeResults.push(safeSetItem(STORAGE_KEYS.GOALS, JSON.stringify([...existingGoals, ...newGoals])));

                // Child profile - only import if not already set
                if (data.childProfile && !localStorage.getItem(STORAGE_KEYS.CHILD_PROFILE)) {
                    writeResults.push(safeSetItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(data.childProfile)));
                }
            }

            // Import daily schedules if present
            let dailySchedulesCount = 0;
            if (data.dailySchedules && typeof data.dailySchedules === 'object') {
                for (const [suffix, activities] of Object.entries(data.dailySchedules)) {
                    if (Array.isArray(activities) && activities.length > 0) {
                        const key = `${DAILY_SCHEDULE_PREFIX}${suffix}`;
                        if (mergeMode === 'replace' || !localStorage.getItem(key)) {
                            writeResults.push(safeSetItem(key, JSON.stringify(activities)));
                            dailySchedulesCount++;
                        }
                    }
                }
            }

            // Check if any writes failed - rollback if so
            if (writeResults.some(result => !result)) {
                restoreBackup(backup);
                return { success: false, error: 'Kunne ikke lagre all data. Prøv å frigjøre lagringsplass.' };
            }

            return {
                success: true,
                imported: {
                    logs: data.logs.length,
                    crisisEvents: data.crisisEvents.length,
                    scheduleEntries: data.scheduleEntries.length,
                    scheduleTemplates: (data.scheduleTemplates || []).length,
                    goals: data.goals.length,
                    childProfile: !!data.childProfile,
                    dailySchedules: dailySchedulesCount
                },
                ...(mergeStats && { merged: mergeStats }),
            };
        } catch (writeError) {
            // Rollback on any error during writes
            restoreBackup(backup);
            throw writeError;
        }
    } catch (e) {
        if (import.meta.env.DEV) {
            console.error('Import failed:', e);
        }
        return { success: false, error: 'Kunne ikke lese filen. Sjekk at det er en gyldig backup-fil.' };
    }
}
