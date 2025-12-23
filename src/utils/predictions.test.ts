import { describe, it, expect } from 'vitest';
import { calculateRiskForecast } from './predictions';
import type { LogEntry } from '../types';

describe('calculateRiskForecast', () => {
    it('returns low risk with empty logs', () => {
        const result = calculateRiskForecast([]);
        expect(result.level).toBe('low');
        expect(result.score).toBe(0);
        expect(result.contributingFactors).toEqual([]);
    });

    it('returns not enough data message with few logs', () => {
        const logs: LogEntry[] = [
            createMockLog(5, new Date()),
            createMockLog(3, new Date()),
        ];
        const result = calculateRiskForecast(logs);
        expect(result.level).toBe('low');
        expect(result.contributingFactors[0].key).toBe('risk.factors.notEnoughData');
    });

    it('detects high arousal patterns', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create 5 logs on same day of week within 30-day window, all with high arousal
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000)); // Same day of week, going back weeks
            logs.push(createMockLog(8, date)); // High arousal
        }

        const result = calculateRiskForecast(logs);
        expect(result.score).toBeGreaterThan(50);
    });

    it('only considers logs from the last 30 days', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create 5 logs at 35 days ago (should be excluded from analysis)
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (35 * 24 * 60 * 60 * 1000));
            date.setHours(date.getHours() + i); // Spread them out slightly
            logs.push(createMockLog(9, date)); // Very high arousal
        }

        const result = calculateRiskForecast(logs);
        // Should return not enough data since all logs are outside 30-day window
        expect(result.contributingFactors[0].key).toBe('risk.factors.notEnoughData');
    });

    it('returns calm period factor when arousal is low', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create 5 logs on same day of week with low arousal
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            logs.push(createMockLog(3, date)); // Low arousal
        }

        const result = calculateRiskForecast(logs);
        expect(result.level).toBe('low');
        expect(result.contributingFactors[0].key).toBe('risk.factors.calmPeriod');
    });
});

function createMockLog(arousal: number, timestamp: Date): LogEntry {
    return {
        id: crypto.randomUUID(),
        timestamp: timestamp.toISOString(),
        context: 'home',
        arousal,
        valence: 5,
        energy: 5,
        sensoryTriggers: [],
        contextTriggers: [],
        strategies: [],
        strategyEffectiveness: 'helped',
        duration: 30,
        note: '',
        dayOfWeek: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][timestamp.getDay()] as LogEntry['dayOfWeek'],
        timeOfDay: 'afternoon',
        hourOfDay: timestamp.getHours(),
    };
}

describe('calculateRiskForecast - Enhanced Features', () => {
    it('should apply recency weighting (recent data matters more)', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Old high arousal logs (should have less weight due to decay)
        for (let i = 0; i < 3; i++) {
            const date = new Date(now.getTime() - (25 * 24 * 60 * 60 * 1000)); // 25 days ago
            // Same day of week
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(date.getHours() + i);
            logs.push(createMockLog(9, date));
        }

        // Recent low arousal logs (should have more weight)
        for (let i = 0; i < 3; i++) {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000)); // Recent weeks
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            logs.push(createMockLog(3, date));
        }

        const result = calculateRiskForecast(logs);
        expect(result.recencyWeightedScore).toBeDefined();
        // Recent calm data should result in lower score
        expect(result.level).toBe('low');
    });

    it('should preserve raw score before capping', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create very high risk scenario that would exceed 100
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            // Set to current hour to trigger risk zone boost
            date.setHours(now.getHours());
            logs.push(createMockLog(10, date));
        }

        const result = calculateRiskForecast(logs);

        expect(result.score).toBeLessThanOrEqual(100);
        expect(result.rawScore).toBeDefined();
        // Raw score might exceed 100 with the boost
        expect(result.rawScore).toBeGreaterThanOrEqual(result.score);
    });

    it('should return confidence level based on sample size', () => {
        const now = new Date();

        // Low sample size (exactly 5 - minimum)
        const fewLogs = Array.from({ length: 5 }, (_, i) => {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            return createMockLog(5, date);
        });

        const lowResult = calculateRiskForecast(fewLogs);
        expect(lowResult.confidence).toBe('low');

        // High sample size (15+)
        const manyLogs = Array.from({ length: 15 }, (_, i) => {
            const date = new Date(now.getTime() - (Math.floor(i / 5) * 7 * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(date.getHours() + (i % 5));
            return createMockLog(5, date);
        });

        const highResult = calculateRiskForecast(manyLogs);
        expect(highResult.confidence).toBe('high');
    });

    it('should accept custom configuration', () => {
        const now = new Date();

        // Only 3 logs (below default min of 5)
        const logs = Array.from({ length: 3 }, (_, i) => {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            return createMockLog(8, date);
        });

        // With default config (5 min samples), should return not enough data
        const defaultResult = calculateRiskForecast(logs);
        expect(defaultResult.contributingFactors[0].key).toBe('risk.factors.notEnoughData');

        // With custom lower threshold, should work
        const customResult = calculateRiskForecast(logs, { minSamplesForPrediction: 3 });
        expect(customResult.contributingFactors[0].key).not.toBe('risk.factors.notEnoughData');
    });

    it('should provide hourly risk distribution', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create pattern at 14:00
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            date.setHours(14, 30, 0, 0);
            logs.push(createMockLog(8, date));
        }

        const result = calculateRiskForecast(logs);

        expect(result.hourlyRiskDistribution).toBeDefined();
        expect(result.hourlyRiskDistribution!.length).toBeGreaterThan(0);

        const hour14 = result.hourlyRiskDistribution!.find(h => h.hour === 14);
        expect(hour14).toBeDefined();
        expect(hour14!.incidentCount).toBe(5);
    });

    it('should include sample size in result', () => {
        const now = new Date();
        const logs = Array.from({ length: 8 }, (_, i) => {
            const date = new Date(now.getTime() - (7 * Math.floor(i / 2) * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            return createMockLog(5, date);
        });

        const result = calculateRiskForecast(logs);
        expect(result.sampleSize).toBeDefined();
        expect(result.sampleSize).toBeGreaterThan(0);
    });

    it('should use configurable thresholds for risk levels', () => {
        const now = new Date();
        const logs: LogEntry[] = [];

        // Create low arousal scenario (all below threshold)
        for (let i = 0; i < 5; i++) {
            const date = new Date(now.getTime() - (7 * i * 24 * 60 * 60 * 1000));
            while (date.getDay() !== now.getDay()) {
                date.setDate(date.getDate() - 1);
            }
            logs.push(createMockLog(5, date)); // All low arousal
        }

        // With default thresholds, low arousal should be 'low' risk
        const defaultResult = calculateRiskForecast(logs);
        expect(defaultResult.level).toBe('low');
        expect(defaultResult.score).toBe(0); // No high arousal events

        // Verify custom highArousalThreshold changes what counts as "high"
        const customResult = calculateRiskForecast(logs, {
            highArousalThreshold: 4 // Now arousal=5 is considered "high"
        });
        // With lower threshold, score should be higher
        expect(customResult.score).toBeGreaterThan(0);
    });
});
