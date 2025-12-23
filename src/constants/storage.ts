/**
 * Centralized storage key definitions
 * Single source of truth for all localStorage keys used in the application
 */

export const STORAGE_KEYS = {
    // Core data
    LOGS: 'kreativium_logs',
    CRISIS_EVENTS: 'kreativium_crisis_events',
    SCHEDULE_ENTRIES: 'kreativium_schedule_entries',
    SCHEDULE_TEMPLATES: 'kreativium_schedule_templates',
    GOALS: 'kreativium_goals',

    // User settings
    CURRENT_CONTEXT: 'kreativium_current_context',
    CHILD_PROFILE: 'kreativium_child_profile',
    ONBOARDING_COMPLETED: 'kreativium_onboarding_completed',

    // UI state
    ANALYSIS_FILTERS: 'kreativium_analysis_filters',
    TIMER_STATE: 'kreativium_timer_state',
} as const;

// Prefixes for dynamic keys
export const STORAGE_PREFIXES = {
    DAILY_SCHEDULE: 'kreativium_daily_schedule_',
} as const;

// Type for storage key values
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Build a daily schedule storage key for a specific date and context
 */
export function getDailyScheduleKey(date: string, context: 'home' | 'school'): string {
    return `${STORAGE_PREFIXES.DAILY_SCHEDULE}${date}_${context}`;
}

/**
 * Get all storage keys (for backup/restore operations)
 */
export function getAllStorageKeys(): string[] {
    return Object.values(STORAGE_KEYS);
}

/**
 * Check if a key is a daily schedule key
 */
export function isDailyScheduleKey(key: string): boolean {
    return key.startsWith(STORAGE_PREFIXES.DAILY_SCHEDULE);
}
