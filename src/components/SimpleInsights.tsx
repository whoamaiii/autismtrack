/**
 * SimpleInsights Component
 *
 * Parent-friendly insights display that shows:
 * - Quick status overview (How is today going?)
 * - Key patterns identified (What to watch for)
 * - Quick tips (What might help)
 *
 * Designed to be scannable and actionable.
 */
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Sun,
    Cloud,
    CloudRain,
    TrendingUp,
    TrendingDown,
    Minus,
    Lightbulb,
    AlertTriangle,
    CheckCircle,
    ChevronRight,
    Brain,
    Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LogEntry, CrisisEvent, AnalysisResult } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface SimpleInsightsProps {
    /** Today's log entries */
    logs: LogEntry[];
    /** Recent crisis events (last 7 days) */
    recentCrisisEvents?: CrisisEvent[];
    /** AI analysis result if available */
    analysis?: AnalysisResult | null;
    /** Child's name for personalization */
    childName?: string;
    /** Whether analysis is loading */
    isLoading?: boolean;
}

interface InsightCardProps {
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode;
    color?: 'green' | 'yellow' | 'red' | 'blue' | 'purple';
    delay?: number;
}

interface StatusIndicator {
    icon: typeof Sun | typeof Cloud | typeof CloudRain;
    label: string;
    color: 'green' | 'yellow' | 'red';
    description: string;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

const colorClasses = {
    green: {
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        icon: 'text-emerald-400',
        text: 'text-emerald-300'
    },
    yellow: {
        bg: 'bg-amber-500/10 border-amber-500/20',
        icon: 'text-amber-400',
        text: 'text-amber-300'
    },
    red: {
        bg: 'bg-red-500/10 border-red-500/20',
        icon: 'text-red-400',
        text: 'text-red-300'
    },
    blue: {
        bg: 'bg-cyan-500/10 border-cyan-500/20',
        icon: 'text-cyan-400',
        text: 'text-cyan-300'
    },
    purple: {
        bg: 'bg-purple-500/10 border-purple-500/20',
        icon: 'text-purple-400',
        text: 'text-purple-300'
    }
};

const InsightCard: React.FC<InsightCardProps> = ({
    icon,
    title,
    children,
    color = 'blue',
    delay = 0
}) => {
    const colors = colorClasses[color];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3 }}
            className={`
                p-4 rounded-xl border
                ${colors.bg}
            `}
        >
            <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 ${colors.icon}`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className={`font-medium text-sm ${colors.text}`}>
                        {title}
                    </h3>
                    <div className="mt-1 text-sm text-white/70">
                        {children}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export const SimpleInsights: React.FC<SimpleInsightsProps> = ({
    logs,
    recentCrisisEvents = [],
    analysis,
    childName = 'barnet',
    isLoading = false
}) => {
    const { t } = useTranslation();

    const logStats = useMemo(() => {
        if (logs.length === 0) {
            return {
                avgArousal: 0,
                highArousalCount: 0,
                morningAvg: null as number | null,
                afternoonAvg: null as number | null,
                morningCount: 0,
                afternoonCount: 0
            };
        }

        let arousalSum = 0;
        let highArousalCount = 0;
        let morningSum = 0;
        let morningCount = 0;
        let afternoonSum = 0;
        let afternoonCount = 0;

        logs.forEach(log => {
            arousalSum += log.arousal;
            if (log.arousal >= 8) {
                highArousalCount += 1;
            }
            const hour = new Date(log.timestamp).getHours();
            if (hour >= 6 && hour < 12) {
                morningSum += log.arousal;
                morningCount += 1;
            } else if (hour >= 12 && hour < 18) {
                afternoonSum += log.arousal;
                afternoonCount += 1;
            }
        });

        return {
            avgArousal: arousalSum / logs.length,
            highArousalCount,
            morningAvg: morningCount > 0 ? morningSum / morningCount : null,
            afternoonAvg: afternoonCount > 0 ? afternoonSum / afternoonCount : null,
            morningCount,
            afternoonCount
        };
    }, [logs]);

    // Calculate today's status
    const todayStatus = useMemo((): StatusIndicator => {
        if (logs.length === 0) {
            return {
                icon: Cloud,
                label: 'Ingen data ennå',
                color: 'yellow',
                description: 'Logg første observasjon for å se innsikter'
            };
        }

        const { avgArousal, highArousalCount } = logStats;
        const todayDate = new Date().toDateString();
        const hadCrisisToday = recentCrisisEvents.some(e =>
            new Date(e.timestamp).toDateString() === todayDate
        );

        if (hadCrisisToday || avgArousal >= 7) {
            return {
                icon: CloudRain,
                label: 'Krevende dag',
                color: 'red',
                description: `${childName} har hatt høyt stressnivå i dag`
            };
        }

        if (avgArousal >= 5 || highArousalCount >= 2) {
            return {
                icon: Cloud,
                label: 'Varierende dag',
                color: 'yellow',
                description: 'Noen utfordringer, men håndterbart'
            };
        }

        return {
            icon: Sun,
            label: 'God dag',
            color: 'green',
            description: `${childName} har hatt jevnt godt humør`
        };
    }, [logs.length, logStats, recentCrisisEvents, childName]);

    // Calculate energy trend
    const energyTrend = useMemo(() => {
        if (logs.length < 2) return null;

        const sortedLogs = [...logs].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        const firstHalf = sortedLogs.slice(0, Math.floor(sortedLogs.length / 2));
        const secondHalf = sortedLogs.slice(Math.floor(sortedLogs.length / 2));

        const avgFirst = firstHalf.reduce((sum, log) => sum + (log.energy || 5), 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((sum, log) => sum + (log.energy || 5), 0) / secondHalf.length;

        const diff = avgSecond - avgFirst;

        if (diff > 1) {
            return { trend: 'up' as const, label: 'Energien øker' };
        } else if (diff < -1) {
            return { trend: 'down' as const, label: 'Energien synker' };
        }
        return { trend: 'stable' as const, label: 'Stabil energi' };
    }, [logs]);

    // Extract simple tips from analysis or generate default
    const quickTips = useMemo(() => {
        if (analysis?.recommendations) {
            // Take first 2 recommendations, simplified
            return analysis.recommendations
                .slice(0, 2)
                .map(rec => rec.split('.')[0]); // Just first sentence
        }

        // Default tips based on status
        if (todayStatus.color === 'red') {
            return [
                'Prioriter rolige aktiviteter',
                'Vurder kortere økter'
            ];
        } else if (todayStatus.color === 'yellow') {
            return [
                'Planlegg pauser mellom aktiviteter',
                'Ha favorittstrategier klare'
            ];
        }
        return [
            'Fortsett med det som fungerer',
            'Noter hva som gikk bra'
        ];
    }, [analysis, todayStatus]);

    // Key patterns from analysis
    const keyPattern = useMemo(() => {
        // Use trigger analysis as a key pattern if available
        if (analysis?.triggerAnalysis && analysis.triggerAnalysis.length > 0) {
            // Extract first sentence of trigger analysis
            const firstSentence = analysis.triggerAnalysis.split('.')[0];
            if (firstSentence && firstSentence.length > 10) {
                return firstSentence;
            }
        }

        // Generate pattern from logs
        if (logs.length >= 3 && logStats.morningAvg !== null && logStats.afternoonAvg !== null) {
            const avgMorning = logStats.morningAvg;
            const avgAfternoon = logStats.afternoonAvg;

            if (avgAfternoon > avgMorning + 2) {
                return 'Spenning øker ofte på ettermiddagen';
            } else if (avgMorning > avgAfternoon + 2) {
                return 'Roligere etter morgenrutiner er ferdig';
            }
        }
        return null;
    }, [analysis, logStats, logs.length]);

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-3">
                <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
                <div className="h-16 bg-white/5 rounded-xl animate-pulse" />
            </div>
        );
    }

    // Empty state - with dashed border for "placeholder" feel
    if (logs.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 border-2 border-dashed border-white/15 rounded-2xl bg-white/[0.02]"
            >
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-white/10 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-white/40" />
                </div>
                <p className="text-white/60 text-sm font-medium">
                    {t('simpleInsights.empty.message', 'Log your first observation to see insights')}
                </p>
                <Link
                    to="/log"
                    className="inline-flex items-center gap-1 mt-4 text-cyan-400 text-sm font-medium hover:text-cyan-300 transition-colors"
                >
                    {t('simpleInsights.empty.cta', 'Add observation')}
                    <ChevronRight className="w-4 h-4" />
                </Link>
            </motion.div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Today's Status - Hero Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`
                    p-5 rounded-2xl border
                    ${colorClasses[todayStatus.color].bg}
                `}
            >
                <div className="flex items-center gap-4">
                    <div className={`
                        w-14 h-14 rounded-xl flex items-center justify-center
                        ${todayStatus.color === 'green' ? 'bg-emerald-500/20' :
                            todayStatus.color === 'yellow' ? 'bg-amber-500/20' :
                                'bg-red-500/20'}
                    `}>
                        <todayStatus.icon
                            className={`w-7 h-7 ${colorClasses[todayStatus.color].icon}`}
                        />
                    </div>
                    <div className="flex-1">
                        <h2 className={`text-lg font-semibold ${colorClasses[todayStatus.color].text}`}>
                            {todayStatus.label}
                        </h2>
                        <p className="text-white/60 text-sm mt-0.5">
                            {todayStatus.description}
                        </p>
                    </div>
                </div>

                {/* Quick stats */}
                <div className="flex gap-4 mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-white/40" />
                        <span className="text-white/70 text-sm">
                            {logs.length} {logs.length === 1 ? 'observasjon' : 'observasjoner'}
                        </span>
                    </div>
                    {energyTrend && (
                        <div className="flex items-center gap-2">
                            {energyTrend.trend === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                            ) : energyTrend.trend === 'down' ? (
                                <TrendingDown className="w-4 h-4 text-red-400" />
                            ) : (
                                <Minus className="w-4 h-4 text-white/40" />
                            )}
                            <span className="text-white/70 text-sm">
                                {energyTrend.label}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Key Pattern */}
            {keyPattern && (
                <InsightCard
                    icon={<Brain className="w-5 h-5" />}
                    title="Mønster observert"
                    color="purple"
                    delay={0.1}
                >
                    {keyPattern}
                </InsightCard>
            )}

            {/* Quick Tips */}
            <InsightCard
                icon={<Lightbulb className="w-5 h-5" />}
                title="Tips akkurat nå"
                color={todayStatus.color === 'red' ? 'yellow' : 'green'}
                delay={0.2}
            >
                <ul className="space-y-1.5">
                    {quickTips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                            <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-white/40" />
                            <span>{tip}</span>
                        </li>
                    ))}
                </ul>
            </InsightCard>

            {/* Recent Crisis Alert */}
            {recentCrisisEvents.length > 0 && (
                <InsightCard
                    icon={<AlertTriangle className="w-5 h-5" />}
                    title={`${recentCrisisEvents.length} krise${recentCrisisEvents.length > 1 ? 'r' : ''} siste 7 dager`}
                    color="red"
                    delay={0.3}
                >
                    <Link
                        to="/crisis"
                        className="inline-flex items-center gap-1 text-red-300 hover:text-red-200 transition-colors"
                    >
                        Se kriseoversikt
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </InsightCard>
            )}

            {/* Link to detailed analysis */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
            >
                <Link
                    to="/analysis"
                    className="
                        flex items-center justify-between
                        p-4 rounded-xl
                        bg-white/5 border border-white/10
                        hover:bg-white/10 transition-colors
                        group
                    "
                >
                    <div className="flex items-center gap-3">
                        <Brain className="w-5 h-5 text-white/40" />
                        <span className="text-white/60 text-sm">
                            Se detaljert AI-analyse
                        </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/50 transition-colors" />
                </Link>
            </motion.div>
        </div>
    );
};

export default SimpleInsights;
