/**
 * Context Comparison Analysis
 * Compare behavioral patterns between home and school contexts
 */

import type {
    LogEntry,
    CrisisEvent,
    ContextType,
    ContextComparison,
    ContextMetrics,
    ContextDifference,
    TriggerStat,
    StrategyStat,
    HourlyArousal,
    ConfidenceLevel
} from '../types';
import {
    DEFAULT_CONTEXT_COMPARISON_CONFIG,
    type ContextComparisonConfig
} from './analysisConfig';

// ============================================
// METRIC CALCULATION
// ============================================

/**
 * Calculate metrics for a specific context
 */
export function calculateContextMetrics(
    logs: LogEntry[],
    crisisEvents: CrisisEvent[],
    context: ContextType,
    config: Partial<ContextComparisonConfig> = {}
): ContextMetrics {
    const cfg = { ...DEFAULT_CONTEXT_COMPARISON_CONFIG, ...config };

    const contextLogs = logs.filter(l => l.context === context);
    const contextCrises = crisisEvents.filter(c => c.context === context);

    if (contextLogs.length === 0) {
        return {
            logCount: 0,
            crisisCount: contextCrises.length,
            avgArousal: 0,
            avgEnergy: 0,
            avgValence: 0,
            topTriggers: [],
            topStrategies: [],
            peakArousalTimes: [],
            crisisFrequencyPerDay: 0
        };
    }

    // Basic averages
    const avgArousal = contextLogs.reduce((sum, l) => sum + l.arousal, 0) / contextLogs.length;
    const avgEnergy = contextLogs.reduce((sum, l) => sum + l.energy, 0) / contextLogs.length;
    const avgValence = contextLogs.reduce((sum, l) => sum + l.valence, 0) / contextLogs.length;

    // Trigger analysis
    const triggerCounts = new Map<string, number>();
    contextLogs.forEach(log => {
        [...log.sensoryTriggers, ...log.contextTriggers].forEach(trigger => {
            triggerCounts.set(trigger, (triggerCounts.get(trigger) || 0) + 1);
        });
    });

    const topTriggers: TriggerStat[] = Array.from(triggerCounts.entries())
        .map(([trigger, count]) => ({
            trigger,
            count,
            percentage: Math.round((count / contextLogs.length) * 100)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, cfg.topTriggersLimit);

    // Strategy analysis with success rates
    const strategyStats = new Map<string, { total: number; helped: number }>();
    contextLogs.forEach(log => {
        log.strategies.forEach(strategy => {
            const existing = strategyStats.get(strategy) || { total: 0, helped: 0 };
            existing.total++;
            if (log.strategyEffectiveness === 'helped') {
                existing.helped++;
            }
            strategyStats.set(strategy, existing);
        });
    });

    const topStrategies: StrategyStat[] = Array.from(strategyStats.entries())
        .map(([strategy, stats]) => ({
            strategy,
            count: stats.total,
            successRate: stats.total > 0 ? Math.round((stats.helped / stats.total) * 100) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, cfg.topStrategiesLimit);

    // Hourly arousal patterns
    const hourlyData = new Map<number, { totalArousal: number; count: number }>();
    contextLogs.forEach(log => {
        const hour = log.hourOfDay ?? new Date(log.timestamp).getHours();
        const existing = hourlyData.get(hour) || { totalArousal: 0, count: 0 };
        existing.totalArousal += log.arousal;
        existing.count++;
        hourlyData.set(hour, existing);
    });

    const peakArousalTimes: HourlyArousal[] = Array.from(hourlyData.entries())
        .map(([hour, data]) => ({
            hour,
            avgArousal: Math.round((data.totalArousal / data.count) * 10) / 10,
            logCount: data.count
        }))
        .sort((a, b) => b.avgArousal - a.avgArousal);

    // Crisis frequency
    const uniqueDays = new Set(contextLogs.map(l =>
        new Date(l.timestamp).toISOString().split('T')[0]
    ));
    const crisisFrequencyPerDay = uniqueDays.size > 0
        ? Math.round((contextCrises.length / uniqueDays.size) * 100) / 100
        : 0;

    return {
        logCount: contextLogs.length,
        crisisCount: contextCrises.length,
        avgArousal: Math.round(avgArousal * 10) / 10,
        avgEnergy: Math.round(avgEnergy * 10) / 10,
        avgValence: Math.round(avgValence * 10) / 10,
        topTriggers,
        topStrategies,
        peakArousalTimes,
        crisisFrequencyPerDay
    };
}

// ============================================
// STATISTICAL COMPARISON
// ============================================

/**
 * Welch's t-test for comparing two samples with different variances
 * Returns approximate p-value
 */
function welchTTest(
    values1: number[],
    values2: number[]
): { tStatistic: number; pValue: number; significant: boolean } {
    if (values1.length < 2 || values2.length < 2) {
        return { tStatistic: 0, pValue: 1, significant: false };
    }

    const n1 = values1.length;
    const n2 = values2.length;

    const mean1 = values1.reduce((a, b) => a + b, 0) / n1;
    const mean2 = values2.reduce((a, b) => a + b, 0) / n2;

    const var1 = values1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) / (n1 - 1);
    const var2 = values2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) / (n2 - 1);

    const se = Math.sqrt(var1 / n1 + var2 / n2);

    if (se === 0) {
        return { tStatistic: 0, pValue: 1, significant: false };
    }

    const tStatistic = (mean1 - mean2) / se;

    // Approximate p-value using normal distribution for large samples
    const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

    return {
        tStatistic,
        pValue,
        significant: pValue < 0.05
    };
}

/**
 * Approximate normal CDF using Abramowitz and Stegun approximation
 */
function normalCDF(x: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
}

// ============================================
// DIFFERENCE DETECTION
// ============================================

/**
 * Find statistically significant differences between contexts
 */
export function findSignificantDifferences(
    homeLogs: LogEntry[],
    schoolLogs: LogEntry[],
    homeMetrics: ContextMetrics,
    schoolMetrics: ContextMetrics,
    config: Partial<ContextComparisonConfig> = {}
): ContextDifference[] {
    const cfg = { ...DEFAULT_CONTEXT_COMPARISON_CONFIG, ...config };
    const differences: ContextDifference[] = [];

    // Compare arousal
    const homeArousals = homeLogs.map(l => l.arousal);
    const schoolArousals = schoolLogs.map(l => l.arousal);
    const arousalTest = welchTTest(homeArousals, schoolArousals);

    if (arousalTest.significant) {
        const diff = Math.abs(homeMetrics.avgArousal - schoolMetrics.avgArousal);
        const higher = homeMetrics.avgArousal > schoolMetrics.avgArousal ? 'hjemme' : 'skole';
        differences.push({
            metric: 'avgArousal',
            homeValue: homeMetrics.avgArousal,
            schoolValue: schoolMetrics.avgArousal,
            significance: getSignificanceLevel(arousalTest.pValue, diff),
            insight: `Arousal er signifikant høyere ${higher} (${diff.toFixed(1)} forskjell)`
        });
    }

    // Compare energy
    const homeEnergies = homeLogs.map(l => l.energy);
    const schoolEnergies = schoolLogs.map(l => l.energy);
    const energyTest = welchTTest(homeEnergies, schoolEnergies);

    if (energyTest.significant) {
        const diff = Math.abs(homeMetrics.avgEnergy - schoolMetrics.avgEnergy);
        const lower = homeMetrics.avgEnergy < schoolMetrics.avgEnergy ? 'hjemme' : 'skole';
        differences.push({
            metric: 'avgEnergy',
            homeValue: homeMetrics.avgEnergy,
            schoolValue: schoolMetrics.avgEnergy,
            significance: getSignificanceLevel(energyTest.pValue, diff),
            insight: `Energi er signifikant lavere ${lower} (${diff.toFixed(1)} forskjell)`
        });
    }

    // Compare crisis frequency (using percentage difference)
    if (homeMetrics.crisisCount > 0 || schoolMetrics.crisisCount > 0) {
        const homeCrisisRate = homeMetrics.crisisFrequencyPerDay;
        const schoolCrisisRate = schoolMetrics.crisisFrequencyPerDay;
        const rateRatio = homeCrisisRate > 0 && schoolCrisisRate > 0
            ? Math.max(homeCrisisRate, schoolCrisisRate) / Math.min(homeCrisisRate, schoolCrisisRate)
            : 0;

        if (rateRatio >= 2) { // 2x or more difference
            const higher = homeCrisisRate > schoolCrisisRate ? 'hjemme' : 'skole';
            differences.push({
                metric: 'crisisFrequency',
                homeValue: homeCrisisRate,
                schoolValue: schoolCrisisRate,
                significance: rateRatio >= 3 ? 'high' : 'medium',
                insight: `Krisehendelser er ${rateRatio.toFixed(1)}x mer hyppig ${higher}`
            });
        }
    }

    // Compare top triggers (find context-specific triggers)
    const homeTriggerSet = new Set(homeMetrics.topTriggers.map(t => t.trigger));
    const schoolTriggerSet = new Set(schoolMetrics.topTriggers.map(t => t.trigger));

    const homeOnlyTriggers = homeMetrics.topTriggers.filter(t =>
        !schoolTriggerSet.has(t.trigger) && t.percentage >= cfg.significantDifferenceThreshold
    );
    const schoolOnlyTriggers = schoolMetrics.topTriggers.filter(t =>
        !homeTriggerSet.has(t.trigger) && t.percentage >= cfg.significantDifferenceThreshold
    );

    if (homeOnlyTriggers.length > 0) {
        differences.push({
            metric: 'uniqueTriggers',
            homeValue: homeOnlyTriggers.map(t => t.trigger).join(', '),
            schoolValue: '-',
            significance: 'medium',
            insight: `Triggere som hovedsakelig forekommer hjemme: ${homeOnlyTriggers.map(t => t.trigger).join(', ')}`
        });
    }

    if (schoolOnlyTriggers.length > 0) {
        differences.push({
            metric: 'uniqueTriggers',
            homeValue: '-',
            schoolValue: schoolOnlyTriggers.map(t => t.trigger).join(', '),
            significance: 'medium',
            insight: `Triggere som hovedsakelig forekommer på skole: ${schoolOnlyTriggers.map(t => t.trigger).join(', ')}`
        });
    }

    // Compare strategy effectiveness
    homeMetrics.topStrategies.forEach(homeStrat => {
        const schoolStrat = schoolMetrics.topStrategies.find(s => s.strategy === homeStrat.strategy);
        if (schoolStrat) {
            const diff = Math.abs(homeStrat.successRate - schoolStrat.successRate);
            if (diff >= cfg.significantDifferenceThreshold) {
                const better = homeStrat.successRate > schoolStrat.successRate ? 'hjemme' : 'skole';
                differences.push({
                    metric: 'strategyEffectiveness',
                    homeValue: `${homeStrat.successRate}%`,
                    schoolValue: `${schoolStrat.successRate}%`,
                    significance: diff >= 30 ? 'high' : 'medium',
                    insight: `${homeStrat.strategy} fungerer bedre ${better} (${diff}% forskjell)`
                });
            }
        }
    });

    return differences;
}

function getSignificanceLevel(pValue: number, difference: number): ConfidenceLevel {
    if (pValue < 0.01 && difference >= 1.5) return 'high';
    if (pValue < 0.05 && difference >= 1) return 'medium';
    return 'low';
}

// ============================================
// MAIN COMPARISON FUNCTION
// ============================================

/**
 * Calculate complete context comparison
 */
export function calculateContextComparison(
    logs: LogEntry[],
    crisisEvents: CrisisEvent[],
    config: Partial<ContextComparisonConfig> = {}
): ContextComparison | null {
    const cfg = { ...DEFAULT_CONTEXT_COMPARISON_CONFIG, ...config };

    const homeLogs = logs.filter(l => l.context === 'home');
    const schoolLogs = logs.filter(l => l.context === 'school');

    // Need minimum data in each context
    if (homeLogs.length < cfg.minLogsPerContext || schoolLogs.length < cfg.minLogsPerContext) {
        return null;
    }

    const homeMetrics = calculateContextMetrics(logs, crisisEvents, 'home', config);
    const schoolMetrics = calculateContextMetrics(logs, crisisEvents, 'school', config);

    const significantDifferences = findSignificantDifferences(
        homeLogs,
        schoolLogs,
        homeMetrics,
        schoolMetrics,
        config
    );

    // Calculate date range
    const allTimestamps = logs.map(l => new Date(l.timestamp).getTime());
    const minDate = new Date(Math.min(...allTimestamps)).toISOString();
    const maxDate = new Date(Math.max(...allTimestamps)).toISOString();

    return {
        home: homeMetrics,
        school: schoolMetrics,
        significantDifferences,
        dateRange: {
            start: minDate,
            end: maxDate
        }
    };
}

/**
 * Get comparison summary text
 */
export function getComparisonSummary(comparison: ContextComparison | null): string {
    if (!comparison) {
        return 'Ikke nok data i begge kontekster for sammenligning. Logg både hjemme og på skole for bedre innsikt.';
    }

    if (comparison.significantDifferences.length === 0) {
        return 'Ingen signifikante forskjeller funnet mellom hjemme og skole. Mønstrene er relativt like i begge kontekster.';
    }

    const highDiffs = comparison.significantDifferences.filter(d => d.significance === 'high');
    const mediumDiffs = comparison.significantDifferences.filter(d => d.significance === 'medium');

    let summary = `Funnet ${comparison.significantDifferences.length} forskjeller:\n`;

    if (highDiffs.length > 0) {
        summary += `\nViktige funn:\n`;
        highDiffs.forEach(d => {
            summary += `• ${d.insight}\n`;
        });
    }

    if (mediumDiffs.length > 0) {
        summary += `\nAndre forskjeller:\n`;
        mediumDiffs.slice(0, 3).forEach(d => {
            summary += `• ${d.insight}\n`;
        });
    }

    return summary;
}
