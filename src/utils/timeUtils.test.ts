import { describe, it, expect } from 'vitest';

/**
 * Tests for time parsing safety patterns used across the codebase.
 * These patterns protect against null/undefined time strings.
 */

// Helper that mirrors the pattern used in VisualSchedule.tsx and DailyPlanComponents.tsx
const parseTimeString = (time: string | null | undefined): { hours: number; minutes: number } => {
    const [h, m] = (time || '00:00').split(':').map(Number);
    return { hours: h || 0, minutes: m || 0 };
};

// Helper that mirrors the pattern used in pdfGenerator.ts
const parseModelName = (modelUsed: string | undefined): string => {
    return modelUsed?.split('/')[1] ?? modelUsed ?? 'Unknown Model';
};

describe('Time String Parsing Safety', () => {
    it('parses valid time string', () => {
        const result = parseTimeString('14:30');
        expect(result.hours).toBe(14);
        expect(result.minutes).toBe(30);
    });

    it('handles empty string', () => {
        const result = parseTimeString('');
        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(0);
    });

    it('handles null', () => {
        const result = parseTimeString(null);
        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(0);
    });

    it('handles undefined', () => {
        const result = parseTimeString(undefined);
        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(0);
    });

    it('handles midnight correctly', () => {
        const result = parseTimeString('00:00');
        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(0);
    });

    it('handles end of day correctly', () => {
        const result = parseTimeString('23:59');
        expect(result.hours).toBe(23);
        expect(result.minutes).toBe(59);
    });
});

describe('Model Name Parsing Safety', () => {
    it('extracts model name from path', () => {
        const result = parseModelName('openrouter/grok-4');
        expect(result).toBe('grok-4');
    });

    it('returns full name when no slash', () => {
        const result = parseModelName('gemini-2.5-pro');
        expect(result).toBe('gemini-2.5-pro');
    });

    it('handles undefined', () => {
        const result = parseModelName(undefined);
        expect(result).toBe('Unknown Model');
    });

    it('handles empty string', () => {
        const result = parseModelName('');
        // Empty string is falsy but not null/undefined, so ?? returns the empty string
        // The actual pdfGenerator.ts code will display an empty model name
        expect(result).toBe('');
    });

    it('handles complex model paths', () => {
        const result = parseModelName('anthropic/claude-opus-4');
        expect(result).toBe('claude-opus-4');
    });

    it('handles multiple slashes', () => {
        const result = parseModelName('provider/model/version');
        expect(result).toBe('model');
    });
});
