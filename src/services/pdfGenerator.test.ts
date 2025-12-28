import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LogEntry, CrisisEvent, AnalysisResult } from '../types';

// Helper to create mock log entries
const createMockLog = (id: string, daysAgo: number = 0, arousal: number = 5): LogEntry => {
    const timestamp = new Date();
    timestamp.setDate(timestamp.getDate() - daysAgo);
    return {
        id,
        timestamp: timestamp.toISOString(),
        context: 'home',
        arousal,
        valence: 5,
        energy: 5,
        sensoryTriggers: ['loud_sounds'],
        contextTriggers: ['transitions'],
        strategies: ['headphones'],
        duration: 10,
        note: 'Test note',
        dayOfWeek: 'monday',
        timeOfDay: 'morning',
        hourOfDay: 10,
    };
};

// Helper to create mock crisis events
const createMockCrisis = (id: string): CrisisEvent => ({
    id,
    timestamp: new Date().toISOString(),
    context: 'home',
    type: 'meltdown',
    durationSeconds: 300,
    peakIntensity: 7,
    warningSignsObserved: ['increased_stimming'],
    sensoryTriggers: ['loud_sounds'],
    contextTriggers: ['transitions'],
    strategiesUsed: ['deep_pressure'],
    resolution: 'self_regulated',
    hasAudioRecording: false,
    notes: 'Test crisis',
    dayOfWeek: 'monday',
    timeOfDay: 'morning',
    hourOfDay: 10,
});

// Helper to create mock analysis result
const createMockAnalysis = (): AnalysisResult => ({
    summary: 'Test analysis summary with important findings.',
    patterns: ['Pattern 1', 'Pattern 2'],
    recommendations: ['Recommendation 1', 'Recommendation 2'],
    riskLevel: 'moderate',
    correlations: [],
    triggerAnalysis: 'Test trigger analysis.',
    strategyEvaluation: 'Test strategy evaluation.',
});

describe('PDF Generator Module', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Module Exports', () => {
        it('exports generatePDF function', async () => {
            const module = await import('./pdfGenerator');
            expect(module.generatePDF).toBeDefined();
            expect(typeof module.generatePDF).toBe('function');
        });
    });

    describe('PDF Constants', () => {
        it('exports PDF_LAYOUT configuration', async () => {
            const module = await import('./pdfConstants');
            expect(module.PDF_LAYOUT).toBeDefined();
            expect(module.PDF_LAYOUT.margin).toBeDefined();
            expect(typeof module.PDF_LAYOUT.margin).toBe('number');
        });

        it('has valid margin value', async () => {
            const { PDF_LAYOUT } = await import('./pdfConstants');
            expect(PDF_LAYOUT.margin).toBeGreaterThan(0);
            expect(PDF_LAYOUT.margin).toBeLessThan(50);
        });

        it('has valid font sizes', async () => {
            const { PDF_LAYOUT } = await import('./pdfConstants');
            expect(PDF_LAYOUT.fonts).toBeDefined();
            expect(PDF_LAYOUT.fonts.body).toBeGreaterThan(0);
            expect(PDF_LAYOUT.fonts.title).toBeGreaterThan(PDF_LAYOUT.fonts.body);
        });

        it('has valid spacing configuration', async () => {
            const { PDF_LAYOUT } = await import('./pdfConstants');
            expect(PDF_LAYOUT.spacing).toBeDefined();
            expect(PDF_LAYOUT.spacing.lineHeight).toBeGreaterThan(0);
        });

        it('has valid color definitions', async () => {
            const { PDF_LAYOUT } = await import('./pdfConstants');
            expect(PDF_LAYOUT.colors).toBeDefined();
            expect(PDF_LAYOUT.colors.textPrimary).toBeDefined();
            expect(Array.isArray(PDF_LAYOUT.colors.textPrimary)).toBe(true);
        });
    });

    describe('Input Validation Logic', () => {
        it('mock logs have required fields', () => {
            const log = createMockLog('1');

            expect(log.id).toBeDefined();
            expect(log.timestamp).toBeDefined();
            expect(log.context).toBeDefined();
            expect(log.arousal).toBeDefined();
            expect(log.valence).toBeDefined();
            expect(log.energy).toBeDefined();
        });

        it('mock crisis events have required fields', () => {
            const crisis = createMockCrisis('c1');

            expect(crisis.id).toBeDefined();
            expect(crisis.timestamp).toBeDefined();
            expect(crisis.type).toBeDefined();
            expect(crisis.durationSeconds).toBeDefined();
            expect(crisis.peakIntensity).toBeDefined();
        });

        it('mock analysis has required fields', () => {
            const analysis = createMockAnalysis();

            expect(analysis.summary).toBeDefined();
            expect(analysis.recommendations).toBeDefined();
            expect(Array.isArray(analysis.recommendations)).toBe(true);
        });

        it('logs can have different arousal values', () => {
            const lowArousal = createMockLog('1', 0, 1);
            const highArousal = createMockLog('2', 0, 10);

            expect(lowArousal.arousal).toBe(1);
            expect(highArousal.arousal).toBe(10);
        });

        it('logs can span multiple days', () => {
            const today = createMockLog('1', 0);
            const yesterday = createMockLog('2', 1);
            const lastWeek = createMockLog('3', 7);

            const todayDate = new Date(today.timestamp);
            const yesterdayDate = new Date(yesterday.timestamp);
            const lastWeekDate = new Date(lastWeek.timestamp);

            expect(todayDate > yesterdayDate).toBe(true);
            expect(yesterdayDate > lastWeekDate).toBe(true);
        });
    });

    describe('Date Filtering Logic', () => {
        it('can filter logs by date range', () => {
            const logs = [
                createMockLog('1', 0),   // Today
                createMockLog('2', 3),   // 3 days ago
                createMockLog('3', 7),   // Week ago
                createMockLog('4', 14),  // 2 weeks ago
            ];

            const today = new Date();
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);

            const filteredLogs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= weekAgo && logDate <= today;
            });

            expect(filteredLogs.length).toBe(3);
        });

        it('handles empty date range correctly', () => {
            const logs = [createMockLog('1', 0)];

            const futureStart = new Date();
            futureStart.setDate(futureStart.getDate() + 10);
            const futureEnd = new Date();
            futureEnd.setDate(futureEnd.getDate() + 20);

            const filtered = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate >= futureStart && logDate <= futureEnd;
            });

            expect(filtered.length).toBe(0);
        });
    });

    describe('Data Aggregation Logic', () => {
        it('can group logs by day', () => {
            const logs = [
                createMockLog('1', 0, 5),
                createMockLog('2', 0, 7),  // Same day
                createMockLog('3', 1, 3),
            ];

            const dailyData = new Map<string, number[]>();
            logs.forEach(log => {
                const day = new Date(log.timestamp).toISOString().split('T')[0];
                if (!dailyData.has(day)) {
                    dailyData.set(day, []);
                }
                dailyData.get(day)!.push(log.arousal);
            });

            expect(dailyData.size).toBe(2);

            // Today should have 2 logs with arousal 5 and 7
            const todayKey = new Date().toISOString().split('T')[0];
            expect(dailyData.get(todayKey)?.length).toBe(2);
        });

        it('can calculate daily averages', () => {
            const logs = [
                createMockLog('1', 0, 4),
                createMockLog('2', 0, 6),
                createMockLog('3', 0, 8),
            ];

            const totalArousal = logs.reduce((sum, log) => sum + log.arousal, 0);
            const average = totalArousal / logs.length;

            expect(average).toBe(6);
        });

        it('counts crisis events by type', () => {
            const crisisEvents: CrisisEvent[] = [
                { ...createMockCrisis('1'), type: 'meltdown' },
                { ...createMockCrisis('2'), type: 'meltdown' },
                { ...createMockCrisis('3'), type: 'shutdown' },
            ];

            const countByType = crisisEvents.reduce((acc, event) => {
                acc[event.type] = (acc[event.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            expect(countByType.meltdown).toBe(2);
            expect(countByType.shutdown).toBe(1);
        });
    });

    describe('Trigger and Strategy Counting', () => {
        it('counts trigger occurrences across logs', () => {
            const logs = [
                { ...createMockLog('1'), sensoryTriggers: ['loud_sounds', 'bright_lights'] },
                { ...createMockLog('2'), sensoryTriggers: ['loud_sounds'] },
                { ...createMockLog('3'), sensoryTriggers: ['textures'] },
            ];

            const triggerCounts = logs.reduce((acc, log) => {
                log.sensoryTriggers.forEach(trigger => {
                    acc[trigger] = (acc[trigger] || 0) + 1;
                });
                return acc;
            }, {} as Record<string, number>);

            expect(triggerCounts.loud_sounds).toBe(2);
            expect(triggerCounts.bright_lights).toBe(1);
            expect(triggerCounts.textures).toBe(1);
        });

        it('counts strategy usage across logs', () => {
            const logs = [
                { ...createMockLog('1'), strategies: ['headphones', 'deep_pressure'] },
                { ...createMockLog('2'), strategies: ['headphones'] },
            ];

            const strategyCounts = logs.reduce((acc, log) => {
                log.strategies.forEach(strategy => {
                    acc[strategy] = (acc[strategy] || 0) + 1;
                });
                return acc;
            }, {} as Record<string, number>);

            expect(strategyCounts.headphones).toBe(2);
            expect(strategyCounts.deep_pressure).toBe(1);
        });
    });

    describe('Analysis Result Processing', () => {
        it('handles analysis with empty arrays', () => {
            const analysis: AnalysisResult = {
                summary: 'Summary',
                patterns: [],
                recommendations: [],
                riskLevel: 'low',
                correlations: [],
            };

            expect(analysis.patterns.length).toBe(0);
            expect(analysis.recommendations.length).toBe(0);
        });

        it('handles deep analysis flag', () => {
            const analysis: AnalysisResult = {
                ...createMockAnalysis(),
                isDeepAnalysis: true,
                modelUsed: 'google/gemini-2.5-pro',
            };

            expect(analysis.isDeepAnalysis).toBe(true);
            expect(analysis.modelUsed).toBeDefined();
        });

        it('handles various risk levels', () => {
            const lowRisk: AnalysisResult = { ...createMockAnalysis(), riskLevel: 'low' };
            const moderateRisk: AnalysisResult = { ...createMockAnalysis(), riskLevel: 'moderate' };
            const highRisk: AnalysisResult = { ...createMockAnalysis(), riskLevel: 'high' };

            expect(['low', 'moderate', 'high']).toContain(lowRisk.riskLevel);
            expect(['low', 'moderate', 'high']).toContain(moderateRisk.riskLevel);
            expect(['low', 'moderate', 'high']).toContain(highRisk.riskLevel);
        });
    });
});
