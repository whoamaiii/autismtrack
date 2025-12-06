// ============================================
// KREATIVIUM - Complete Data Model for LLM Analysis
// ============================================

// Context types
export type ContextType = 'home' | 'school';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type TimeOfDay = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

// ============================================
// LOG ENTRIES - Core tracking
// ============================================
export interface LogEntry {
    id: string;
    timestamp: string; // ISO date string
    context: ContextType; // Where the log was recorded

    // Core metrics (1-10 scale)
    arousal: number; // Stress/activation level
    valence: number; // Mood (negative to positive)
    energy: number; // Available energy/capacity

    // Triggers and strategies
    sensoryTriggers: string[];
    contextTriggers: string[];
    strategies: string[];
    strategyEffectiveness?: 'helped' | 'no_change' | 'escalated'; // Outcome tracking

    // Additional data
    duration: number; // Duration of state in minutes
    note: string;

    // Computed metadata for analysis
    dayOfWeek?: DayOfWeek;
    timeOfDay?: TimeOfDay;
    hourOfDay?: number;
}

// ============================================
// CRISIS EVENTS - Meltdown/shutdown tracking
// ============================================
export type CrisisType = 'meltdown' | 'shutdown' | 'anxiety' | 'sensory_overload' | 'other';
export type CrisisResolution = 'self_regulated' | 'co_regulated' | 'timed_out' | 'interrupted' | 'other';

export interface CrisisEvent {
    id: string;
    timestamp: string;
    context: ContextType;

    // Crisis details
    type: CrisisType;
    durationSeconds: number;
    peakIntensity: number; // 1-10

    // Pre-crisis indicators
    precedingArousal?: number;
    precedingEnergy?: number;
    warningSignsObserved: string[];

    // Triggers identified
    sensoryTriggers: string[];
    contextTriggers: string[];

    // Intervention and resolution
    strategiesUsed: string[];
    resolution: CrisisResolution;

    // Audio/notes
    hasAudioRecording: boolean;
    audioUrl?: string;
    notes: string;

    // Post-crisis
    recoveryTimeMinutes?: number;

    // Metadata
    dayOfWeek?: DayOfWeek;
    timeOfDay?: TimeOfDay;
    hourOfDay?: number;
}

// ============================================
// SCHEDULE - Activity tracking
// ============================================
export type ActivityStatus = 'completed' | 'current' | 'upcoming' | 'skipped' | 'modified';

export interface ScheduleActivity {
    id: string;
    title: string;
    icon: string;
    scheduledStart: string; // HH:mm format
    scheduledEnd: string;
    durationMinutes: number;
}

export interface ScheduleEntry {
    id: string;
    date: string; // ISO date
    context: ContextType;
    activity: ScheduleActivity;

    // Actual execution
    status: ActivityStatus;
    actualStart?: string;
    actualEnd?: string;
    actualDurationMinutes?: number;

    // During activity tracking
    arousalDuringActivity?: number;
    energyAfterActivity?: number;

    // Transition tracking (important for special ed)
    transitionDifficulty?: number; // 1-10
    transitionSupport?: string[]; // Strategies used during transition

    notes?: string;
}

// Daily schedule template
export interface DailyScheduleTemplate {
    id: string;
    name: string;
    context: ContextType;
    dayOfWeek: DayOfWeek | 'all';
    activities: ScheduleActivity[];
}

// ============================================
// GOALS (IEP) - Progress tracking
// ============================================
export type GoalCategory = 'regulation' | 'social' | 'academic' | 'communication' | 'independence' | 'sensory';
export type GoalStatus = 'not_started' | 'in_progress' | 'on_track' | 'at_risk' | 'achieved' | 'discontinued';

export interface Goal {
    id: string;
    title: string;
    description: string;
    category: GoalCategory;

    // Targets
    targetValue: number;
    targetUnit: string; // 'minutes', 'times', 'percentage', etc.
    targetDirection: 'increase' | 'decrease' | 'maintain';

    // Timeline
    startDate: string;
    targetDate: string;

    // Current state
    currentValue: number;
    status: GoalStatus;

    // History for trend analysis
    progressHistory: GoalProgress[];

    notes?: string;
}

export interface GoalProgress {
    id: string;
    goalId: string;
    date: string;
    value: number;
    context: ContextType;
    notes?: string;
}

// ============================================
// PATTERNS & ANALYSIS (computed by LLM)
// ============================================
export interface AnalysisResult {
    id?: string;
    generatedAt?: string;
    dateRangeStart?: string;
    dateRangeEnd?: string;

    // Pattern findings
    triggerAnalysis: string;
    strategyEvaluation: string;
    interoceptionPatterns: string;

    // Correlations discovered
    correlations?: AnalysisCorrelation[];

    // Recommendations
    recommendations?: string[];

    summary: string;

    // Analysis type flag
    isDeepAnalysis?: boolean;
    modelUsed?: string;
}

export interface AnalysisCorrelation {
    factor1: string;
    factor2: string;
    relationship: string;
    strength: 'weak' | 'moderate' | 'strong';
    description: string;
}

// ============================================
// TRIGGER & STRATEGY OPTIONS
// ============================================
export type SensoryTrigger =
    | 'Auditiv'
    | 'Visuell'
    | 'Taktil'
    | 'Vestibulær'
    | 'Interosepsjon'
    | 'Lukt'
    | 'Smak'
    | 'Lys'
    | 'Temperatur'
    | 'Trengsel';

export type ContextTrigger =
    | 'Krav'
    | 'Overgang'
    | 'Sosialt'
    | 'Uventet Hendelse'
    | 'Sliten'
    | 'Sult'
    | 'Ventetid'
    | 'Gruppearbeid'
    | 'Prøve/Test'
    | 'Ny Situasjon';

export type Strategy =
    | 'Skjerming'
    | 'Dypt Trykk'
    | 'Samregulering'
    | 'Pusting'
    | 'Eget Rom'
    | 'Vektteppe'
    | 'Hodetelefoner'
    | 'Fidget'
    | 'Bevegelse'
    | 'Mørkt Rom'
    | 'Kjent Aktivitet'
    | 'Musikk'
    | 'Timer/Visuell Støtte';

export type WarningSign =
    | 'Økt motorisk uro'
    | 'Verbal eskalering'
    | 'Tilbaketrekning'
    | 'Repetitive bevegelser'
    | 'Dekker ører'
    | 'Unngår øyekontakt'
    | 'Rødme/svetting'
    | 'Klamrer seg'
    | 'Nekter instrukser'
    | 'Gråt';

export const SENSORY_TRIGGERS: SensoryTrigger[] = [
    'Auditiv', 'Visuell', 'Taktil', 'Vestibulær', 'Interosepsjon',
    'Lukt', 'Smak', 'Lys', 'Temperatur', 'Trengsel'
];

export const CONTEXT_TRIGGERS: ContextTrigger[] = [
    'Krav', 'Overgang', 'Sosialt', 'Uventet Hendelse', 'Sliten',
    'Sult', 'Ventetid', 'Gruppearbeid', 'Prøve/Test', 'Ny Situasjon'
];

export const STRATEGIES: Strategy[] = [
    'Skjerming', 'Dypt Trykk', 'Samregulering', 'Pusting', 'Eget Rom',
    'Vektteppe', 'Hodetelefoner', 'Fidget', 'Bevegelse', 'Mørkt Rom',
    'Kjent Aktivitet', 'Musikk', 'Timer/Visuell Støtte'
];

export const WARNING_SIGNS: WarningSign[] = [
    'Økt motorisk uro', 'Verbal eskalering', 'Tilbaketrekning',
    'Repetitive bevegelser', 'Dekker ører', 'Unngår øyekontakt',
    'Rødme/svetting', 'Klamrer seg', 'Nekter instrukser', 'Gråt'
];

export const CRISIS_TYPES: { value: CrisisType; label: string }[] = [
    { value: 'meltdown', label: 'Nedsmelting' },
    { value: 'shutdown', label: 'Shutdown/Stengning' },
    { value: 'anxiety', label: 'Angst/Panikk' },
    { value: 'sensory_overload', label: 'Sensorisk Overbelastning' },
    { value: 'other', label: 'Annet' }
];

export const GOAL_CATEGORIES: { value: GoalCategory; label: string }[] = [
    { value: 'regulation', label: 'Regulering' },
    { value: 'social', label: 'Sosiale Ferdigheter' },
    { value: 'academic', label: 'Akademisk' },
    { value: 'communication', label: 'Kommunikasjon' },
    { value: 'independence', label: 'Selvstendighet' },
    { value: 'sensory', label: 'Sensorisk' }
];

// ============================================
// CHILD PROFILE - For personalized AI analysis
// ============================================
export interface ChildProfile {
    id: string;
    name: string; // Display name (can be nickname for privacy)
    age?: number;

    // Diagnosis and characteristics
    diagnoses: string[]; // e.g., 'autism', 'adhd', 'anxiety'
    communicationStyle: 'verbal' | 'limited_verbal' | 'non_verbal' | 'aac';

    // Sensory profile
    sensorySensitivities: string[]; // Top sensory sensitivities
    seekingSensory: string[]; // Sensory seeking behaviors

    // Known effective strategies
    effectiveStrategies: string[];

    // Additional context for AI
    additionalContext?: string; // Free text for specific notes

    // Settings
    createdAt: string;
    updatedAt: string;
}

export const DIAGNOSIS_OPTIONS = [
    { value: 'autism', label: 'Autisme / ASF' },
    { value: 'adhd', label: 'ADHD' },
    { value: 'add', label: 'ADD' },
    { value: 'anxiety', label: 'Angst' },
    { value: 'sensory_processing', label: 'Sensorisk prosesseringsvansker' },
    { value: 'tourette', label: 'Tourettes syndrom' },
    { value: 'ocd', label: 'OCD' },
    { value: 'intellectual_disability', label: 'Utviklingshemming' },
    { value: 'language_disorder', label: 'Språkvansker' },
    { value: 'other', label: 'Annet' },
] as const;

export const COMMUNICATION_STYLES = [
    { value: 'verbal', label: 'Verbal (snakker flytende)' },
    { value: 'limited_verbal', label: 'Begrenset verbal (noen ord/fraser)' },
    { value: 'non_verbal', label: 'Non-verbal' },
    { value: 'aac', label: 'ASK/AAC (alternativ kommunikasjon)' },
] as const;

// ============================================
// UTILITY FUNCTIONS
// ============================================
export function getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
}

export function getTimeOfDay(date: Date): TimeOfDay {
    const hour = date.getHours();
    if (hour >= 5 && hour < 10) return 'morning';
    if (hour >= 10 && hour < 14) return 'midday';
    if (hour >= 14 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
}

export function enrichLogEntry(log: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>): LogEntry {
    const date = new Date(log.timestamp);
    return {
        ...log,
        dayOfWeek: getDayOfWeek(date),
        timeOfDay: getTimeOfDay(date),
        hourOfDay: date.getHours()
    };
}

export function enrichCrisisEvent(event: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'>): CrisisEvent {
    const date = new Date(event.timestamp);
    return {
        ...event,
        dayOfWeek: getDayOfWeek(date),
        timeOfDay: getTimeOfDay(date),
        hourOfDay: date.getHours()
    };
}
