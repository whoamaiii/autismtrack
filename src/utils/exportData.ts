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

// Storage keys - must match store.tsx
const STORAGE_KEYS = {
    LOGS: 'kreativium_logs',
    CRISIS_EVENTS: 'kreativium_crisis_events',
    SCHEDULE_ENTRIES: 'kreativium_schedule_entries',
    SCHEDULE_TEMPLATES: 'kreativium_schedule_templates',
    GOALS: 'kreativium_goals',
    CHILD_PROFILE: 'kreativium_child_profile',
} as const;

export interface ExportedData {
    version: string;
    exportedAt: string;
    logs: LogEntry[];
    crisisEvents: CrisisEvent[];
    scheduleEntries: ScheduleEntry[];
    scheduleTemplates: DailyScheduleTemplate[];
    goals: Goal[];
    childProfile: ChildProfile | null;
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

export function exportAllData(): ExportedData {
    const logs: LogEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS) || '[]');
    const crisisEvents: CrisisEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CRISIS_EVENTS) || '[]');
    const scheduleEntries: ScheduleEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE_ENTRIES) || '[]');
    const scheduleTemplates: DailyScheduleTemplate[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE_TEMPLATES) || '[]');
    const goals: Goal[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]');
    const childProfile: ChildProfile | null = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHILD_PROFILE) || 'null');

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
            const progress = g.targetDirection === 'decrease'
                ? Math.max(0, (g.targetValue - g.currentValue) / g.targetValue * 100)
                : Math.min(100, (g.currentValue / g.targetValue) * 100);
            return sum + progress;
        }, 0) / goals.length)
        : 0;

    return {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        logs,
        crisisEvents,
        scheduleEntries,
        scheduleTemplates,
        goals,
        childProfile,
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
 * Import result type
 */
export interface ImportResult {
    success: boolean;
    error?: string;
    imported?: {
        logs: number;
        crisisEvents: number;
        scheduleEntries: number;
        scheduleTemplates: number;
        goals: number;
        childProfile: boolean;
    };
}

/**
 * Validates and imports data from a backup file
 */
export function importData(jsonString: string, mergeMode: 'replace' | 'merge' = 'replace'): ImportResult {
    try {
        const data = JSON.parse(jsonString) as Partial<ExportedData>;

        // Validate structure
        if (!data.version || !data.exportedAt) {
            return { success: false, error: 'Ugyldig filformat. Mangler versjon eller eksportdato.' };
        }

        // Validate arrays
        if (!Array.isArray(data.logs) ||
            !Array.isArray(data.crisisEvents) ||
            !Array.isArray(data.scheduleEntries) ||
            !Array.isArray(data.goals)) {
            return { success: false, error: 'Ugyldig filformat. Data mangler eller er korrupt.' };
        }

        if (mergeMode === 'replace') {
            // Replace all data
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(data.logs));
            localStorage.setItem(STORAGE_KEYS.CRISIS_EVENTS, JSON.stringify(data.crisisEvents));
            localStorage.setItem(STORAGE_KEYS.SCHEDULE_ENTRIES, JSON.stringify(data.scheduleEntries));
            localStorage.setItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, JSON.stringify(data.scheduleTemplates || []));
            localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(data.goals));

            if (data.childProfile) {
                localStorage.setItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(data.childProfile));
            }
        } else {
            // Merge mode - add new entries, skip duplicates by ID
            const existingLogs: LogEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS) || '[]');
            const existingCrisis: CrisisEvent[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.CRISIS_EVENTS) || '[]');
            const existingSchedule: ScheduleEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE_ENTRIES) || '[]');
            const existingTemplates: DailyScheduleTemplate[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE_TEMPLATES) || '[]');
            const existingGoals: Goal[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '[]');

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

            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([...existingLogs, ...newLogs]));
            localStorage.setItem(STORAGE_KEYS.CRISIS_EVENTS, JSON.stringify([...existingCrisis, ...newCrisis]));
            localStorage.setItem(STORAGE_KEYS.SCHEDULE_ENTRIES, JSON.stringify([...existingSchedule, ...newSchedule]));
            localStorage.setItem(STORAGE_KEYS.SCHEDULE_TEMPLATES, JSON.stringify([...existingTemplates, ...newTemplates]));
            localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify([...existingGoals, ...newGoals]));

            // Child profile - only import if not already set
            if (data.childProfile && !localStorage.getItem(STORAGE_KEYS.CHILD_PROFILE)) {
                localStorage.setItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(data.childProfile));
            }
        }

        return {
            success: true,
            imported: {
                logs: data.logs.length,
                crisisEvents: data.crisisEvents.length,
                scheduleEntries: data.scheduleEntries.length,
                scheduleTemplates: (data.scheduleTemplates || []).length,
                goals: data.goals.length,
                childProfile: !!data.childProfile
            }
        };
    } catch (e) {
        if (import.meta.env.DEV) {
            console.error('Import failed:', e);
        }
        return { success: false, error: 'Kunne ikke lese filen. Sjekk at det er en gyldig backup-fil.' };
    }
}
