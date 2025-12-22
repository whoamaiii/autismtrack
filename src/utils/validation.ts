import { z } from 'zod';

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================

// Context type
export const ContextTypeSchema = z.enum(['home', 'school']);

// Day of week
export const DayOfWeekSchema = z.enum([
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
]);

// Time of day
export const TimeOfDaySchema = z.enum(['morning', 'midday', 'afternoon', 'evening', 'night']);

// Strategy effectiveness
export const StrategyEffectivenessSchema = z.enum(['helped', 'no_change', 'escalated']);

// ============================================
// LOG ENTRY SCHEMA
// ============================================
export const LogEntrySchema = z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
    context: ContextTypeSchema,
    arousal: z.number().int().min(1).max(10),
    valence: z.number().int().min(1).max(10),
    energy: z.number().int().min(1).max(10),
    sensoryTriggers: z.array(z.string()),
    contextTriggers: z.array(z.string()),
    strategies: z.array(z.string()),
    strategyEffectiveness: StrategyEffectivenessSchema.optional(),
    duration: z.number().int().min(0),
    note: z.string(),
    dayOfWeek: DayOfWeekSchema.optional(),
    timeOfDay: TimeOfDaySchema.optional(),
    hourOfDay: z.number().int().min(0).max(23).optional(),
});

// Schema for creating a new log (without computed fields)
export const LogEntryInputSchema = LogEntrySchema.omit({
    dayOfWeek: true,
    timeOfDay: true,
    hourOfDay: true,
});

// ============================================
// CRISIS EVENT SCHEMA
// ============================================
export const CrisisTypeSchema = z.enum([
    'meltdown', 'shutdown', 'anxiety', 'sensory_overload', 'other'
]);

export const CrisisResolutionSchema = z.enum([
    'self_regulated', 'co_regulated', 'timed_out', 'interrupted', 'other'
]);

export const CrisisEventSchema = z.object({
    id: z.string().uuid(),
    timestamp: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
    context: ContextTypeSchema,
    type: CrisisTypeSchema,
    durationSeconds: z.number().int().min(0),
    peakIntensity: z.number().int().min(1).max(10),
    precedingArousal: z.number().int().min(1).max(10).optional(),
    precedingEnergy: z.number().int().min(1).max(10).optional(),
    warningSignsObserved: z.array(z.string()),
    sensoryTriggers: z.array(z.string()),
    contextTriggers: z.array(z.string()),
    strategiesUsed: z.array(z.string()),
    resolution: CrisisResolutionSchema,
    hasAudioRecording: z.boolean(),
    audioUrl: z.string().url().optional(),
    notes: z.string(),
    recoveryTimeMinutes: z.number().int().min(0).optional(),
    dayOfWeek: DayOfWeekSchema.optional(),
    timeOfDay: TimeOfDaySchema.optional(),
    hourOfDay: z.number().int().min(0).max(23).optional(),
});

// ============================================
// SCHEDULE SCHEMAS
// ============================================
export const ActivityStatusSchema = z.enum([
    'completed', 'current', 'upcoming', 'skipped', 'modified'
]);

export const ScheduleActivitySchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(100),
    icon: z.string(),
    scheduledStart: z.string().regex(/^\d{2}:\d{2}$/),
    scheduledEnd: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().min(1),
});

export const ScheduleEntrySchema = z.object({
    id: z.string().uuid(),
    date: z.string(),
    context: ContextTypeSchema,
    activity: ScheduleActivitySchema,
    status: ActivityStatusSchema,
    actualStart: z.string().optional(),
    actualEnd: z.string().optional(),
    actualDurationMinutes: z.number().int().min(0).optional(),
    arousalDuringActivity: z.number().int().min(1).max(10).optional(),
    energyAfterActivity: z.number().int().min(1).max(10).optional(),
    transitionDifficulty: z.number().int().min(1).max(10).optional(),
    transitionSupport: z.array(z.string()).optional(),
    notes: z.string().optional(),
});

// Daily schedule template schema
export const DailyScheduleTemplateSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    context: ContextTypeSchema,
    dayOfWeek: DayOfWeekSchema.or(z.literal('all')),
    activities: z.array(ScheduleActivitySchema),
});

// ============================================
// GOAL SCHEMAS
// ============================================
export const GoalCategorySchema = z.enum([
    'regulation', 'social', 'academic', 'communication', 'independence', 'sensory'
]);

export const GoalStatusSchema = z.enum([
    'not_started', 'in_progress', 'on_track', 'at_risk', 'achieved', 'discontinued'
]);

export const GoalProgressSchema = z.object({
    id: z.string().uuid(),
    goalId: z.string().uuid(),
    date: z.string(),
    value: z.number(),
    context: ContextTypeSchema,
    notes: z.string().optional(),
});

export const GoalSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string(),
    category: GoalCategorySchema,
    targetValue: z.number(),
    targetUnit: z.string(),
    targetDirection: z.enum(['increase', 'decrease', 'maintain']),
    startDate: z.string(),
    targetDate: z.string(),
    currentValue: z.number(),
    status: GoalStatusSchema,
    progressHistory: z.array(GoalProgressSchema),
    notes: z.string().optional(),
});

// ============================================
// CHILD PROFILE SCHEMA
// ============================================
export const CommunicationStyleSchema = z.enum([
    'verbal', 'limited_verbal', 'non_verbal', 'aac'
]);

export const ChildProfileSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    age: z.number().int().min(0).max(25).optional(),
    diagnoses: z.array(z.string()),
    communicationStyle: CommunicationStyleSchema,
    sensorySensitivities: z.array(z.string()),
    seekingSensory: z.array(z.string()),
    effectiveStrategies: z.array(z.string()),
    additionalContext: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

// ============================================
// AI ANALYSIS SCHEMAS
// ============================================
export const AnalysisCorrelationSchema = z.object({
    factor1: z.string(),
    factor2: z.string(),
    relationship: z.string(),
    strength: z.enum(['weak', 'moderate', 'strong']),
    description: z.string(),
});

export const AnalysisResultSchema = z.object({
    id: z.string().optional(),
    generatedAt: z.string().optional(),
    dateRangeStart: z.string().optional(),
    dateRangeEnd: z.string().optional(),
    triggerAnalysis: z.string(),
    strategyEvaluation: z.string(),
    interoceptionPatterns: z.string(),
    correlations: z.array(AnalysisCorrelationSchema).optional(),
    recommendations: z.array(z.string()).optional(),
    summary: z.string(),
    isDeepAnalysis: z.boolean().optional(),
    modelUsed: z.string().optional(),
});

// ============================================
// VALIDATION HELPER FUNCTIONS
// ============================================

/**
 * Validates a log entry and returns a result object
 */
export function validateLogEntry(data: unknown): { success: true; data: z.infer<typeof LogEntrySchema> } | { success: false; errors: string[] } {
    const result = LogEntrySchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
}

/**
 * Validates log entry input (for form submission)
 */
export function validateLogEntryInput(data: unknown): { success: true; data: z.infer<typeof LogEntryInputSchema> } | { success: false; errors: string[] } {
    const result = LogEntryInputSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
}

/**
 * Validates a crisis event
 */
export function validateCrisisEvent(data: unknown): { success: true; data: z.infer<typeof CrisisEventSchema> } | { success: false; errors: string[] } {
    const result = CrisisEventSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
}

/**
 * Validates a child profile
 */
export function validateChildProfile(data: unknown): { success: true; data: z.infer<typeof ChildProfileSchema> } | { success: false; errors: string[] } {
    const result = ChildProfileSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
}

/**
 * Validates a goal
 */
export function validateGoal(data: unknown): { success: true; data: z.infer<typeof GoalSchema> } | { success: false; errors: string[] } {
    const result = GoalSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
}

/**
 * Validates an AI analysis result
 */
export function validateAnalysisResult(data: unknown): { success: true; data: z.infer<typeof AnalysisResultSchema> } | { success: false; errors: string[] } {
    const result = AnalysisResultSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
}

/**
 * Validates imported data structure
 */
export const ImportedDataSchema = z.object({
    logs: z.array(LogEntrySchema).optional(),
    crisisEvents: z.array(CrisisEventSchema).optional(),
    scheduleEntries: z.array(ScheduleEntrySchema).optional(),
    scheduleTemplates: z.array(DailyScheduleTemplateSchema).optional(),
    goals: z.array(GoalSchema).optional(),
    childProfile: ChildProfileSchema.nullable().optional(),
    exportedAt: z.string().optional(),
    version: z.string().optional(),
});

export function validateImportedData(data: unknown): { success: true; data: z.infer<typeof ImportedDataSchema> } | { success: false; errors: string[] } {
    const result = ImportedDataSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return {
        success: false,
        errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
    };
}
