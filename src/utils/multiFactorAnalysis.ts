/**
 * Multi-Factor Pattern Analysis
 * Detects complex patterns like "high arousal occurs WHEN energy < 4 AND time = afternoon"
 */

import type {
    LogEntry,
    CrisisEvent,
    MultiFactorPattern,
    PatternFactor,
    StrategyComboEffectiveness,
    PatternOutcome,
    ConfidenceLevel,
    TimeOfDay
} from '../types';
import {
    DEFAULT_MULTI_FACTOR_CONFIG,
    type MultiFactorConfig
} from './analysisConfig';

// ============================================
// FACTOR EXTRACTION
// ============================================

interface ExtractedFactors {
    timeOfDay: TimeOfDay;
    hourBucket: 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: string;
    isWeekend: boolean;
    energyLevel: 'low' | 'moderate' | 'high';
    energyValue: number;
    arousalLevel: 'low' | 'moderate' | 'high';
    context: 'home' | 'school';
    sensoryTriggers: string[];
    contextTriggers: string[];
    strategies: string[];
    hasTransitionTrigger: boolean;
}

function getHourBucket(hour: number): ExtractedFactors['hourBucket'] {
    if (hour >= 5 && hour < 8) return 'early_morning';
    if (hour >= 8 && hour < 11) return 'morning';
    if (hour >= 11 && hour < 14) return 'midday';
    if (hour >= 14 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
}

function extractFactors(log: LogEntry, config: MultiFactorConfig): ExtractedFactors {
    const date = new Date(log.timestamp);
    const hour = date.getHours();
    const dayOfWeek = log.dayOfWeek || 'monday';
    const isWeekend = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';

    let energyLevel: 'low' | 'moderate' | 'high';
    if (log.energy < config.energyThresholds.low) {
        energyLevel = 'low';
    } else if (log.energy > config.energyThresholds.high) {
        energyLevel = 'high';
    } else {
        energyLevel = 'moderate';
    }

    let arousalLevel: 'low' | 'moderate' | 'high';
    if (log.arousal <= 3) {
        arousalLevel = 'low';
    } else if (log.arousal >= 7) {
        arousalLevel = 'high';
    } else {
        arousalLevel = 'moderate';
    }

    return {
        timeOfDay: log.timeOfDay || 'morning',
        hourBucket: getHourBucket(hour),
        dayOfWeek,
        isWeekend,
        energyLevel,
        energyValue: log.energy,
        arousalLevel,
        context: log.context,
        sensoryTriggers: log.sensoryTriggers,
        contextTriggers: log.contextTriggers,
        strategies: log.strategies,
        hasTransitionTrigger: log.contextTriggers.includes('Overgang')
    };
}

// ============================================
// PATTERN MINING
// ============================================

interface FactorCombination {
    factors: PatternFactor[];
    key: string;
}

function createFactorKey(factors: PatternFactor[]): string {
    return factors
        .map(f => `${f.type}:${f.operator}:${f.value}`)
        .sort()
        .join('|');
}

function generateFactorCombinations(
    extracted: ExtractedFactors,
    maxFactors: number
): FactorCombination[] {
    const baseFacts: PatternFactor[] = [];

    // Time factors
    baseFacts.push({
        type: 'time',
        value: extracted.hourBucket,
        operator: 'equals',
        label: `Tid: ${extracted.hourBucket}`
    });

    // Energy factor
    baseFacts.push({
        type: 'energy',
        value: extracted.energyLevel,
        operator: 'equals',
        label: `Energi: ${extracted.energyLevel}`
    });

    // Context factor
    baseFacts.push({
        type: 'context',
        value: extracted.context,
        operator: 'equals',
        label: `Kontekst: ${extracted.context === 'home' ? 'Hjemme' : 'Skole'}`
    });

    // Transition factor
    if (extracted.hasTransitionTrigger) {
        baseFacts.push({
            type: 'transition',
            value: true,
            operator: 'equals',
            label: 'Overgang involvert'
        });
    }

    // Add top triggers as factors (limit to first 2 to control explosion)
    extracted.sensoryTriggers.slice(0, 2).forEach(trigger => {
        baseFacts.push({
            type: 'trigger',
            value: trigger,
            operator: 'contains',
            label: `Trigger: ${trigger}`
        });
    });

    extracted.contextTriggers.slice(0, 2).forEach(trigger => {
        if (trigger !== 'Overgang') { // Already handled above
            baseFacts.push({
                type: 'trigger',
                value: trigger,
                operator: 'contains',
                label: `Trigger: ${trigger}`
            });
        }
    });

    // Generate combinations up to maxFactors
    const combinations: FactorCombination[] = [];

    // Single factors
    baseFacts.forEach(f => {
        combinations.push({
            factors: [f],
            key: createFactorKey([f])
        });
    });

    // Two-factor combinations
    if (maxFactors >= 2) {
        for (let i = 0; i < baseFacts.length; i++) {
            for (let j = i + 1; j < baseFacts.length; j++) {
                const combo = [baseFacts[i], baseFacts[j]];
                combinations.push({
                    factors: combo,
                    key: createFactorKey(combo)
                });
            }
        }
    }

    // Three-factor combinations (most valuable for insights)
    if (maxFactors >= 3) {
        for (let i = 0; i < baseFacts.length; i++) {
            for (let j = i + 1; j < baseFacts.length; j++) {
                for (let k = j + 1; k < baseFacts.length; k++) {
                    const combo = [baseFacts[i], baseFacts[j], baseFacts[k]];
                    combinations.push({
                        factors: combo,
                        key: createFactorKey(combo)
                    });
                }
            }
        }
    }

    return combinations;
}

// ============================================
// STATISTICAL ANALYSIS
// ============================================

/**
 * Chi-squared test for independence
 * Tests if the observed frequency differs significantly from expected
 */
function calculateChiSquared(
    observed: number,
    expected: number,
    total: number
): { chiSquared: number; pValue: number } {
    if (expected === 0 || total === 0) {
        return { chiSquared: 0, pValue: 1 };
    }

    const chiSquared = Math.pow(observed - expected, 2) / expected;

    // Approximate p-value using chi-squared distribution with 1 df
    // Using the Wilson-Hilferty approximation
    const pValue = Math.exp(-chiSquared / 2);

    return { chiSquared, pValue };
}

function getConfidenceLevel(
    pValue: number,
    sampleSize: number,
    significanceLevel: number
): ConfidenceLevel {
    if (sampleSize < 5) return 'low';
    if (pValue > significanceLevel) return 'low';
    if (pValue < significanceLevel / 10 && sampleSize >= 10) return 'high';
    return 'medium';
}

// ============================================
// MAIN ANALYSIS FUNCTIONS
// ============================================

interface PatternStats {
    factors: PatternFactor[];
    outcomeCount: number;
    totalWithFactors: number;
    totalWithoutFactors: number;
    outcomeWithoutFactors: number;
}

/**
 * Analyze logs to find multi-factor patterns that predict high arousal or crises
 */
export function analyzeMultiFactorPatterns(
    logs: LogEntry[],
    _crisisEvents: CrisisEvent[],
    config: Partial<MultiFactorConfig> = {}
): MultiFactorPattern[] {
    const cfg = { ...DEFAULT_MULTI_FACTOR_CONFIG, ...config };

    if (logs.length < cfg.minLogsForAnalysis) {
        return [];
    }

    // Track pattern statistics
    const patternStats = new Map<string, PatternStats>();

    // Process each log
    logs.forEach(log => {
        const extracted = extractFactors(log, cfg);
        const isHighArousal = log.arousal >= 7;

        const combinations = generateFactorCombinations(extracted, cfg.maxFactorsPerPattern);

        combinations.forEach(combo => {
            const existing = patternStats.get(combo.key);
            if (existing) {
                existing.totalWithFactors++;
                if (isHighArousal) {
                    existing.outcomeCount++;
                }
            } else {
                patternStats.set(combo.key, {
                    factors: combo.factors,
                    outcomeCount: isHighArousal ? 1 : 0,
                    totalWithFactors: 1,
                    totalWithoutFactors: 0,
                    outcomeWithoutFactors: 0
                });
            }
        });
    });

    // Calculate baseline high arousal rate
    const baselineHighArousal = logs.filter(l => l.arousal >= 7).length;
    const baselineRate = baselineHighArousal / logs.length;

    // Convert to patterns with statistical analysis
    const patterns: MultiFactorPattern[] = [];

    patternStats.forEach((stats, key) => {
        // Skip if not enough occurrences
        if (stats.totalWithFactors < cfg.minOccurrencesForPattern) {
            return;
        }

        const probability = stats.outcomeCount / stats.totalWithFactors;

        // Skip if probability not above threshold
        if (probability < cfg.minConfidenceThreshold) {
            return;
        }

        // Calculate expected based on baseline
        const expectedOutcomes = stats.totalWithFactors * baselineRate;

        // Chi-squared test
        const { pValue } = calculateChiSquared(
            stats.outcomeCount,
            expectedOutcomes,
            logs.length
        );

        // Only include if statistically significant
        if (pValue > cfg.significanceLevel) {
            return;
        }

        const confidence = getConfidenceLevel(pValue, stats.totalWithFactors, cfg.significanceLevel);

        // Generate human-readable description
        const factorDescriptions = stats.factors.map(f => f.label).join(' + ');
        const description = `Når ${factorDescriptions}, er det ${Math.round(probability * 100)}% sannsynlighet for høy aktivering (vs ${Math.round(baselineRate * 100)}% normalt)`;

        patterns.push({
            id: key,
            factors: stats.factors,
            outcome: 'high_arousal' as PatternOutcome,
            occurrenceCount: stats.outcomeCount,
            totalOccasions: stats.totalWithFactors,
            probability,
            pValue,
            confidence,
            description
        });
    });

    // Sort by probability (highest first), then by sample size
    patterns.sort((a, b) => {
        if (b.probability !== a.probability) {
            return b.probability - a.probability;
        }
        return b.totalOccasions - a.totalOccasions;
    });

    // Return top patterns (limit to prevent overwhelming)
    return patterns.slice(0, 10);
}

/**
 * Analyze strategy combination effectiveness
 */
export function analyzeStrategyCombinations(
    logs: LogEntry[],
    config: Partial<MultiFactorConfig> = {}
): StrategyComboEffectiveness[] {
    const cfg = { ...DEFAULT_MULTI_FACTOR_CONFIG, ...config };

    // Group logs by strategy combinations
    const comboCounts = new Map<string, {
        strategies: string[];
        helped: number;
        noChange: number;
        escalated: number;
        totalArousalBefore: number;
        count: number;
    }>();

    // Also track single strategies for comparison
    const singleStrategySuccess = new Map<string, { success: number; total: number }>();

    logs.forEach(log => {
        if (log.strategies.length === 0) return;

        const sortedStrategies = [...log.strategies].sort();
        const comboKey = sortedStrategies.join('+');

        const existing = comboCounts.get(comboKey) || {
            strategies: sortedStrategies,
            helped: 0,
            noChange: 0,
            escalated: 0,
            totalArousalBefore: 0,
            count: 0
        };

        existing.count++;
        existing.totalArousalBefore += log.arousal;

        if (log.strategyEffectiveness === 'helped') {
            existing.helped++;
        } else if (log.strategyEffectiveness === 'escalated') {
            existing.escalated++;
        } else {
            existing.noChange++;
        }

        comboCounts.set(comboKey, existing);

        // Track single strategy stats
        sortedStrategies.forEach(strategy => {
            const single = singleStrategySuccess.get(strategy) || { success: 0, total: 0 };
            single.total++;
            if (log.strategyEffectiveness === 'helped') {
                single.success++;
            }
            singleStrategySuccess.set(strategy, single);
        });
    });

    // Calculate effectiveness for each combination
    const results: StrategyComboEffectiveness[] = [];

    comboCounts.forEach((stats) => {
        if (stats.count < cfg.minOccurrencesForPattern) return;

        const successRate = stats.helped / stats.count;
        const noChangeRate = stats.noChange / stats.count;
        const escalationRate = stats.escalated / stats.count;

        // Calculate best single strategy success rate from this combo
        let bestSingleRate = 0;
        stats.strategies.forEach(strategy => {
            const single = singleStrategySuccess.get(strategy);
            if (single && single.total >= 3) {
                const rate = single.success / single.total;
                if (rate > bestSingleRate) {
                    bestSingleRate = rate;
                }
            }
        });

        // Only include combinations with multiple strategies
        if (stats.strategies.length < 2) return;

        const improvement = bestSingleRate > 0
            ? ((successRate - bestSingleRate) / bestSingleRate) * 100
            : 0;

        results.push({
            strategies: stats.strategies,
            usageCount: stats.count,
            successRate: Math.round(successRate * 100),
            noChangeRate: Math.round(noChangeRate * 100),
            escalationRate: Math.round(escalationRate * 100),
            avgArousalBefore: Math.round(stats.totalArousalBefore / stats.count * 10) / 10,
            avgArousalAfter: 0, // Would need next log to calculate
            comparedToSingleStrategy: Math.round(improvement)
        });
    });

    // Sort by success rate
    results.sort((a, b) => b.successRate - a.successRate);

    return results.slice(0, 8);
}

/**
 * Get a summary of the most important patterns for display
 */
export function getPatternSummary(patterns: MultiFactorPattern[]): string {
    if (patterns.length === 0) {
        return 'Ikke nok data for å oppdage mønstre ennå. Fortsett å logge for bedre innsikt.';
    }

    const topPatterns = patterns.slice(0, 3);
    const summaries = topPatterns.map((p, i) => {
        const factors = p.factors.map(f => f.label).join(' + ');
        return `${i + 1}. ${factors}: ${Math.round(p.probability * 100)}% risiko`;
    });

    return summaries.join('\n');
}
