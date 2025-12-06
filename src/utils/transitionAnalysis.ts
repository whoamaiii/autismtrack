import type { ScheduleEntry } from '../types';

export interface TransitionStat {
    activityName: string;
    avgDifficulty: number;
    count: number;
    trend: 'improving' | 'worsening' | 'stable';
    history: { date: string; difficulty: number }[];
}

export interface TransitionAnalysisResult {
    overallAvgDifficulty: number;
    totalTransitions: number;
    hardestTransitions: TransitionStat[];
    easiestTransitions: TransitionStat[];
    effectiveSupports: { strategy: string; usageCount: number; avgDifficultyWhenUsed: number }[];
    recentDifficulties: { date: string; difficulty: number }[];
}

export const calculateTransitionStats = (entries: ScheduleEntry[]): TransitionAnalysisResult => {
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

    // Sort by date ascending
    validEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Group by activity
    const activityGroups = new Map<string, { totalDiff: number; count: number; history: { date: string; difficulty: number }[] }>();
    const supportStats = new Map<string, { totalDiff: number; count: number }>();

    let totalGlobalDifficulty = 0;

    validEntries.forEach(entry => {
        const diff = entry.transitionDifficulty || 0;
        totalGlobalDifficulty += diff;
        const name = entry.activity.title;

        // Activity Stats
        if (!activityGroups.has(name)) {
            activityGroups.set(name, { totalDiff: 0, count: 0, history: [] });
        }
        const group = activityGroups.get(name)!;
        group.totalDiff += diff;
        group.count += 1;
        group.history.push({ date: entry.date, difficulty: diff });

        // Support Stats
        if (entry.transitionSupport) {
            entry.transitionSupport.forEach(support => {
                if (!supportStats.has(support)) {
                    supportStats.set(support, { totalDiff: 0, count: 0 });
                }
                const stat = supportStats.get(support)!;
                stat.totalDiff += diff;
                stat.count += 1;
            });
        }
    });

    // Process Activity Stats
    const transitionStats: TransitionStat[] = Array.from(activityGroups.entries()).map(([name, data]) => {
        const avg = data.count > 0 ? data.totalDiff / data.count : 0;

        // Simple trend detection
        let trend: 'improving' | 'worsening' | 'stable' = 'stable';
        if (data.history.length >= 2) {
            const firstHalf = data.history.slice(0, Math.floor(data.history.length / 2));
            const secondHalf = data.history.slice(Math.floor(data.history.length / 2));

            const avgFirst = firstHalf.reduce((sum, h) => sum + h.difficulty, 0) / (firstHalf.length || 1);
            const avgSecond = secondHalf.reduce((sum, h) => sum + h.difficulty, 0) / (secondHalf.length || 1);

            if (avgSecond < avgFirst - 0.5) trend = 'improving';
            else if (avgSecond > avgFirst + 0.5) trend = 'worsening';
        }

        return {
            activityName: name,
            avgDifficulty: parseFloat(avg.toFixed(1)),
            count: data.count,
            trend,
            history: data.history
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
    const recentDifficulties = validEntries.slice(-14).map(e => ({ // Last 14 entries
        date: e.date,
        difficulty: e.transitionDifficulty || 0
    }));

    return {
        overallAvgDifficulty: parseFloat((totalGlobalDifficulty / validEntries.length).toFixed(1)),
        totalTransitions: validEntries.length,
        hardestTransitions: transitionStats.slice(0, 5),
        easiestTransitions: [...transitionStats].sort((a, b) => a.avgDifficulty - b.avgDifficulty).slice(0, 5),
        effectiveSupports: effectiveSupports.slice(0, 5),
        recentDifficulties
    };
};
