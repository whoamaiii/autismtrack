/**
 * Export/Import Data Validation using Zod
 * Provides schema validation for backup files with helpful error messages
 */

import { z } from 'zod';

// =============================================================================
// BASE SCHEMAS
// =============================================================================

const ContextTypeSchema = z.enum(['home', 'school']);
const DayOfWeekSchema = z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
const TimeOfDaySchema = z.enum(['morning', 'midday', 'afternoon', 'evening', 'night']);

// =============================================================================
// LOG ENTRY SCHEMA
// =============================================================================

export const LogEntrySchema = z.object({
    id: z.string().min(1, 'Log entry ID is required'),
    timestamp: z.string().refine(
        (val) => !isNaN(Date.parse(val)),
        'Invalid timestamp format'
    ),
    context: ContextTypeSchema,

    // Core metrics (1-10 scale)
    arousal: z.number().min(1).max(10),
    valence: z.number().min(1).max(10),
    energy: z.number().min(1).max(10),

    // Triggers and strategies
    sensoryTriggers: z.array(z.string()).default([]),
    contextTriggers: z.array(z.string()).default([]),
    strategies: z.array(z.string()).default([]),
    strategyEffectiveness: z.enum(['helped', 'no_change', 'escalated']).optional(),

    // Additional data
    duration: z.number().min(0),
    note: z.string().default(''),

    // Computed metadata (optional - will be recomputed on load)
    dayOfWeek: DayOfWeekSchema.optional(),
    timeOfDay: TimeOfDaySchema.optional(),
    hourOfDay: z.number().min(0).max(23).optional(),
}).passthrough(); // Allow unknown fields for future compatibility

// =============================================================================
// CRISIS EVENT SCHEMA
// =============================================================================

const CrisisTypeSchema = z.enum(['meltdown', 'shutdown', 'anxiety', 'sensory_overload', 'other']);
const CrisisResolutionSchema = z.enum(['self_regulated', 'co_regulated', 'timed_out', 'interrupted', 'other']);

export const CrisisEventSchema = z.object({
    id: z.string().min(1, 'Crisis event ID is required'),
    timestamp: z.string().refine(
        (val) => !isNaN(Date.parse(val)),
        'Invalid timestamp format'
    ),
    context: ContextTypeSchema,

    // Crisis details
    type: CrisisTypeSchema,
    durationSeconds: z.number().min(0),
    peakIntensity: z.number().min(1).max(10),

    // Pre-crisis indicators
    precedingArousal: z.number().min(1).max(10).optional(),
    precedingEnergy: z.number().min(1).max(10).optional(),
    warningSignsObserved: z.array(z.string()).default([]),

    // Triggers
    sensoryTriggers: z.array(z.string()).default([]),
    contextTriggers: z.array(z.string()).default([]),

    // Intervention
    strategiesUsed: z.array(z.string()).default([]),
    resolution: CrisisResolutionSchema,

    // Audio/notes
    hasAudioRecording: z.boolean().default(false),
    audioUrl: z.string().optional(),
    notes: z.string().default(''),

    // Post-crisis
    recoveryTimeMinutes: z.number().min(0).optional(),

    // Metadata
    dayOfWeek: DayOfWeekSchema.optional(),
    timeOfDay: TimeOfDaySchema.optional(),
    hourOfDay: z.number().min(0).max(23).optional(),
}).passthrough();

// =============================================================================
// SCHEDULE SCHEMAS
// =============================================================================

const ActivityStatusSchema = z.enum(['completed', 'current', 'upcoming', 'skipped', 'modified']);

export const ScheduleActivitySchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    icon: z.string().default(''),
    scheduledStart: z.string(), // HH:mm format
    scheduledEnd: z.string(),
    durationMinutes: z.number().min(0),
}).passthrough();

export const ScheduleEntrySchema = z.object({
    id: z.string().min(1),
    date: z.string(),
    context: ContextTypeSchema,
    activity: ScheduleActivitySchema,

    status: ActivityStatusSchema,
    actualStart: z.string().optional(),
    actualEnd: z.string().optional(),
    actualDurationMinutes: z.number().min(0).optional(),

    arousalDuringActivity: z.number().min(1).max(10).optional(),
    energyAfterActivity: z.number().min(1).max(10).optional(),

    transitionDifficulty: z.number().min(1).max(10).optional(),
    transitionSupport: z.array(z.string()).optional(),

    notes: z.string().optional(),
}).passthrough();

export const DailyScheduleTemplateSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    context: ContextTypeSchema,
    dayOfWeek: z.union([DayOfWeekSchema, z.literal('all')]),
    activities: z.array(ScheduleActivitySchema),
}).passthrough();

// =============================================================================
// GOAL SCHEMAS
// =============================================================================

const GoalCategorySchema = z.enum(['regulation', 'social', 'academic', 'communication', 'independence', 'sensory']);
const GoalStatusSchema = z.enum(['not_started', 'in_progress', 'on_track', 'at_risk', 'achieved', 'discontinued']);

export const GoalProgressSchema = z.object({
    id: z.string().min(1),
    goalId: z.string().min(1),
    date: z.string(),
    value: z.number(),
    context: ContextTypeSchema,
    notes: z.string().optional(),
}).passthrough();

export const GoalSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    category: GoalCategorySchema,

    targetValue: z.number(),
    targetUnit: z.string(),
    targetDirection: z.enum(['increase', 'decrease', 'maintain']),

    startDate: z.string(),
    targetDate: z.string(),

    currentValue: z.number(),
    status: GoalStatusSchema,

    progressHistory: z.array(GoalProgressSchema).default([]),

    notes: z.string().optional(),
}).passthrough();

// =============================================================================
// CHILD PROFILE SCHEMA
// =============================================================================

const CommunicationStyleSchema = z.enum(['verbal', 'limited_verbal', 'non_verbal', 'aac']);

export const ChildProfileSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    age: z.number().min(0).max(100).optional(),

    diagnoses: z.array(z.string()).default([]),
    communicationStyle: CommunicationStyleSchema,

    sensorySensitivities: z.array(z.string()).default([]),
    seekingSensory: z.array(z.string()).default([]),

    effectiveStrategies: z.array(z.string()).default([]),

    additionalContext: z.string().optional(),

    createdAt: z.string(),
    updatedAt: z.string(),
}).passthrough();

// =============================================================================
// DAILY SCHEDULE ACTIVITY (for per-day modifications)
// =============================================================================

export const DailyScheduleActivitySchema = z.object({
    id: z.string().min(1),
    time: z.string(),
    endTime: z.string(),
    title: z.string(),
    status: z.enum(['completed', 'current', 'upcoming']),
    icon: z.string().default(''),
    durationMinutes: z.number().min(0).optional(),
    color: z.string().optional(),
}).passthrough();

// =============================================================================
// EXPORTED DATA SCHEMA (the complete backup file)
// =============================================================================

const SummarySchema = z.object({
    totalLogs: z.number().min(0),
    totalCrisisEvents: z.number().min(0),
    averageCrisisDuration: z.number().min(0),
    scheduleCompletionRate: z.number().min(0).max(100),
    goalProgress: z.number().min(0).max(100),
    dateRange: z.object({
        start: z.string(),
        end: z.string(),
    }).nullable(),
}).passthrough();

export const ExportedDataSchema = z.object({
    version: z.string().min(1, 'Version is required'),
    exportedAt: z.string().refine(
        (val) => !isNaN(Date.parse(val)),
        'Invalid export date format'
    ),

    logs: z.array(LogEntrySchema),
    crisisEvents: z.array(CrisisEventSchema),
    scheduleEntries: z.array(ScheduleEntrySchema),
    scheduleTemplates: z.array(DailyScheduleTemplateSchema).optional().default([]),
    goals: z.array(GoalSchema),
    childProfile: ChildProfileSchema.nullable(),

    dailySchedules: z.record(z.string(), z.array(DailyScheduleActivitySchema)).optional(),

    summary: SummarySchema,
}).passthrough();

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

export interface ValidationError {
    path: string;
    message: string;
}

export interface ValidationResult {
    success: boolean;
    data?: z.infer<typeof ExportedDataSchema>;
    errors?: ValidationError[];
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/**
 * Validates exported data against the schema
 * Returns parsed data if valid, or list of validation errors
 */
export function validateExportData(data: unknown): ValidationResult {
    const result = ExportedDataSchema.safeParse(data);

    if (result.success) {
        return {
            success: true,
            data: result.data,
        };
    }

    // Format errors for user-friendly display
    const errors: ValidationError[] = result.error.issues.map(issue => ({
        path: issue.path.join('.') || 'root',
        message: issue.message,
    }));

    return {
        success: false,
        errors,
    };
}

/**
 * Validates a single log entry
 */
export function validateLogEntry(entry: unknown): { success: boolean; data?: z.infer<typeof LogEntrySchema>; error?: string } {
    const result = LogEntrySchema.safeParse(entry);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error.issues[0]?.message || 'Invalid log entry' };
}

/**
 * Validates a single crisis event
 */
export function validateCrisisEvent(event: unknown): { success: boolean; data?: z.infer<typeof CrisisEventSchema>; error?: string } {
    const result = CrisisEventSchema.safeParse(event);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, error: result.error.issues[0]?.message || 'Invalid crisis event' };
}

/**
 * Formats validation errors into a user-friendly message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
    if (errors.length === 0) return '';

    if (errors.length === 1) {
        return `Valideringsfeil: ${errors[0].message} (${errors[0].path})`;
    }

    const firstThree = errors.slice(0, 3);
    const remaining = errors.length - 3;

    const messages = firstThree.map(e => `- ${e.path}: ${e.message}`).join('\n');

    if (remaining > 0) {
        return `Valideringsfeil:\n${messages}\n... og ${remaining} flere feil`;
    }

    return `Valideringsfeil:\n${messages}`;
}
