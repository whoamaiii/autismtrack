import { describe, it, expect } from 'vitest';
import {
    // Utility functions
    getDayOfWeek,
    getTimeOfDay,
    enrichLogEntry,
    enrichCrisisEvent,
    // Types (only import those that are actually used in tests)
    type ContextType,
    type LogEntry,
    type CrisisEvent,
    type CrisisType,
    type CrisisResolution,
    type ActivityStatus,
    type ScheduleActivity,
    type GoalCategory,
    type GoalStatus,
    type Goal,
    type AnalysisResult,
    type ChildProfile,
    type PatternFactorType,
    type PatternOutcome,
    type ConfidenceLevel,
    type MultiFactorPattern,
    type RecoveryAnalysis,
    // Constants
    SENSORY_TRIGGERS,
    CONTEXT_TRIGGERS,
    STRATEGIES,
    WARNING_SIGNS,
    CRISIS_TYPES,
    GOAL_CATEGORIES,
    DIAGNOSIS_OPTIONS,
    COMMUNICATION_STYLES,
} from './types';

// ============================================
// UTILITY FUNCTION TESTS
// ============================================

describe('getDayOfWeek', () => {
    it('returns correct day of week for all days', () => {
        // Sunday = 0 in JS Date
        expect(getDayOfWeek(new Date('2024-01-07'))).toBe('sunday');
        expect(getDayOfWeek(new Date('2024-01-08'))).toBe('monday');
        expect(getDayOfWeek(new Date('2024-01-09'))).toBe('tuesday');
        expect(getDayOfWeek(new Date('2024-01-10'))).toBe('wednesday');
        expect(getDayOfWeek(new Date('2024-01-11'))).toBe('thursday');
        expect(getDayOfWeek(new Date('2024-01-12'))).toBe('friday');
        expect(getDayOfWeek(new Date('2024-01-13'))).toBe('saturday');
    });

    it('handles dates with time components', () => {
        const dateWithTime = new Date('2024-01-08T15:30:45');
        expect(getDayOfWeek(dateWithTime)).toBe('monday');
    });

    it('handles edge of day transitions', () => {
        // Just before midnight on Sunday
        const almostMidnight = new Date('2024-01-07T23:59:59');
        expect(getDayOfWeek(almostMidnight)).toBe('sunday');

        // Just after midnight on Monday
        const justAfterMidnight = new Date('2024-01-08T00:00:01');
        expect(getDayOfWeek(justAfterMidnight)).toBe('monday');
    });
});

describe('getTimeOfDay', () => {
    describe('morning (5:00 - 9:59)', () => {
        it('returns morning at 5:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T05:00:00'))).toBe('morning');
        });

        it('returns morning at 9:59', () => {
            expect(getTimeOfDay(new Date('2024-01-01T09:59:59'))).toBe('morning');
        });

        it('returns morning in the middle of the range', () => {
            expect(getTimeOfDay(new Date('2024-01-01T07:30:00'))).toBe('morning');
        });
    });

    describe('midday (10:00 - 13:59)', () => {
        it('returns midday at 10:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T10:00:00'))).toBe('midday');
        });

        it('returns midday at 13:59', () => {
            expect(getTimeOfDay(new Date('2024-01-01T13:59:59'))).toBe('midday');
        });
    });

    describe('afternoon (14:00 - 17:59)', () => {
        it('returns afternoon at 14:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T14:00:00'))).toBe('afternoon');
        });

        it('returns afternoon at 17:59', () => {
            expect(getTimeOfDay(new Date('2024-01-01T17:59:59'))).toBe('afternoon');
        });
    });

    describe('evening (18:00 - 21:59)', () => {
        it('returns evening at 18:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T18:00:00'))).toBe('evening');
        });

        it('returns evening at 21:59', () => {
            expect(getTimeOfDay(new Date('2024-01-01T21:59:59'))).toBe('evening');
        });
    });

    describe('night (22:00 - 4:59)', () => {
        it('returns night at 22:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T22:00:00'))).toBe('night');
        });

        it('returns night at midnight', () => {
            expect(getTimeOfDay(new Date('2024-01-01T00:00:00'))).toBe('night');
        });

        it('returns night at 4:59', () => {
            expect(getTimeOfDay(new Date('2024-01-01T04:59:59'))).toBe('night');
        });

        it('returns night at 3:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T03:00:00'))).toBe('night');
        });
    });

    describe('boundary transitions', () => {
        it('transitions from night to morning at 5:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T04:59:59'))).toBe('night');
            expect(getTimeOfDay(new Date('2024-01-01T05:00:00'))).toBe('morning');
        });

        it('transitions from morning to midday at 10:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T09:59:59'))).toBe('morning');
            expect(getTimeOfDay(new Date('2024-01-01T10:00:00'))).toBe('midday');
        });

        it('transitions from midday to afternoon at 14:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T13:59:59'))).toBe('midday');
            expect(getTimeOfDay(new Date('2024-01-01T14:00:00'))).toBe('afternoon');
        });

        it('transitions from afternoon to evening at 18:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T17:59:59'))).toBe('afternoon');
            expect(getTimeOfDay(new Date('2024-01-01T18:00:00'))).toBe('evening');
        });

        it('transitions from evening to night at 22:00', () => {
            expect(getTimeOfDay(new Date('2024-01-01T21:59:59'))).toBe('evening');
            expect(getTimeOfDay(new Date('2024-01-01T22:00:00'))).toBe('night');
        });
    });
});

describe('enrichLogEntry', () => {
    const createBaseLog = (timestamp: string): Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> => ({
        id: '123e4567-e89b-12d3-a456-426614174000',
        timestamp,
        context: 'school',
        arousal: 5,
        valence: 6,
        energy: 4,
        sensoryTriggers: ['auditory'],
        contextTriggers: ['demands'],
        strategies: ['shielding'],
        duration: 30,
        note: 'Test note'
    });

    it('adds computed fields for valid timestamp', () => {
        // Create a Monday at 14:30 local time
        const monday = new Date();
        monday.setHours(14, 30, 0, 0);
        while (monday.getDay() !== 1) {
            monday.setDate(monday.getDate() + 1);
        }

        const baseLog = createBaseLog(monday.toISOString());
        const enriched = enrichLogEntry(baseLog);

        expect(enriched.dayOfWeek).toBe('monday');
        expect(enriched.timeOfDay).toBe('afternoon');
        expect(enriched.hourOfDay).toBe(14);
    });

    it('preserves all original fields', () => {
        const monday = new Date();
        monday.setHours(14, 30, 0, 0);
        while (monday.getDay() !== 1) {
            monday.setDate(monday.getDate() + 1);
        }

        const baseLog = createBaseLog(monday.toISOString());
        const enriched = enrichLogEntry(baseLog);

        expect(enriched.id).toBe(baseLog.id);
        expect(enriched.timestamp).toBe(baseLog.timestamp);
        expect(enriched.context).toBe(baseLog.context);
        expect(enriched.arousal).toBe(baseLog.arousal);
        expect(enriched.valence).toBe(baseLog.valence);
        expect(enriched.energy).toBe(baseLog.energy);
        expect(enriched.sensoryTriggers).toEqual(baseLog.sensoryTriggers);
        expect(enriched.contextTriggers).toEqual(baseLog.contextTriggers);
        expect(enriched.strategies).toEqual(baseLog.strategies);
        expect(enriched.duration).toBe(baseLog.duration);
        expect(enriched.note).toBe(baseLog.note);
    });

    it('uses fallback date for invalid timestamp', () => {
        const invalidLog = createBaseLog('not-a-valid-date');
        const enriched = enrichLogEntry(invalidLog);

        // Should not be NaN - should use current date as fallback
        expect(enriched.hourOfDay).not.toBeNaN();
        expect(enriched.dayOfWeek).toBeDefined();
        expect(enriched.timeOfDay).toBeDefined();
        expect(typeof enriched.hourOfDay).toBe('number');
    });

    it('handles empty string timestamp', () => {
        const invalidLog = createBaseLog('');
        const enriched = enrichLogEntry(invalidLog);

        expect(enriched.hourOfDay).not.toBeNaN();
        expect(enriched.dayOfWeek).toBeDefined();
    });

    it('handles midnight timestamp', () => {
        const midnightDate = new Date();
        midnightDate.setHours(0, 0, 0, 0);

        const midnightLog = createBaseLog(midnightDate.toISOString());
        const enriched = enrichLogEntry(midnightLog);

        expect(enriched.hourOfDay).toBe(0);
        expect(enriched.timeOfDay).toBe('night');
    });

    it('handles end of day timestamp', () => {
        const eodDate = new Date();
        eodDate.setHours(23, 59, 59, 0);

        const eodLog = createBaseLog(eodDate.toISOString());
        const enriched = enrichLogEntry(eodLog);

        expect(enriched.hourOfDay).toBe(23);
        expect(enriched.timeOfDay).toBe('night');
    });

    it('handles strategyEffectiveness optional field', () => {
        const monday = new Date();
        monday.setHours(14, 30, 0, 0);
        while (monday.getDay() !== 1) {
            monday.setDate(monday.getDate() + 1);
        }

        const logWithEffectiveness: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
            ...createBaseLog(monday.toISOString()),
            strategyEffectiveness: 'helped'
        };

        const enriched = enrichLogEntry(logWithEffectiveness);
        expect(enriched.strategyEffectiveness).toBe('helped');
    });
});

describe('enrichCrisisEvent', () => {
    const createBaseCrisis = (timestamp: string): Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> => ({
        id: '123e4567-e89b-12d3-a456-426614174001',
        timestamp,
        context: 'school',
        type: 'meltdown',
        durationSeconds: 300,
        peakIntensity: 8,
        warningSignsObserved: ['motor_restlessness'],
        sensoryTriggers: ['auditory'],
        contextTriggers: ['transition'],
        strategiesUsed: ['shielding'],
        resolution: 'co_regulated',
        hasAudioRecording: false,
        notes: 'Test crisis'
    });

    it('adds computed fields for valid timestamp', () => {
        // Create a Tuesday at 10:15 local time
        const tuesday = new Date();
        tuesday.setHours(10, 15, 0, 0);
        while (tuesday.getDay() !== 2) {
            tuesday.setDate(tuesday.getDate() + 1);
        }

        const baseCrisis = createBaseCrisis(tuesday.toISOString());
        const enriched = enrichCrisisEvent(baseCrisis);

        expect(enriched.dayOfWeek).toBe('tuesday');
        expect(enriched.timeOfDay).toBe('midday');
        expect(enriched.hourOfDay).toBe(10);
    });

    it('preserves all original fields', () => {
        const tuesday = new Date();
        tuesday.setHours(10, 15, 0, 0);
        while (tuesday.getDay() !== 2) {
            tuesday.setDate(tuesday.getDate() + 1);
        }

        const baseCrisis = createBaseCrisis(tuesday.toISOString());
        const enriched = enrichCrisisEvent(baseCrisis);

        expect(enriched.id).toBe(baseCrisis.id);
        expect(enriched.type).toBe(baseCrisis.type);
        expect(enriched.durationSeconds).toBe(baseCrisis.durationSeconds);
        expect(enriched.peakIntensity).toBe(baseCrisis.peakIntensity);
        expect(enriched.resolution).toBe(baseCrisis.resolution);
        expect(enriched.warningSignsObserved).toEqual(baseCrisis.warningSignsObserved);
        expect(enriched.sensoryTriggers).toEqual(baseCrisis.sensoryTriggers);
        expect(enriched.contextTriggers).toEqual(baseCrisis.contextTriggers);
        expect(enriched.strategiesUsed).toEqual(baseCrisis.strategiesUsed);
        expect(enriched.hasAudioRecording).toBe(baseCrisis.hasAudioRecording);
        expect(enriched.notes).toBe(baseCrisis.notes);
    });

    it('uses fallback date for invalid timestamp', () => {
        const invalidCrisis = createBaseCrisis('invalid');
        const enriched = enrichCrisisEvent(invalidCrisis);

        expect(enriched.hourOfDay).not.toBeNaN();
        expect(enriched.dayOfWeek).toBeDefined();
        expect(enriched.timeOfDay).toBeDefined();
    });

    it('handles optional fields', () => {
        const tuesday = new Date();
        tuesday.setHours(10, 15, 0, 0);
        while (tuesday.getDay() !== 2) {
            tuesday.setDate(tuesday.getDate() + 1);
        }

        const crisisWithOptionals: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
            ...createBaseCrisis(tuesday.toISOString()),
            precedingArousal: 7,
            precedingEnergy: 3,
            audioUrl: 'https://example.com/audio.mp3',
            recoveryTimeMinutes: 15
        };

        const enriched = enrichCrisisEvent(crisisWithOptionals);

        expect(enriched.precedingArousal).toBe(7);
        expect(enriched.precedingEnergy).toBe(3);
        expect(enriched.audioUrl).toBe('https://example.com/audio.mp3');
        expect(enriched.recoveryTimeMinutes).toBe(15);
    });
});

// ============================================
// CONSTANT ARRAY TESTS
// ============================================

describe('SENSORY_TRIGGERS', () => {
    it('contains expected sensory triggers', () => {
        expect(SENSORY_TRIGGERS).toContain('auditory');
        expect(SENSORY_TRIGGERS).toContain('visual');
        expect(SENSORY_TRIGGERS).toContain('tactile');
        expect(SENSORY_TRIGGERS).toContain('vestibular');
        expect(SENSORY_TRIGGERS).toContain('interoception');
        expect(SENSORY_TRIGGERS).toContain('smell');
        expect(SENSORY_TRIGGERS).toContain('taste');
        expect(SENSORY_TRIGGERS).toContain('light');
        expect(SENSORY_TRIGGERS).toContain('temperature');
        expect(SENSORY_TRIGGERS).toContain('crowding');
    });

    it('has exactly 10 triggers', () => {
        expect(SENSORY_TRIGGERS).toHaveLength(10);
    });

    it('is an array of strings', () => {
        expect(Array.isArray(SENSORY_TRIGGERS)).toBe(true);
        SENSORY_TRIGGERS.forEach(trigger => {
            expect(typeof trigger).toBe('string');
        });
    });
});

describe('CONTEXT_TRIGGERS', () => {
    it('contains expected context triggers', () => {
        expect(CONTEXT_TRIGGERS).toContain('demands');
        expect(CONTEXT_TRIGGERS).toContain('transition');
        expect(CONTEXT_TRIGGERS).toContain('social');
        expect(CONTEXT_TRIGGERS).toContain('unexpected_event');
        expect(CONTEXT_TRIGGERS).toContain('tired');
        expect(CONTEXT_TRIGGERS).toContain('hungry');
        expect(CONTEXT_TRIGGERS).toContain('waiting');
        expect(CONTEXT_TRIGGERS).toContain('group_work');
        expect(CONTEXT_TRIGGERS).toContain('test');
        expect(CONTEXT_TRIGGERS).toContain('new_situation');
    });

    it('has exactly 10 triggers', () => {
        expect(CONTEXT_TRIGGERS).toHaveLength(10);
    });
});

describe('STRATEGIES', () => {
    it('contains expected strategies', () => {
        expect(STRATEGIES).toContain('shielding');
        expect(STRATEGIES).toContain('deep_pressure');
        expect(STRATEGIES).toContain('co_regulation');
        expect(STRATEGIES).toContain('breathing');
        expect(STRATEGIES).toContain('own_room');
        expect(STRATEGIES).toContain('weighted_blanket');
        expect(STRATEGIES).toContain('headphones');
        expect(STRATEGIES).toContain('fidget');
        expect(STRATEGIES).toContain('movement');
        expect(STRATEGIES).toContain('dark_room');
        expect(STRATEGIES).toContain('familiar_activity');
        expect(STRATEGIES).toContain('music');
        expect(STRATEGIES).toContain('timer_visual_support');
    });

    it('has exactly 13 strategies', () => {
        expect(STRATEGIES).toHaveLength(13);
    });
});

describe('WARNING_SIGNS', () => {
    it('contains expected warning signs', () => {
        expect(WARNING_SIGNS).toContain('motor_restlessness');
        expect(WARNING_SIGNS).toContain('verbal_escalation');
        expect(WARNING_SIGNS).toContain('withdrawal');
        expect(WARNING_SIGNS).toContain('repetitive_movements');
        expect(WARNING_SIGNS).toContain('covers_ears');
        expect(WARNING_SIGNS).toContain('avoids_eye_contact');
        expect(WARNING_SIGNS).toContain('flushing_sweating');
        expect(WARNING_SIGNS).toContain('clinging');
        expect(WARNING_SIGNS).toContain('refuses_instructions');
        expect(WARNING_SIGNS).toContain('crying');
    });

    it('has exactly 10 warning signs', () => {
        expect(WARNING_SIGNS).toHaveLength(10);
    });
});

describe('CRISIS_TYPES', () => {
    it('contains all crisis types with labels', () => {
        expect(CRISIS_TYPES).toHaveLength(5);

        const values = CRISIS_TYPES.map(ct => ct.value);
        expect(values).toContain('meltdown');
        expect(values).toContain('shutdown');
        expect(values).toContain('anxiety');
        expect(values).toContain('sensory_overload');
        expect(values).toContain('other');
    });

    it('has value and label for each entry', () => {
        CRISIS_TYPES.forEach(crisisType => {
            expect(crisisType).toHaveProperty('value');
            expect(crisisType).toHaveProperty('label');
            expect(typeof crisisType.value).toBe('string');
            expect(typeof crisisType.label).toBe('string');
            expect(crisisType.label.length).toBeGreaterThan(0);
        });
    });
});

describe('GOAL_CATEGORIES', () => {
    it('contains all goal categories with labels', () => {
        expect(GOAL_CATEGORIES).toHaveLength(6);

        const values = GOAL_CATEGORIES.map(gc => gc.value);
        expect(values).toContain('regulation');
        expect(values).toContain('social');
        expect(values).toContain('academic');
        expect(values).toContain('communication');
        expect(values).toContain('independence');
        expect(values).toContain('sensory');
    });

    it('has value and label for each entry', () => {
        GOAL_CATEGORIES.forEach(category => {
            expect(category).toHaveProperty('value');
            expect(category).toHaveProperty('label');
            expect(typeof category.value).toBe('string');
            expect(typeof category.label).toBe('string');
        });
    });
});

describe('DIAGNOSIS_OPTIONS', () => {
    it('contains expected diagnosis options', () => {
        const values = DIAGNOSIS_OPTIONS.map(d => d.value);
        expect(values).toContain('autism');
        expect(values).toContain('adhd');
        expect(values).toContain('add');
        expect(values).toContain('anxiety');
        expect(values).toContain('sensory_processing');
        expect(values).toContain('tourette');
        expect(values).toContain('ocd');
        expect(values).toContain('intellectual_disability');
        expect(values).toContain('language_disorder');
        expect(values).toContain('other');
    });

    it('has exactly 10 diagnosis options', () => {
        expect(DIAGNOSIS_OPTIONS).toHaveLength(10);
    });

    it('has value and label for each entry', () => {
        DIAGNOSIS_OPTIONS.forEach(diagnosis => {
            expect(diagnosis).toHaveProperty('value');
            expect(diagnosis).toHaveProperty('label');
            expect(typeof diagnosis.value).toBe('string');
            expect(typeof diagnosis.label).toBe('string');
        });
    });
});

describe('COMMUNICATION_STYLES', () => {
    it('contains all communication styles', () => {
        expect(COMMUNICATION_STYLES).toHaveLength(4);

        const values = COMMUNICATION_STYLES.map(cs => cs.value);
        expect(values).toContain('verbal');
        expect(values).toContain('limited_verbal');
        expect(values).toContain('non_verbal');
        expect(values).toContain('aac');
    });

    it('has value and label for each entry', () => {
        COMMUNICATION_STYLES.forEach(style => {
            expect(style).toHaveProperty('value');
            expect(style).toHaveProperty('label');
            expect(typeof style.value).toBe('string');
            expect(typeof style.label).toBe('string');
        });
    });
});

// ============================================
// TYPE VALIDITY TESTS
// ============================================

describe('Type Validation', () => {
    describe('ContextType', () => {
        it('accepts valid context types', () => {
            const validContexts: ContextType[] = ['home', 'school'];
            expect(validContexts).toHaveLength(2);
        });
    });

    describe('CrisisType', () => {
        it('matches CRISIS_TYPES values', () => {
            const crisisTypeValues: CrisisType[] = ['meltdown', 'shutdown', 'anxiety', 'sensory_overload', 'other'];
            const constantValues = CRISIS_TYPES.map(ct => ct.value);
            expect(crisisTypeValues).toEqual(constantValues);
        });
    });

    describe('CrisisResolution', () => {
        it('accepts valid resolution types', () => {
            const validResolutions: CrisisResolution[] = [
                'self_regulated',
                'co_regulated',
                'timed_out',
                'interrupted',
                'other'
            ];
            expect(validResolutions).toHaveLength(5);
        });
    });

    describe('ActivityStatus', () => {
        it('accepts valid activity statuses', () => {
            const validStatuses: ActivityStatus[] = [
                'completed',
                'current',
                'upcoming',
                'skipped',
                'modified'
            ];
            expect(validStatuses).toHaveLength(5);
        });
    });

    describe('GoalCategory', () => {
        it('matches GOAL_CATEGORIES values', () => {
            const categoryValues: GoalCategory[] = [
                'regulation',
                'social',
                'academic',
                'communication',
                'independence',
                'sensory'
            ];
            const constantValues = GOAL_CATEGORIES.map(gc => gc.value);
            expect(categoryValues).toEqual(constantValues);
        });
    });

    describe('GoalStatus', () => {
        it('accepts valid goal statuses', () => {
            const validStatuses: GoalStatus[] = [
                'not_started',
                'in_progress',
                'on_track',
                'at_risk',
                'achieved',
                'discontinued'
            ];
            expect(validStatuses).toHaveLength(6);
        });
    });

    describe('PatternFactorType', () => {
        it('accepts valid pattern factor types', () => {
            const validTypes: PatternFactorType[] = [
                'time',
                'energy',
                'trigger',
                'context',
                'transition',
                'strategy'
            ];
            expect(validTypes).toHaveLength(6);
        });
    });

    describe('PatternOutcome', () => {
        it('accepts valid pattern outcomes', () => {
            const validOutcomes: PatternOutcome[] = [
                'high_arousal',
                'crisis',
                'escalation',
                'recovery'
            ];
            expect(validOutcomes).toHaveLength(4);
        });
    });

    describe('ConfidenceLevel', () => {
        it('accepts valid confidence levels', () => {
            const validLevels: ConfidenceLevel[] = ['low', 'medium', 'high'];
            expect(validLevels).toHaveLength(3);
        });
    });
});

// ============================================
// INTERFACE STRUCTURE TESTS
// ============================================

describe('Interface Structure Tests', () => {
    describe('LogEntry', () => {
        it('can create a valid LogEntry', () => {
            const logEntry: LogEntry = {
                id: 'test-id',
                timestamp: new Date().toISOString(),
                context: 'home',
                arousal: 5,
                valence: 6,
                energy: 4,
                sensoryTriggers: ['auditory'],
                contextTriggers: ['demands'],
                strategies: ['breathing'],
                duration: 30,
                note: 'Test note',
                dayOfWeek: 'monday',
                timeOfDay: 'morning',
                hourOfDay: 9
            };

            expect(logEntry.id).toBe('test-id');
            expect(logEntry.context).toBe('home');
            expect(logEntry.arousal).toBeGreaterThanOrEqual(1);
            expect(logEntry.arousal).toBeLessThanOrEqual(10);
        });
    });

    describe('CrisisEvent', () => {
        it('can create a valid CrisisEvent', () => {
            const crisis: CrisisEvent = {
                id: 'crisis-id',
                timestamp: new Date().toISOString(),
                context: 'school',
                type: 'meltdown',
                durationSeconds: 120,
                peakIntensity: 8,
                warningSignsObserved: ['motor_restlessness'],
                sensoryTriggers: ['auditory'],
                contextTriggers: ['transition'],
                strategiesUsed: ['shielding'],
                resolution: 'co_regulated',
                hasAudioRecording: false,
                notes: 'Crisis note',
                dayOfWeek: 'tuesday',
                timeOfDay: 'midday',
                hourOfDay: 11
            };

            expect(crisis.type).toBe('meltdown');
            expect(crisis.resolution).toBe('co_regulated');
            expect(crisis.peakIntensity).toBeLessThanOrEqual(10);
        });
    });

    describe('ScheduleActivity', () => {
        it('can create a valid ScheduleActivity', () => {
            const activity: ScheduleActivity = {
                id: 'activity-id',
                title: 'Math class',
                icon: 'calculator',
                scheduledStart: '09:00',
                scheduledEnd: '10:00',
                durationMinutes: 60
            };

            expect(activity.title).toBe('Math class');
            expect(activity.durationMinutes).toBe(60);
        });
    });

    describe('Goal', () => {
        it('can create a valid Goal', () => {
            const goal: Goal = {
                id: 'goal-id',
                title: 'Improve self-regulation',
                description: 'Use breathing exercises when feeling overwhelmed',
                category: 'regulation',
                targetValue: 80,
                targetUnit: 'percentage',
                targetDirection: 'increase',
                startDate: '2024-01-01',
                targetDate: '2024-06-01',
                currentValue: 50,
                status: 'in_progress',
                progressHistory: []
            };

            expect(goal.category).toBe('regulation');
            expect(goal.targetDirection).toBe('increase');
            expect(goal.status).toBe('in_progress');
        });
    });

    describe('ChildProfile', () => {
        it('can create a valid ChildProfile', () => {
            const profile: ChildProfile = {
                id: 'child-id',
                name: 'Test Child',
                age: 8,
                diagnoses: ['autism', 'adhd'],
                communicationStyle: 'verbal',
                sensorySensitivities: ['auditory', 'tactile'],
                seekingSensory: ['vestibular'],
                effectiveStrategies: ['weighted_blanket', 'headphones'],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            expect(profile.name).toBe('Test Child');
            expect(profile.communicationStyle).toBe('verbal');
            expect(profile.diagnoses).toContain('autism');
        });
    });

    describe('AnalysisResult', () => {
        it('can create a valid AnalysisResult', () => {
            const analysis: AnalysisResult = {
                triggerAnalysis: 'Auditory triggers are most common',
                strategyEvaluation: 'Breathing exercises show good results',
                interoceptionPatterns: 'Energy dips noted in afternoon',
                summary: 'Overall improvement observed'
            };

            expect(analysis.triggerAnalysis).toBeTruthy();
            expect(analysis.summary).toBeTruthy();
        });

        it('can include optional fields', () => {
            const analysis: AnalysisResult = {
                id: 'analysis-id',
                generatedAt: new Date().toISOString(),
                dateRangeStart: '2024-01-01',
                dateRangeEnd: '2024-01-31',
                triggerAnalysis: 'Analysis text',
                strategyEvaluation: 'Evaluation text',
                interoceptionPatterns: 'Pattern text',
                correlations: [
                    {
                        factor1: 'auditory',
                        factor2: 'high_arousal',
                        relationship: 'positive',
                        strength: 'strong',
                        description: 'Auditory triggers correlate with high arousal'
                    }
                ],
                recommendations: ['Use headphones in noisy environments'],
                summary: 'Summary text',
                isDeepAnalysis: true,
                modelUsed: 'gemini-2.5-pro'
            };

            expect(analysis.isDeepAnalysis).toBe(true);
            expect(analysis.correlations).toHaveLength(1);
            expect(analysis.recommendations).toHaveLength(1);
        });
    });

    describe('MultiFactorPattern', () => {
        it('can create a valid MultiFactorPattern', () => {
            const pattern: MultiFactorPattern = {
                id: 'pattern-id',
                factors: [
                    {
                        type: 'time',
                        value: 'afternoon',
                        operator: 'equals',
                        label: 'Time of day'
                    },
                    {
                        type: 'energy',
                        value: 3,
                        operator: 'less_than',
                        label: 'Low energy'
                    }
                ],
                outcome: 'high_arousal',
                occurrenceCount: 15,
                totalOccasions: 50,
                probability: 0.3,
                pValue: 0.05,
                confidence: 'high',
                description: 'Low energy afternoons lead to high arousal'
            };

            expect(pattern.factors).toHaveLength(2);
            expect(pattern.confidence).toBe('high');
            expect(pattern.probability).toBe(0.3);
        });
    });

    describe('RecoveryAnalysis', () => {
        it('can create a valid RecoveryAnalysis', () => {
            const recovery: RecoveryAnalysis = {
                avgRecoveryTime: 25,
                recoveryTrend: 'improving',
                factorsAcceleratingRecovery: [],
                factorsDelayingRecovery: [],
                vulnerabilityWindow: {
                    durationMinutes: 30,
                    elevatedRiskPeriod: 15,
                    recommendedBuffer: 45,
                    reEscalationRate: 0.2
                },
                recoveryByType: {
                    meltdown: {
                        avgMinutes: 30,
                        minMinutes: 10,
                        maxMinutes: 60,
                        medianMinutes: 25,
                        count: 10,
                        trend: 'stable'
                    }
                },
                totalCrisesAnalyzed: 20,
                crisesWithRecoveryData: 15
            };

            expect(recovery.recoveryTrend).toBe('improving');
            expect(recovery.vulnerabilityWindow.durationMinutes).toBe(30);
        });
    });
});
