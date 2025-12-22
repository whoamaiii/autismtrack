import { describe, it, expect } from 'vitest';
import {
    getDayOfWeek,
    getTimeOfDay,
    enrichLogEntry,
    enrichCrisisEvent,
    type LogEntry,
    type CrisisEvent
} from '../types';

describe('getDayOfWeek', () => {
    it('should return correct day of week', () => {
        // Sunday = 0 in JS Date
        expect(getDayOfWeek(new Date('2024-01-07'))).toBe('sunday');
        expect(getDayOfWeek(new Date('2024-01-08'))).toBe('monday');
        expect(getDayOfWeek(new Date('2024-01-09'))).toBe('tuesday');
        expect(getDayOfWeek(new Date('2024-01-10'))).toBe('wednesday');
        expect(getDayOfWeek(new Date('2024-01-11'))).toBe('thursday');
        expect(getDayOfWeek(new Date('2024-01-12'))).toBe('friday');
        expect(getDayOfWeek(new Date('2024-01-13'))).toBe('saturday');
    });
});

describe('getTimeOfDay', () => {
    it('should return morning for hours 5-9', () => {
        expect(getTimeOfDay(new Date('2024-01-01T05:00:00'))).toBe('morning');
        expect(getTimeOfDay(new Date('2024-01-01T09:59:59'))).toBe('morning');
    });

    it('should return midday for hours 10-13', () => {
        expect(getTimeOfDay(new Date('2024-01-01T10:00:00'))).toBe('midday');
        expect(getTimeOfDay(new Date('2024-01-01T13:59:59'))).toBe('midday');
    });

    it('should return afternoon for hours 14-17', () => {
        expect(getTimeOfDay(new Date('2024-01-01T14:00:00'))).toBe('afternoon');
        expect(getTimeOfDay(new Date('2024-01-01T17:59:59'))).toBe('afternoon');
    });

    it('should return evening for hours 18-21', () => {
        expect(getTimeOfDay(new Date('2024-01-01T18:00:00'))).toBe('evening');
        expect(getTimeOfDay(new Date('2024-01-01T21:59:59'))).toBe('evening');
    });

    it('should return night for hours 22-4', () => {
        expect(getTimeOfDay(new Date('2024-01-01T22:00:00'))).toBe('night');
        expect(getTimeOfDay(new Date('2024-01-01T00:00:00'))).toBe('night');
        expect(getTimeOfDay(new Date('2024-01-01T04:59:59'))).toBe('night');
    });
});

describe('enrichLogEntry', () => {
    // Create a timestamp in local time to avoid timezone issues
    const now = new Date();
    now.setHours(14, 30, 0, 0); // Set to 14:30 local time
    // Find a Monday
    while (now.getDay() !== 1) {
        now.setDate(now.getDate() + 1);
    }

    const baseLog: Omit<LogEntry, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        timestamp: now.toISOString(), // Local Monday afternoon
        context: 'school',
        arousal: 5,
        valence: 6,
        energy: 4,
        sensoryTriggers: ['Auditiv'],
        contextTriggers: ['Krav'],
        strategies: ['Skjerming'],
        duration: 30,
        note: 'Test note'
    };

    it('should add computed fields for valid timestamp', () => {
        const enriched = enrichLogEntry(baseLog);

        expect(enriched.dayOfWeek).toBe('monday');
        expect(enriched.timeOfDay).toBe('afternoon');
        expect(enriched.hourOfDay).toBe(14);
    });

    it('should preserve all original fields', () => {
        const enriched = enrichLogEntry(baseLog);

        expect(enriched.id).toBe(baseLog.id);
        expect(enriched.timestamp).toBe(baseLog.timestamp);
        expect(enriched.context).toBe(baseLog.context);
        expect(enriched.arousal).toBe(baseLog.arousal);
        expect(enriched.note).toBe(baseLog.note);
    });

    it('should use fallback date for invalid timestamp', () => {
        const invalidLog = { ...baseLog, timestamp: 'not-a-valid-date' };
        const enriched = enrichLogEntry(invalidLog);

        // Should not be NaN - should use current date as fallback
        expect(enriched.hourOfDay).not.toBeNaN();
        expect(enriched.dayOfWeek).toBeDefined();
        expect(enriched.timeOfDay).toBeDefined();
    });

    it('should handle edge case timestamps', () => {
        // Midnight in local time
        const midnightDate = new Date();
        midnightDate.setHours(0, 0, 0, 0);
        const midnightLog = { ...baseLog, timestamp: midnightDate.toISOString() };
        const enrichedMidnight = enrichLogEntry(midnightLog);
        expect(enrichedMidnight.hourOfDay).toBe(0);
        expect(enrichedMidnight.timeOfDay).toBe('night');

        // End of day in local time
        const eodDate = new Date();
        eodDate.setHours(23, 59, 59, 0);
        const eodLog = { ...baseLog, timestamp: eodDate.toISOString() };
        const enrichedEod = enrichLogEntry(eodLog);
        expect(enrichedEod.hourOfDay).toBe(23);
        expect(enrichedEod.timeOfDay).toBe('night');
    });
});

describe('enrichCrisisEvent', () => {
    // Create a timestamp in local time to avoid timezone issues
    const tuesdayMidDay = new Date();
    tuesdayMidDay.setHours(10, 15, 0, 0); // Set to 10:15 local time
    // Find a Tuesday
    while (tuesdayMidDay.getDay() !== 2) {
        tuesdayMidDay.setDate(tuesdayMidDay.getDate() + 1);
    }

    const baseCrisis: Omit<CrisisEvent, 'dayOfWeek' | 'timeOfDay' | 'hourOfDay'> = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        timestamp: tuesdayMidDay.toISOString(), // Tuesday midday local time
        context: 'school',
        type: 'meltdown',
        durationSeconds: 300,
        peakIntensity: 8,
        warningSignsObserved: ['Økt motorisk uro'],
        sensoryTriggers: ['Auditiv'],
        contextTriggers: ['Overgang'],
        strategiesUsed: ['Skjerming'],
        resolution: 'co_regulated',
        hasAudioRecording: false,
        notes: 'Test crisis'
    };

    it('should add computed fields for valid timestamp', () => {
        const enriched = enrichCrisisEvent(baseCrisis);

        expect(enriched.dayOfWeek).toBe('tuesday');
        expect(enriched.timeOfDay).toBe('midday');
        expect(enriched.hourOfDay).toBe(10);
    });

    it('should use fallback date for invalid timestamp', () => {
        const invalidCrisis = { ...baseCrisis, timestamp: 'invalid' };
        const enriched = enrichCrisisEvent(invalidCrisis);

        // Should not be NaN
        expect(enriched.hourOfDay).not.toBeNaN();
        expect(enriched.dayOfWeek).toBeDefined();
    });

    it('should preserve all original fields', () => {
        const enriched = enrichCrisisEvent(baseCrisis);

        expect(enriched.id).toBe(baseCrisis.id);
        expect(enriched.type).toBe(baseCrisis.type);
        expect(enriched.peakIntensity).toBe(baseCrisis.peakIntensity);
        expect(enriched.resolution).toBe(baseCrisis.resolution);
    });
});
