import type { ScheduleEntry } from '../types';
import {
    DEFAULT_TRANSITION_CONFIG,
    type TransitionAnalysisConfig,
} from './analysisConfig';

// ============================================================================
// Types
// ============================================================================

export interface TransitionStat {
    activityName: string;
    avgDifficulty: number;
    count: number;
    trend: 'improving' | 'worsening' | 'stable';
    history: { date: string; difficulty: number }[];
    /** Confidence level based on sample size */
    trendConfidence?: 'low' | 'medium' | 'high';
    /** Standard deviation of difficulty scores */
    standardDeviation?: number;
    /** Statistical p-value for trend (lower = more significant) */
    trendPValue?: number;
}

export interface WeeklySummary {
    weekStart: string; // ISO date of Monday
    avgDifficulty: number;
    transitionCount: number;
}

export interface MonthlySummary {
    month: string; // "YYYY-MM" format
    avgDifficulty: number;
    transitionCount: number;
}

export interface TransitionAnalysisResult {
    overallAvgDifficulty: number;
    totalTransitions: number;
    hardestTransitions: TransitionStat[];
    easiestTransitions: TransitionStat[];
    effectiveSupports: { strategy: string; usageCount: number; avgDifficultyWhenUsed: number }[];
    recentDifficulties: { date: string; difficulty: number }[];
    /** Warning message if data is insufficient for reliable trends */
    confidenceWarning?: string;
    /** Weekly aggregated summaries */
    weeklySummary?: WeeklySummary[];
    /** Monthly aggregated summaries */
    monthlySummary?: MonthlySummary[];
    /** Earliest date in the analysis window */
    dataWindowStart?: string;
    /** Latest date in the analysis window */
    dataWindowEnd?: string;
}

// ============================================================================
// Statistical Helper Functions
// ============================================================================

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
}

/**
 * Standard normal CDF approximation (Abramowitz and Stegun)
 */
function normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate statistical significance for trend detection using Welch's t-test approximation
 * Returns p-value and significance flag
 */
function calculateTrendSignificance(
    firstHalf: number[],
    secondHalf: number[]
): { pValue: number; isSignificant: boolean } {
    if (firstHalf.length < 2 || secondHalf.length < 2) {
        return { pValue: 1.0, isSignificant: false };
    }

    const mean1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const mean2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const var1 = firstHalf.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / (firstHalf.length - 1);
    const var2 = secondHalf.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / (secondHalf.length - 1);

    const se = Math.sqrt(var1 / firstHalf.length + var2 / secondHalf.length);

    if (se === 0) {
        // No variance - if means are equal, no trend; otherwise, perfect trend
        return { pValue: mean1 === mean2 ? 1.0 : 0.0, isSignificant: mean1 !== mean2 };
    }

    const t = Math.abs(mean1 - mean2) / se;

    // Approximate p-value using normal distribution (valid for larger samples)
    const pValue = 2 * (1 - normalCDF(t));

    return { pValue, isSignificant: pValue < 0.05 };
}

/**
 * Determine confidence level based on sample size
 */
function getTrendConfidence(
    count: number,
    config: TransitionAnalysisConfig
): 'low' | 'medium' | 'high' {
    if (count >= config.minSamplesForHighConfidence) return 'high';
    if (count >= config.minSamplesForTrend) return 'medium';
    return 'low';
}

// ============================================================================
// History Management
// ============================================================================

/**
 * Cap history array to prevent unbounded growth
 * Keeps most recent entries in chronological order
 */
function capHistory(
    history: { date: string; difficulty: number }[],
    maxEntries: number
): { date: string; difficulty: number }[] {
    if (history.length <= maxEntries) return history;

    // Sort by date descending, take most recent, then reverse to chronological
    const sorted = [...history].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted.slice(0, maxEntries).reverse();
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/**
 * Calculate weekly summaries from difficulty entries
 */
function calculateWeeklySummary(
    entries: { date: string; difficulty: number }[]
): WeeklySummary[] {
    const weekMap = new Map<string, { total: number; count: number }>();

    entries.forEach(entry => {
        const date = new Date(entry.date);
        // Get Monday of the week
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const monday = new Date(date);
        monday.setDate(diff);
        const weekKey = monday.toISOString().split('T')[0];

        const existing = weekMap.get(weekKey) ?? { total: 0, count: 0 };
        existing.total += entry.difficulty;
        existing.count += 1;
        weekMap.set(weekKey, existing);
    });

    return Array.from(weekMap.entries())
        .map(([weekStart, data]) => ({
            weekStart,
            avgDifficulty: parseFloat((data.total / data.count).toFixed(1)),
            transitionCount: data.count,
        }))
        .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Calculate monthly summaries from difficulty entries
 */
function calculateMonthlySummary(
    entries: { date: string; difficulty: number }[]
): MonthlySummary[] {
    const monthMap = new Map<string, { total: number; count: number }>();

    entries.forEach(entry => {
        const monthKey = entry.date.substring(0, 7); // "YYYY-MM"
        const existing = monthMap.get(monthKey) ?? { total: 0, count: 0 };
        existing.total += entry.difficulty;
        existing.count += 1;
        monthMap.set(monthKey, existing);
    });

    return Array.from(monthMap.entries())
        .map(([month, data]) => ({
            month,
            avgDifficulty: parseFloat((data.total / data.count).toFixed(1)),
            transitionCount: data.count,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export const calculateTransitionStats = (
    entries: ScheduleEntry[],
    config: Partial<TransitionAnalysisConfig> = {}
): TransitionAnalysisResult => {
    const cfg = { ...DEFAULT_TRANSITION_CONFIG, ...config };

    // Filter for entries that have transition data
    const validEntries = entries.filter(e =>
        e.status === 'completed' &&
        e.transitionDifficulty !== undefined
    );

    if (validEntries.length === 0) {
        return {
            overallAvgDifficulty: 0,
            totalTransitions: 0,
            hardestTransitions: [],
            easiestTransitions: [],
            effectiveSupports: [],
            recentDifficulties: []
        };
    }

    // Sort by date ascending (create a copy to avoid mutating input)
    const sortedEntries = [...validEntries].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Calculate data window
    const dataWindowStart = sortedEntries[0].date;
    const dataWindowEnd = sortedEntries[sortedEntries.length - 1].date;

    // Group by activity
    const activityGroups = new Map<string, {
        totalDiff: number;
        count: number;
        history: { date: string; difficulty: number }[]
    }>();
    const supportStats = new Map<string, { totalDiff: number; count: number }>();

    let totalGlobalDifficulty = 0;

    sortedEntries.forEach(entry => {
        const diff = entry.transitionDifficulty ?? 0;
        totalGlobalDifficulty += diff;
        const name = entry.activity.title;

        // Activity Stats - use ?? pattern instead of non-null assertion
        const existingGroup = activityGroups.get(name);
        const group = existingGroup ?? { totalDiff: 0, count: 0, history: [] };

        group.totalDiff += diff;
        group.count += 1;
        group.history.push({ date: entry.date, difficulty: diff });

        if (!existingGroup) {
            activityGroups.set(name, group);
        }

        // Support Stats
        if (entry.transitionSupport) {
            entry.transitionSupport.forEach(support => {
                const existingStat = supportStats.get(support);
                const stat = existingStat ?? { totalDiff: 0, count: 0 };
                stat.totalDiff += diff;
                stat.count += 1;
                if (!existingStat) {
                    supportStats.set(support, stat);
                }
            });
        }
    });

    // Process Activity Stats with enhanced trend detection
    const transitionStats: TransitionStat[] = Array.from(activityGroups.entries()).map(([name, data]) => {
        const avg = data.count > 0 ? data.totalDiff / data.count : 0;
        const difficulties = data.history.map(h => h.difficulty);
        const stdDev = calculateStdDev(difficulties);
        const confidence = getTrendConfidence(data.count, cfg);

        // Enhanced trend detection with statistical significance
        let trend: 'improving' | 'worsening' | 'stable' = 'stable';
        let trendPValue = 1.0;

        if (data.history.length >= cfg.minSamplesForTrend) {
            const midpoint = Math.floor(data.history.length / 2);
            const firstHalf = data.history.slice(0, midpoint).map(h => h.difficulty);
            const secondHalf = data.history.slice(midpoint).map(h => h.difficulty);

            const avgFirst = firstHalf.reduce((sum, h) => sum + h, 0) / firstHalf.length;
            const avgSecond = secondHalf.reduce((sum, h) => sum + h, 0) / secondHalf.length;

            const { pValue, isSignificant } = calculateTrendSignificance(firstHalf, secondHalf);
            trendPValue = pValue;

            // Only report trend if statistically significant AND exceeds threshold
            if (isSignificant && Math.abs(avgSecond - avgFirst) > cfg.trendSignificanceThreshold) {
                if (avgSecond < avgFirst) trend = 'improving';
                else if (avgSecond > avgFirst) trend = 'worsening';
            }
        }

        // Cap history to prevent unbounded growth
        const cappedHistory = capHistory(data.history, cfg.maxHistoryEntries);

        return {
            activityName: name,
            avgDifficulty: parseFloat(avg.toFixed(1)),
            count: data.count,
            trend,
            history: cappedHistory,
            trendConfidence: confidence,
            standardDeviation: parseFloat(stdDev.toFixed(2)),
            trendPValue: parseFloat(trendPValue.toFixed(4)),
        };
    });

    // Process Support Stats
    const effectiveSupports = Array.from(supportStats.entries()).map(([strategy, data]) => ({
        strategy,
        usageCount: data.count,
        avgDifficultyWhenUsed: data.count > 0
            ? parseFloat((data.totalDiff / data.count).toFixed(1))
            : 0
    })).sort((a, b) => a.avgDifficultyWhenUsed - b.avgDifficultyWhenUsed); // Lower difficulty is better

    // Sort transitions
    transitionStats.sort((a, b) => b.avgDifficulty - a.avgDifficulty);

    // Recent global difficulties (for main chart)
    const recentDifficulties = sortedEntries
        .slice(-cfg.recentEntriesLimit)
        .map(e => ({
            date: e.date,
            difficulty: e.transitionDifficulty ?? 0
        }));

    // Calculate aggregations
    const allDifficulties = sortedEntries.map(e => ({
        date: e.date,
        difficulty: e.transitionDifficulty ?? 0
    }));

    const weeklySummary = calculateWeeklySummary(allDifficulties);
    const monthlySummary = calculateMonthlySummary(allDifficulties);

    // Generate confidence warning if needed
    let confidenceWarning: string | undefined;
    const lowConfidenceCount = transitionStats.filter(t => t.trendConfidence === 'low').length;

    if (sortedEntries.length < cfg.minSamplesForTrend) {
        confidenceWarning = `Only ${sortedEntries.length} data points - trends may be unreliable`;
    } else if (lowConfidenceCount > transitionStats.length / 2) {
        confidenceWarning = `Most activities have limited data - consider logging more transitions`;
    }

    return {
        overallAvgDifficulty: parseFloat((totalGlobalDifficulty / sortedEntries.length).toFixed(1)),
        totalTransitions: sortedEntries.length,
        hardestTransitions: transitionStats.slice(0, cfg.topTransitionsLimit),
        easiestTransitions: [...transitionStats]
            .sort((a, b) => a.avgDifficulty - b.avgDifficulty)
            .slice(0, cfg.topTransitionsLimit),
        effectiveSupports: effectiveSupports.slice(0, cfg.topTransitionsLimit),
        recentDifficulties,
        confidenceWarning,
        weeklySummary,
        monthlySummary,
        dataWindowStart,
        dataWindowEnd,
    };
};
