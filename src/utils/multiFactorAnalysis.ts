/**
 * Multi-Factor Pattern Analysis
 * Detects complex patterns like "high arousal occurs WHEN energy < 4 AND time = afternoon"
 *
 * Improvements implemented:
 * - Multiple comparison correction (Benjamini-Hochberg FDR)
 * - Proper chi-squared p-value calculation
 * - Adaptive quantile-based discretization
 * - Interaction effect testing
 * - Stratified analysis by context
 * - Confidence intervals for probabilities
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
import {
    chiSquaredPValue,
    benjaminiHochbergCorrection,
    wilsonScoreInterval,
    calculateQuantileThresholds,
    assignToBin
} from './statisticalUtils';

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

/**
 * Calculate adaptive thresholds based on the full dataset
 */
export function calculateAdaptiveThresholds(logs: LogEntry[]): {
    energyThresholds: number[];
    arousalThresholds: number[];
} {
    const energyValues = logs.map(l => l.energy);
    const arousalValues = logs.map(l => l.arousal);

    return {
        energyThresholds: calculateQuantileThresholds(energyValues, 3),
        arousalThresholds: calculateQuantileThresholds(arousalValues, 3)
    };
}

function extractFactors(
    log: LogEntry,
    config: MultiFactorConfig,
    adaptiveThresholds?: { energyThresholds: number[]; arousalThresholds: number[] }
): ExtractedFactors {
    const date = new Date(log.timestamp);
    const hour = date.getHours();
    const dayOfWeek = log.dayOfWeek || 'monday';
    const isWeekend = dayOfWeek === 'saturday' || dayOfWeek === 'sunday';

    let energyLevel: 'low' | 'moderate' | 'high';
    let arousalLevel: 'low' | 'moderate' | 'high';

    // Use adaptive discretization if enabled and thresholds are available
    if (config.enableAdaptiveDiscretization && adaptiveThresholds) {
        const energyBin = assignToBin(log.energy, adaptiveThresholds.energyThresholds);
        energyLevel = ['low', 'moderate', 'high'][energyBin] as 'low' | 'moderate' | 'high';

        const arousalBin = assignToBin(log.arousal, adaptiveThresholds.arousalThresholds);
        arousalLevel = ['low', 'moderate', 'high'][arousalBin] as 'low' | 'moderate' | 'high';
    } else {
        // Fallback to fixed thresholds
        if (log.energy < config.energyThresholds.low) {
            energyLevel = 'low';
        } else if (log.energy > config.energyThresholds.high) {
            energyLevel = 'high';
        } else {
            energyLevel = 'moderate';
        }

        if (log.arousal <= 3) {
            arousalLevel = 'low';
        } else if (log.arousal >= 7) {
            arousalLevel = 'high';
        } else {
            arousalLevel = 'moderate';
        }
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
    // Performance optimization: limit total combinations to prevent CPU spikes
    const MAX_COMBINATIONS = 150;
    const combinations: FactorCombination[] = [];

    // Single factors
    baseFacts.forEach(f => {
        combinations.push({
            factors: [f],
            key: createFactorKey([f])
        });
    });

    // Two-factor combinations (with early termination)
    if (maxFactors >= 2 && combinations.length < MAX_COMBINATIONS) {
        outer2: for (let i = 0; i < baseFacts.length; i++) {
            for (let j = i + 1; j < baseFacts.length; j++) {
                if (combinations.length >= MAX_COMBINATIONS) break outer2;
                const combo = [baseFacts[i], baseFacts[j]];
                combinations.push({
                    factors: combo,
                    key: createFactorKey(combo)
                });
            }
        }
    }

    // Three-factor combinations (with early termination to prevent O(n^3) explosion)
    if (maxFactors >= 3 && combinations.length < MAX_COMBINATIONS) {
        outer3: for (let i = 0; i < baseFacts.length; i++) {
            for (let j = i + 1; j < baseFacts.length; j++) {
                for (let k = j + 1; k < baseFacts.length; k++) {
                    if (combinations.length >= MAX_COMBINATIONS) break outer3;
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
 * Now uses proper chi-squared CDF for accurate p-values
 */
function calculateChiSquared(
    observed: number,
    expected: number,
    _total: number
): { chiSquared: number; pValue: number } {
    if (expected === 0) {
        return { chiSquared: 0, pValue: 1 };
    }

    const chiSquared = Math.pow(observed - expected, 2) / expected;

    // Use proper chi-squared CDF for accurate p-value (df=1)
    const pValue = chiSquaredPValue(chiSquared, 1);

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
 * Extended pattern result with confidence intervals
 */
export interface ExtendedMultiFactorPattern extends MultiFactorPattern {
    /** 95% confidence interval for probability */
    probabilityCI?: { lower: number; upper: number };
    /** Sample size for this pattern */
    sampleSize: number;
    /** Adjusted p-value after FDR correction */
    adjustedPValue?: number;
    /** Whether significant after FDR correction */
    significantAfterCorrection?: boolean;
    /** Context-specific probabilities if stratified analysis enabled */
    contextBreakdown?: {
        home?: { probability: number; count: number };
        school?: { probability: number; count: number };
    };
}

/**
 * Analyze logs to find multi-factor patterns that predict high arousal or crises
 * Now includes: FDR correction, confidence intervals, adaptive discretization, stratified analysis
 */
export function analyzeMultiFactorPatterns(
    logs: LogEntry[],
    _crisisEvents: CrisisEvent[],
    config: Partial<MultiFactorConfig> = {}
): ExtendedMultiFactorPattern[] {
    const cfg = { ...DEFAULT_MULTI_FACTOR_CONFIG, ...config };

    if (logs.length < cfg.minLogsForAnalysis) {
        return [];
    }

    // Calculate adaptive thresholds if enabled
    const adaptiveThresholds = cfg.enableAdaptiveDiscretization
        ? calculateAdaptiveThresholds(logs)
        : undefined;

    // Track pattern statistics (including context breakdown)
    const patternStats = new Map<string, PatternStats & {
        homeOutcome: number;
        homeTotal: number;
        schoolOutcome: number;
        schoolTotal: number;
    }>();

    // Process each log
    logs.forEach(log => {
        const extracted = extractFactors(log, cfg, adaptiveThresholds);
        const isHighArousal = log.arousal >= 7;

        const combinations = generateFactorCombinations(extracted, cfg.maxFactorsPerPattern);

        combinations.forEach(combo => {
            const existing = patternStats.get(combo.key);
            if (existing) {
                existing.totalWithFactors++;
                if (isHighArousal) {
                    existing.outcomeCount++;
                }
                // Track by context for stratified analysis
                if (log.context === 'home') {
                    existing.homeTotal++;
                    if (isHighArousal) existing.homeOutcome++;
                } else {
                    existing.schoolTotal++;
                    if (isHighArousal) existing.schoolOutcome++;
                }
            } else {
                patternStats.set(combo.key, {
                    factors: combo.factors,
                    outcomeCount: isHighArousal ? 1 : 0,
                    totalWithFactors: 1,
                    totalWithoutFactors: 0,
                    outcomeWithoutFactors: 0,
                    homeOutcome: log.context === 'home' && isHighArousal ? 1 : 0,
                    homeTotal: log.context === 'home' ? 1 : 0,
                    schoolOutcome: log.context === 'school' && isHighArousal ? 1 : 0,
                    schoolTotal: log.context === 'school' ? 1 : 0
                });
            }
        });
    });

    // Calculate baseline high arousal rate
    const baselineHighArousal = logs.filter(l => l.arousal >= 7).length;
    const baselineRate = baselineHighArousal / logs.length;

    // First pass: collect all candidate patterns with p-values
    const candidatePatterns: Array<{
        key: string;
        stats: PatternStats & { homeOutcome: number; homeTotal: number; schoolOutcome: number; schoolTotal: number };
        probability: number;
        pValue: number;
        probabilityCI: { lower: number; upper: number };
    }> = [];

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

        // Chi-squared test with proper p-value
        const { pValue } = calculateChiSquared(
            stats.outcomeCount,
            expectedOutcomes,
            logs.length
        );

        // Calculate Wilson score confidence interval
        const probabilityCI = wilsonScoreInterval(
            stats.outcomeCount,
            stats.totalWithFactors,
            0.95
        );

        candidatePatterns.push({
            key,
            stats,
            probability,
            pValue,
            probabilityCI: { lower: probabilityCI.lower, upper: probabilityCI.upper }
        });
    });

    // Apply multiple comparison correction if enabled
    let adjustedResults: { adjustedPValues: number[]; significant: boolean[] } | null = null;
    if (cfg.enableMultipleComparisonCorrection && candidatePatterns.length > 0) {
        const pValues = candidatePatterns.map(p => p.pValue);
        adjustedResults = benjaminiHochbergCorrection(pValues, cfg.fdrLevel);
    }

    // Convert to patterns with statistical analysis
    const patterns: ExtendedMultiFactorPattern[] = [];

    candidatePatterns.forEach((candidate, index) => {
        const { stats, probability, pValue, probabilityCI } = candidate;

        // Check significance (with or without FDR correction)
        let isSignificant: boolean;
        let adjustedPValue: number | undefined;
        let significantAfterCorrection: boolean | undefined;

        if (adjustedResults) {
            adjustedPValue = adjustedResults.adjustedPValues[index];
            significantAfterCorrection = adjustedResults.significant[index];
            isSignificant = significantAfterCorrection;
        } else {
            isSignificant = pValue <= cfg.significanceLevel;
        }

        // Only include if statistically significant
        if (!isSignificant) {
            return;
        }

        const confidence = getConfidenceLevel(pValue, stats.totalWithFactors, cfg.significanceLevel);

        // Generate human-readable description with CI
        const factorDescriptions = stats.factors.map(f => f.label).join(' + ');
        const ciText = `${Math.round(probabilityCI.lower * 100)}-${Math.round(probabilityCI.upper * 100)}%`;
        const description = `Når ${factorDescriptions}, er det ${Math.round(probability * 100)}% (${ciText}) sannsynlighet for høy aktivering (vs ${Math.round(baselineRate * 100)}% normalt)`;

        // Build context breakdown if stratified analysis enabled
        let contextBreakdown: ExtendedMultiFactorPattern['contextBreakdown'];
        if (cfg.enableStratifiedAnalysis) {
            contextBreakdown = {};
            if (stats.homeTotal >= 2) {
                contextBreakdown.home = {
                    probability: stats.homeTotal > 0 ? stats.homeOutcome / stats.homeTotal : 0,
                    count: stats.homeTotal
                };
            }
            if (stats.schoolTotal >= 2) {
                contextBreakdown.school = {
                    probability: stats.schoolTotal > 0 ? stats.schoolOutcome / stats.schoolTotal : 0,
                    count: stats.schoolTotal
                };
            }
        }

        patterns.push({
            id: candidate.key,
            factors: stats.factors,
            outcome: 'high_arousal' as PatternOutcome,
            occurrenceCount: stats.outcomeCount,
            totalOccasions: stats.totalWithFactors,
            probability,
            pValue,
            confidence,
            description,
            probabilityCI,
            sampleSize: stats.totalWithFactors,
            adjustedPValue,
            significantAfterCorrection,
            contextBreakdown
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
 * Analyze interaction effects between two factors
 * Tests if the combination has a synergistic effect beyond individual factors
 */
export function analyzeInteractionEffects(
    logs: LogEntry[],
    config: Partial<MultiFactorConfig> = {}
): Array<{
    factor1: string;
    factor2: string;
    individualEffect1: number;
    individualEffect2: number;
    combinedEffect: number;
    interactionStrength: number;
    synergistic: boolean;
    description: string;
}> {
    const cfg = { ...DEFAULT_MULTI_FACTOR_CONFIG, ...config };

    if (!cfg.enableInteractionTesting || logs.length < cfg.minLogsForAnalysis) {
        return [];
    }

    const adaptiveThresholds = cfg.enableAdaptiveDiscretization
        ? calculateAdaptiveThresholds(logs)
        : undefined;

    // Extract factors for all logs
    const extractedLogs = logs.map(log => ({
        log,
        factors: extractFactors(log, cfg, adaptiveThresholds),
        isHighArousal: log.arousal >= 7
    }));

    const baselineRate = logs.filter(l => l.arousal >= 7).length / logs.length;

    const interactions: Array<{
        factor1: string;
        factor2: string;
        individualEffect1: number;
        individualEffect2: number;
        combinedEffect: number;
        interactionStrength: number;
        synergistic: boolean;
        description: string;
    }> = [];

    // Test energy × timeOfDay interaction
    const energyLevels = ['low', 'moderate', 'high'] as const;
    const timeBuckets = ['early_morning', 'morning', 'midday', 'afternoon', 'evening', 'night'] as const;

    for (const energy of energyLevels) {
        for (const time of timeBuckets) {
            // Calculate individual effects
            const withEnergy = extractedLogs.filter(l => l.factors.energyLevel === energy);
            const withTime = extractedLogs.filter(l => l.factors.hourBucket === time);
            const withBoth = extractedLogs.filter(l =>
                l.factors.energyLevel === energy && l.factors.hourBucket === time
            );

            if (withBoth.length < cfg.minOccurrencesForPattern) continue;

            const energyEffect = withEnergy.length > 0
                ? withEnergy.filter(l => l.isHighArousal).length / withEnergy.length - baselineRate
                : 0;
            const timeEffect = withTime.length > 0
                ? withTime.filter(l => l.isHighArousal).length / withTime.length - baselineRate
                : 0;
            const combinedEffect = withBoth.filter(l => l.isHighArousal).length / withBoth.length - baselineRate;

            // Expected additive effect
            const expectedAdditiveEffect = energyEffect + timeEffect;
            const interactionStrength = combinedEffect - expectedAdditiveEffect;

            // Only report significant interactions
            if (Math.abs(interactionStrength) > 0.15) {
                interactions.push({
                    factor1: `Energi: ${energy}`,
                    factor2: `Tid: ${time}`,
                    individualEffect1: energyEffect,
                    individualEffect2: timeEffect,
                    combinedEffect,
                    interactionStrength,
                    synergistic: interactionStrength > 0,
                    description: interactionStrength > 0
                        ? `${energy} energi + ${time} har sterkere effekt enn forventet (${Math.round(interactionStrength * 100)}% ekstra risiko)`
                        : `${energy} energi + ${time} har svakere effekt enn forventet (${Math.round(Math.abs(interactionStrength) * 100)}% mindre risiko)`
                });
            }
        }
    }

    // Sort by interaction strength
    interactions.sort((a, b) => Math.abs(b.interactionStrength) - Math.abs(a.interactionStrength));

    return interactions.slice(0, 5);
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
