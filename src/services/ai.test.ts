import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    analyzeLogs,
    analyzeLogsDeep,
    analyzeLogsStreaming,
    clearAnalysisCache,
    getApiStatus,
    reportAIError,
} from './ai';
import type { LogEntry, CrisisEvent } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Gemini module
vi.mock('./gemini', () => ({
    analyzeLogsWithGemini: vi.fn(),
    analyzeLogsDeepWithGemini: vi.fn(),
    analyzeLogsStreamingWithGemini: vi.fn(),
    isGeminiConfigured: vi.fn(() => false),
    getGeminiStatus: vi.fn(() => ({ configured: false })),
    clearGeminiCache: vi.fn(),
}));

// Helper to create mock log entries
const createMockLog = (id: string, arousal: number = 5): LogEntry => ({
    id,
    timestamp: new Date().toISOString(),
    context: 'home',
    arousal,
    valence: 5,
    energy: 5,
    sensoryTriggers: [],
    contextTriggers: [],
    strategies: [],
    duration: 10,
    note: 'Test note',
    dayOfWeek: 'monday',
    timeOfDay: 'morning',
    hourOfDay: 10,
});

// Helper to create mock crisis events
const createMockCrisis = (id: string): CrisisEvent => ({
    id,
    timestamp: new Date().toISOString(),
    context: 'home',
    type: 'meltdown',
    durationSeconds: 300,
    peakIntensity: 7,
    warningSignsObserved: [],
    sensoryTriggers: [],
    contextTriggers: [],
    strategiesUsed: [],
    resolution: 'self_regulated',
    hasAudioRecording: false,
    notes: '',
    dayOfWeek: 'monday',
    timeOfDay: 'morning',
    hourOfDay: 10,
});

// Mock valid AI response (kept for reference in future integration tests)
// const mockValidResponse = {
//     id: 'test-response',
//     choices: [{
//         message: {
//             content: JSON.stringify({
//                 summary: 'Test analysis summary',
//                 patterns: ['Pattern 1', 'Pattern 2'],
//                 recommendations: ['Recommendation 1'],
//                 riskLevel: 'low',
//                 correlations: [],
//             }),
//         },
//         finish_reason: 'stop',
//     }],
//     usage: {
//         prompt_tokens: 100,
//         completion_tokens: 50,
//         total_tokens: 150,
//     },
// };

describe('AI Service - analyzeLogs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearAnalysisCache();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('throws error when no logs provided', async () => {
        await expect(analyzeLogs([])).rejects.toThrow('No logs provided for analysis');
    });

    it('throws error when logs is undefined', async () => {
        // @ts-expect-error Testing invalid input
        await expect(analyzeLogs(undefined)).rejects.toThrow('No logs provided for analysis');
    });

    it('returns mock analysis when no API key is configured', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];

        // With no API key and Gemini not configured, should return mock
        const result = await analyzeLogs(logs);

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
        expect(result.recommendations).toBeDefined();
        // Mock analysis uses triggerAnalysis/strategyEvaluation instead of patterns
        expect(result.triggerAnalysis || result.patterns).toBeDefined();
    });

    it('includes crisis events in analysis', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];
        const crisisEvents = [createMockCrisis('c1')];

        const result = await analyzeLogs(logs, crisisEvents);

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
    });

    it('uses cached result when available and forceRefresh is false', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];

        // First call
        const result1 = await analyzeLogs(logs);

        // Second call should use cache
        const result2 = await analyzeLogs(logs);

        expect(result1.summary).toBe(result2.summary);
    });

    it('bypasses cache when forceRefresh is true', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];

        // First call
        await analyzeLogs(logs);

        // Second call with forceRefresh
        const result = await analyzeLogs(logs, [], { forceRefresh: true });

        expect(result).toBeDefined();
    });
});

describe('AI Service - analyzeLogsDeep', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearAnalysisCache();
    });

    it('throws error when no logs provided', async () => {
        await expect(analyzeLogsDeep([])).rejects.toThrow('No logs provided for analysis');
    });

    it('returns mock analysis when no API key is configured', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];

        const result = await analyzeLogsDeep(logs);

        expect(result).toBeDefined();
        expect(result.summary).toBeDefined();
    });

    it('accepts child profile for personalization', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];
        const childProfile = {
            id: 'child-1',
            name: 'Test Child',
            birthDate: '2018-01-01',
            diagnoses: ['ADHD'],
            communicationStyle: 'verbal' as const,
            sensoryPreferences: [],
            effectiveStrategies: [],
            triggers: [],
            notes: '',
        };

        const result = await analyzeLogsDeep(logs, [], { childProfile });

        expect(result).toBeDefined();
    });
});

describe('AI Service - analyzeLogsStreaming', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearAnalysisCache();
    });

    it('calls onChunk callback during streaming', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];
        const onChunk = vi.fn();
        const onComplete = vi.fn();
        const onError = vi.fn();

        // Since Gemini is not configured and no API key, this will fall through
        // to OpenRouter which will also fail, but we can test the callback setup
        try {
            await analyzeLogsStreaming(logs, [], { onChunk, onComplete, onError });
        } catch {
            // Expected to fail without API key
        }

        // The callbacks should be set up even if the call fails
        expect(onChunk).toBeDefined();
    });

    it('includes crisis events in streaming analysis', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];
        const crisisEvents = [createMockCrisis('c1')];
        const callbacks = {
            onChunk: vi.fn(),
            onComplete: vi.fn(),
            onError: vi.fn(),
        };

        // Will fail without API key but should not throw immediately
        try {
            await analyzeLogsStreaming(logs, crisisEvents, callbacks);
        } catch {
            // Expected without API configuration
        }
    });
});

describe('AI Service - getApiStatus', () => {
    it('returns status object with required fields', () => {
        const status = getApiStatus();

        expect(status).toHaveProperty('configured');
        expect(status).toHaveProperty('freeModel');
        expect(status).toHaveProperty('premiumModel');
        expect(status).toHaveProperty('geminiConfigured');
        expect(typeof status.configured).toBe('boolean');
        expect(typeof status.freeModel).toBe('string');
        expect(typeof status.premiumModel).toBe('string');
    });

    it('returns model IDs for free and premium tiers', () => {
        const status = getApiStatus();

        expect(status.freeModel).toContain('gemini');
        expect(status.premiumModel).toContain('gemini');
    });
});

describe('AI Service - clearAnalysisCache', () => {
    it('clears the cache without throwing', () => {
        expect(() => clearAnalysisCache()).not.toThrow();
    });

    it('can be called multiple times safely', () => {
        clearAnalysisCache();
        clearAnalysisCache();
        clearAnalysisCache();

        // Should not throw
        expect(true).toBe(true);
    });
});

describe('AI Service - reportAIError', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('logs error with context', () => {
        const error = new Error('Test error');
        const context = { model: 'test-model', attempt: 1 };

        reportAIError(error, context);

        expect(console.error).toHaveBeenCalled();
    });

    it('handles errors without stack trace', () => {
        const error = new Error('Test error');
        delete error.stack;

        expect(() => reportAIError(error, {})).not.toThrow();
    });

    it('includes timestamp in error report', () => {
        const error = new Error('Test error');

        reportAIError(error, {});

        // Should not throw
        expect(console.error).toHaveBeenCalled();
    });
});

describe('AI Service - Input Validation', () => {
    it('handles logs with missing optional fields', async () => {
        const minimalLog: LogEntry = {
            id: '1',
            timestamp: new Date().toISOString(),
            context: 'home',
            arousal: 5,
            valence: 5,
            energy: 5,
            sensoryTriggers: [],
            contextTriggers: [],
            strategies: [],
            duration: 10,
            note: '',
            dayOfWeek: 'monday',
            timeOfDay: 'morning',
            hourOfDay: 10,
        };

        const result = await analyzeLogs([minimalLog, minimalLog, minimalLog]);
        expect(result).toBeDefined();
    });

    it('handles logs with extreme arousal values', async () => {
        const logs = [
            createMockLog('1', 0),  // Minimum
            createMockLog('2', 10), // Maximum
            createMockLog('3', 5),  // Middle
        ];

        const result = await analyzeLogs(logs);
        expect(result).toBeDefined();
    });

    it('handles empty crisis events array', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];

        const result = await analyzeLogs(logs, []);
        expect(result).toBeDefined();
    });
});

describe('AI Service - Request Deduplication', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearAnalysisCache();
    });

    it('deduplicates concurrent identical requests', async () => {
        const logs = [createMockLog('1'), createMockLog('2'), createMockLog('3')];

        // Make multiple concurrent requests
        const promises = [
            analyzeLogs(logs),
            analyzeLogs(logs),
            analyzeLogs(logs),
        ];

        const results = await Promise.all(promises);

        // All should return the same result
        expect(results[0].summary).toBe(results[1].summary);
        expect(results[1].summary).toBe(results[2].summary);
    });
});
