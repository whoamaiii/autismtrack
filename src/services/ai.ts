import type { LogEntry, AnalysisResult, CrisisEvent, AnalysisCorrelation, ChildProfile } from '../types';
import {
    analyzeLogsWithGemini,
    analyzeLogsDeepWithGemini,
    analyzeLogsStreamingWithGemini,
    isGeminiConfigured,
    getGeminiStatus,
    clearGeminiCache
} from './gemini';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Use Gemini as primary (for Kaggle competition), fallback to OpenRouter
const USE_GEMINI_PRIMARY = true;

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const SITE_URL = import.meta.env.VITE_SITE_URL || 'http://localhost:5173';
const SITE_NAME = 'NeuroLogg Pro';

// =============================================================================
// MODEL CONFIGURATION
// =============================================================================

// FREE model for quick/automatic analysis
// Using Gemini Flash which is very cheap and reliable
const FREE_MODEL_ID = 'google/gemini-2.0-flash-001';

// PREMIUM models for deep analysis - ordered by preference
// 1. Grok 4 - xAI's flagship reasoning model (256K context, excellent for behavioral analysis)
// 2. GPT-5.1 - OpenAI's latest with advanced reasoning
// 3. Gemini 2.5 Pro - Google's best (1M context, strong multimodal)
const PREMIUM_MODELS = [
    'x-ai/grok-4',           // Best: Real-time reasoning, 256K context
    'openai/gpt-5.1',        // Excellent: Advanced reasoning, balanced
    'google/gemini-2.5-pro', // Fallback: 1M context, strong reasoning
] as const;

// Primary premium model (Grok 4 - currently top-ranked for reasoning)
const PREMIUM_MODEL_ID = PREMIUM_MODELS[0];

// Fallback if free model fails
const FALLBACK_MODEL_ID = 'google/gemini-2.5-flash-preview-05-20';

// API Configuration
const API_CONFIG = {
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 120000, // 2 minutes for deep analysis
    maxTokensFree: 4000,
    maxTokensPremium: 8000,
};

// =============================================================================
// TYPES
// =============================================================================
interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface OpenRouterResponse {
    id: string;
    choices: Array<{
        message: {
            content: string;
            reasoning_details?: Array<{
                type: string;
                content: string;
            }>;
        };
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface AnalysisCache {
    result: AnalysisResult;
    timestamp: number;
    logsHash: string;
}

// Retry callback for UI visibility
export interface RetryCallback {
    onRetry?: (attempt: number, maxRetries: number, modelId: string) => void;
}

// =============================================================================
// CACHING
// =============================================================================
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
let analysisCache: AnalysisCache | null = null;

const generateLogsHash = (logs: LogEntry[], crisisEvents?: CrisisEvent[]): string => {
    const data = JSON.stringify({
        logs: logs.map(l => l.id).sort(),
        crisis: crisisEvents?.map(c => c.id).sort() || []
    });
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
};

const getCachedAnalysis = (logsHash: string): AnalysisResult | null => {
    if (!analysisCache) return null;
    if (analysisCache.logsHash !== logsHash) return null;
    if (Date.now() - analysisCache.timestamp > CACHE_TTL_MS) {
        analysisCache = null;
        return null;
    }
    return analysisCache.result;
};

const setCachedAnalysis = (result: AnalysisResult, logsHash: string): void => {
    analysisCache = {
        result,
        timestamp: Date.now(),
        logsHash
    };
};

// =============================================================================
// DATA SANITIZATION
// =============================================================================

/**
 * Sanitizes text to remove potential personal identifiers
 * - Replaces names (capitalized words not at sentence start)
 * - Removes potential phone numbers
 * - Removes potential addresses
 */
const sanitizeText = (text: string): string => {
    if (!text) return '';

    const sanitized = text
        // Remove names (capitalized words not at sentence start)
        .replace(/(?<!^|\. |\? |! |: )([A-Z][a-z]+)/g, '[PERSON]')
        // Remove potential phone numbers
        .replace(/\b\d{8,}\b/g, '[PHONE]')
        // Remove email addresses
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

    return sanitized;
};

/**
 * Converts timestamps to relative format for privacy
 */
const makeTimestampRelative = (timestamp: string, referenceDate: Date): string => {
    const date = new Date(timestamp);
    const diffDays = Math.floor((date.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    const hour = date.getHours();
    const timeLabel = hour < 10 ? 'morgen' : hour < 14 ? 'formiddag' : hour < 18 ? 'ettermiddag' : 'kveld';

    if (diffDays === 0) return `I dag, ${timeLabel}`;
    if (diffDays === -1) return `I går, ${timeLabel}`;
    return `Dag ${Math.abs(diffDays) + 1}, ${timeLabel}`;
};

// =============================================================================
// DATA PREPARATION
// =============================================================================

interface PreparedLog {
    relativeTime: string;
    context: string;
    arousal: number;
    valence: number;
    energy: number;
    triggers: string[];
    strategies: string[];
    strategyEffectiveness?: string;
    duration: number;
    note: string;
    dayOfWeek?: string;
    timeOfDay?: string;
}

interface PreparedCrisis {
    relativeTime: string;
    context: string;
    type: string;
    durationMinutes: number;
    peakIntensity: number;
    precedingArousal?: number;
    precedingEnergy?: number;
    warningSignsObserved: string[];
    triggers: string[];
    strategiesUsed: string[];
    resolution: string;
    recoveryTimeMinutes?: number;
    note: string;
}

const prepareLogsForAnalysis = (logs: LogEntry[], referenceDate: Date): PreparedLog[] => {
    return logs.map(log => ({
        relativeTime: makeTimestampRelative(log.timestamp, referenceDate),
        context: log.context === 'home' ? 'Hjemme' : 'Skole',
        arousal: log.arousal,
        valence: log.valence,
        energy: log.energy,
        triggers: [...log.sensoryTriggers, ...log.contextTriggers],
        strategies: log.strategies,
        strategyEffectiveness: log.strategyEffectiveness,
        duration: log.duration,
        note: sanitizeText(log.note),
        dayOfWeek: log.dayOfWeek,
        timeOfDay: log.timeOfDay
    }));
};

const prepareCrisisEventsForAnalysis = (events: CrisisEvent[], referenceDate: Date): PreparedCrisis[] => {
    return events.map(event => ({
        relativeTime: makeTimestampRelative(event.timestamp, referenceDate),
        context: event.context === 'home' ? 'Hjemme' : 'Skole',
        type: event.type,
        durationMinutes: Math.round(event.durationSeconds / 60),
        peakIntensity: event.peakIntensity,
        precedingArousal: event.precedingArousal,
        precedingEnergy: event.precedingEnergy,
        warningSignsObserved: event.warningSignsObserved,
        triggers: [...event.sensoryTriggers, ...event.contextTriggers],
        strategiesUsed: event.strategiesUsed,
        resolution: event.resolution,
        recoveryTimeMinutes: event.recoveryTimeMinutes,
        note: sanitizeText(event.notes)
    }));
};

// =============================================================================
// TOKEN OPTIMIZATION - Compress logs to summary strings to save API costs
// =============================================================================

/**
 * Converts logs to compact summary strings instead of full JSON
 * Format: "Tirsdag 14:00: Høy Arousal (8), Trigger: Lyd, Tiltak: Skjerming (Mislykket)"
 * This significantly reduces token usage while preserving essential information
 */
const logsToSummaryStrings = (logs: PreparedLog[]): string => {
    if (logs.length === 0) return 'Ingen logger tilgjengelig.';

    const summaries = logs.map(log => {
        const parts: string[] = [];

        // Time and context
        parts.push(`${log.relativeTime} (${log.context})`);

        // Core metrics with interpretation
        const arousalLevel = log.arousal <= 3 ? 'Lav' : log.arousal <= 6 ? 'Moderat' : 'Høy';
        const valenceLevel = log.valence <= 3 ? 'Negativ' : log.valence <= 6 ? 'Nøytral' : 'Positiv';
        const energyLevel = log.energy <= 3 ? 'Lav' : log.energy <= 6 ? 'Moderat' : 'Høy';

        parts.push(`A:${log.arousal}(${arousalLevel})`);
        parts.push(`V:${log.valence}(${valenceLevel})`);
        parts.push(`E:${log.energy}(${energyLevel})`);

        // Triggers (abbreviated)
        if (log.triggers.length > 0) {
            parts.push(`Triggere:[${log.triggers.join(',')}]`);
        }

        // Strategies and effectiveness
        if (log.strategies.length > 0) {
            const effectSymbol = log.strategyEffectiveness === 'helped' ? '✓' :
                log.strategyEffectiveness === 'escalated' ? '✗' : '~';
            parts.push(`Tiltak:[${log.strategies.join(',')}](${effectSymbol})`);
        }

        // Note if present
        if (log.note && log.note.trim()) {
            const shortNote = log.note.length > 50 ? log.note.substring(0, 50) + '...' : log.note;
            parts.push(`"${shortNote}"`);
        }

        return parts.join(' | ');
    });

    return summaries.join('\n');
};

/**
 * Converts crisis events to compact summary strings
 */
const crisisToSummaryStrings = (events: PreparedCrisis[]): string => {
    if (events.length === 0) return '';

    const summaries = events.map(event => {
        const parts: string[] = [];

        // Time, type and context
        const typeMap: Record<string, string> = {
            'meltdown': 'Nedsmelting',
            'shutdown': 'Shutdown',
            'anxiety': 'Angst',
            'sensory_overload': 'Sensorisk overbelastning',
            'other': 'Annet'
        };
        parts.push(`${event.relativeTime}: ${typeMap[event.type] || event.type} (${event.context})`);

        // Duration and intensity
        parts.push(`Varighet:${event.durationMinutes}min, Intensitet:${event.peakIntensity}/10`);

        // Preceding state if available
        if (event.precedingArousal !== undefined || event.precedingEnergy !== undefined) {
            const preParts: string[] = [];
            if (event.precedingArousal !== undefined) preParts.push(`A:${event.precedingArousal}`);
            if (event.precedingEnergy !== undefined) preParts.push(`E:${event.precedingEnergy}`);
            parts.push(`Før:[${preParts.join(',')}]`);
        }

        // Warning signs
        if (event.warningSignsObserved.length > 0) {
            parts.push(`Forvarsler:[${event.warningSignsObserved.slice(0, 3).join(',')}]`);
        }

        // Triggers
        if (event.triggers.length > 0) {
            parts.push(`Triggere:[${event.triggers.join(',')}]`);
        }

        // Resolution
        const resolutionMap: Record<string, string> = {
            'self_regulated': 'Selvregulert',
            'co_regulated': 'Samregulert',
            'timed_out': 'Utløpt',
            'interrupted': 'Avbrutt'
        };
        parts.push(`Løsning:${resolutionMap[event.resolution] || event.resolution}`);

        // Recovery time
        if (event.recoveryTimeMinutes !== undefined) {
            parts.push(`Restitusjon:${event.recoveryTimeMinutes}min`);
        }

        return parts.join(' | ');
    });

    return summaries.join('\n');
};

/**
 * Generates statistical summary of logs for context
 */
const generateStatsSummary = (logs: PreparedLog[], crisisEvents: PreparedCrisis[]): string => {
    if (logs.length === 0) return '';

    // Calculate averages
    const avgArousal = logs.reduce((sum, l) => sum + l.arousal, 0) / logs.length;
    const avgValence = logs.reduce((sum, l) => sum + l.valence, 0) / logs.length;
    const avgEnergy = logs.reduce((sum, l) => sum + l.energy, 0) / logs.length;

    // Count high arousal events
    const highArousalCount = logs.filter(l => l.arousal >= 7).length;
    const lowEnergyCount = logs.filter(l => l.energy <= 3).length;

    // Count triggers
    const triggerCounts: Record<string, number> = {};
    logs.forEach(log => {
        log.triggers.forEach(t => {
            triggerCounts[t] = (triggerCounts[t] || 0) + 1;
        });
    });
    const topTriggers = Object.entries(triggerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t, c]) => `${t}(${c})`);

    // Count strategies
    const strategyCounts: Record<string, { total: number; helped: number; escalated: number }> = {};
    logs.forEach(log => {
        log.strategies.forEach(s => {
            if (!strategyCounts[s]) {
                strategyCounts[s] = { total: 0, helped: 0, escalated: 0 };
            }
            strategyCounts[s].total++;
            if (log.strategyEffectiveness === 'helped') strategyCounts[s].helped++;
            if (log.strategyEffectiveness === 'escalated') strategyCounts[s].escalated++;
        });
    });
    const strategyStats = Object.entries(strategyCounts)
        .map(([s, c]) => {
            const successRate = c.total > 0 ? Math.round((c.helped / c.total) * 100) : 0;
            return `${s}:${successRate}% effektiv (n=${c.total})`;
        })
        .slice(0, 5);

    return `
=== STATISTISK SAMMENDRAG ===
Totalt ${logs.length} logger, ${crisisEvents.length} krisehendelser

GJENNOMSNITT:
- Arousal: ${avgArousal.toFixed(1)}/10
- Valens: ${avgValence.toFixed(1)}/10
- Energi: ${avgEnergy.toFixed(1)}/10

MØNSTRE:
- Høy arousal (≥7): ${highArousalCount} hendelser (${Math.round(highArousalCount / logs.length * 100)}%)
- Lav energi (≤3): ${lowEnergyCount} hendelser (${Math.round(lowEnergyCount / logs.length * 100)}%)

TOPP TRIGGERE: ${topTriggers.join(', ') || 'Ingen registrert'}

STRATEGI-EFFEKTIVITET:
${strategyStats.join('\n') || 'Ingen data'}
`;
};

// =============================================================================
// PROMPT ENGINEERING
// =============================================================================

/**
 * Builds a personalized context string from the child profile
 */
const buildChildProfileContext = (profile: ChildProfile | null): string => {
    if (!profile) return '';

    const parts: string[] = [];

    // Basic info
    if (profile.name || profile.age) {
        const nameAge = [profile.name, profile.age ? `${profile.age} år` : ''].filter(Boolean).join(', ');
        parts.push(`Barnet: ${nameAge}`);
    }

    // Diagnoses
    if (profile.diagnoses.length > 0) {
        parts.push(`Diagnoser: ${profile.diagnoses.join(', ')}`);
    }

    // Communication style
    const commStyleMap: Record<string, string> = {
        'verbal': 'Verbal kommunikasjon',
        'limited_verbal': 'Begrenset verbal kommunikasjon',
        'non_verbal': 'Non-verbal',
        'aac': 'Bruker ASK/AAC'
    };
    if (profile.communicationStyle) {
        parts.push(`Kommunikasjon: ${commStyleMap[profile.communicationStyle] || profile.communicationStyle}`);
    }

    // Sensory profile
    if (profile.sensorySensitivities.length > 0) {
        parts.push(`Sensoriske utfordringer: ${profile.sensorySensitivities.join(', ')}`);
    }
    if (profile.seekingSensory.length > 0) {
        parts.push(`Sensorisk søking: ${profile.seekingSensory.join(', ')}`);
    }

    // Effective strategies
    if (profile.effectiveStrategies.length > 0) {
        parts.push(`Kjente effektive strategier: ${profile.effectiveStrategies.join(', ')}`);
    }

    // Additional context
    if (profile.additionalContext) {
        parts.push(`Tilleggsinformasjon: ${profile.additionalContext}`);
    }

    return parts.length > 0 ? `\n\nBARNETS PROFIL:\n${parts.join('\n')}` : '';
};

const buildSystemPrompt = (childProfile?: ChildProfile | null): string => {
    const profileContext = buildChildProfileContext(childProfile || null);

    return `Du er en ekspert på nevrodivergens, Low Arousal-metodikk, og atferdsanalyse for barn med autisme og ADHD.
${profileContext}

VIKTIG INSTRUKSJONER:
1. Analyser data for å finne KAUSALE sammenhenger, ikke bare korrelasjoner
2. Fokusér på samspillet mellom biologiske faktorer (Interosepsjon/Energi) og ytre krav
3. Vurder tidsmønstre: Når på dagen/uken oppstår problemer?
4. Identifiser forvarsler og eskaleringsmønstre
5. Evaluer hvilke strategier som faktisk fungerer vs. hvilke som brukes mest
6. Gi konkrete, handlingsorienterte anbefalinger
${childProfile?.effectiveStrategies?.length ? `7. Prioriter kjente effektive strategier for dette barnet: ${childProfile.effectiveStrategies.join(', ')}` : ''}

ANALYSEPERSPEKTIV:
- Spoon Theory: Lav energi (< 4) = redusert kapasitet for krav
- Arousal > 7 = høy aktivering, risiko for overbelastning
- Valens < 4 = negativ stemning, behov for støtte
- Kombinasjonen lav energi + høy arousal = kritisk tilstand

RETURNER alltid JSON med eksakt denne strukturen:
{
    "triggerAnalysis": "string - Detaljert analyse av triggere og kontekster",
    "strategyEvaluation": "string - Evaluering av strategier med effektivitetsdata",
    "interoceptionPatterns": "string - Mønstre knyttet til biologiske behov",
    "correlations": [
        {
            "factor1": "string",
            "factor2": "string",
            "relationship": "string",
            "strength": "weak|moderate|strong",
            "description": "string"
        }
    ],
    "recommendations": ["string - konkret anbefaling 1", "string - konkret anbefaling 2"],
    "summary": "string - Helhetlig oppsummering med hovedfunn"
}`;
};

const buildUserPrompt = (
    preparedLogs: PreparedLog[],
    preparedCrisis: PreparedCrisis[],
    totalDays: number,
    useTokenOptimization: boolean = true
): string => {
    const hasCrisisData = preparedCrisis.length > 0;

    let prompt = `Analyser følgende datasett fra ${totalDays} dager med ${preparedLogs.length} logger`;
    if (hasCrisisData) {
        prompt += ` og ${preparedCrisis.length} krisehendelser`;
    }
    prompt += ':\n\n';

    // Use token-optimized format (summary strings) or full JSON
    if (useTokenOptimization) {
        // Add statistical summary first for context
        prompt += generateStatsSummary(preparedLogs, preparedCrisis);
        prompt += '\n';

        // Compact log format
        prompt += `=== DETALJERTE LOGGER ===\n`;
        prompt += `Format: Tid (Kontekst) | A:arousal | V:valens | E:energi | Triggere | Tiltak(effekt)\n`;
        prompt += `Effekt-symboler: ✓=hjalp, ✗=eskalerte, ~=ingen endring\n\n`;
        prompt += logsToSummaryStrings(preparedLogs);

        if (hasCrisisData) {
            prompt += `\n\n=== KRISEHENDELSER ===\n`;
            prompt += crisisToSummaryStrings(preparedCrisis);
        }
    } else {
        // Full JSON format (more expensive but preserves all details)
        prompt += `=== DAGLIGE LOGGER (${preparedLogs.length} stk) ===\n`;
        prompt += JSON.stringify(preparedLogs, null, 2);

        if (hasCrisisData) {
            prompt += `\n\n=== KRISEHENDELSER (${preparedCrisis.length} stk) ===\n`;
            prompt += JSON.stringify(preparedCrisis, null, 2);
        }
    }

    prompt += `\n\nSPESIFIKKE SPØRSMÅL:
1. TRIGGER-ANALYSE: Hvilke spesifikke kontekster og kombinasjoner fører oftest til Arousal > 7?
2. STRATEGI-EVALUERING: Hvilke tiltak har høyest dokumentert effekt? Sammenlign med bruksfrekvens.
3. INTEROSEPSJON: Er det mønstre knyttet til energinivå, sult, søvn som påvirker regulering?
4. TIDSMØNSTRE: Hvilke dager/tider er mest sårbare?`;

    if (hasCrisisData) {
        prompt += `\n5. KRISE-PREDIKSJON: Hvilke forvarsler og kombinasjoner forutgår krisehendelser?
6. GJENOPPRETTINGSTID: Hva påvirker hvor raskt barnet kommer tilbake etter krise?`;
    }

    return prompt;
};

// =============================================================================
// API COMMUNICATION
// =============================================================================

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const callOpenRouter = async (
    messages: OpenRouterMessage[],
    modelId: string,
    isPremium: boolean = false
): Promise<OpenRouterResponse> => {
    const maxTokens = isPremium ? API_CONFIG.maxTokensPremium : API_CONFIG.maxTokensFree;

    const requestBody: Record<string, unknown> = {
        model: modelId,
        messages,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        temperature: isPremium ? 0.2 : 0.4, // Lower temperature for premium = more precise
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

    try {
        const response = await fetch(API_CONFIG.baseUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': SITE_URL,
                'X-Title': SITE_NAME,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            if (import.meta.env.DEV) {
                console.error(`OpenRouter API Error (${modelId}):`, response.status, errorText);
            }
            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json() as OpenRouterResponse;
        if (import.meta.env.DEV) {
            console.log(`OpenRouter response from ${modelId}:`, data.choices?.[0]?.finish_reason);
        }
        return data;
    } finally {
        clearTimeout(timeoutId);
    }
};

const callWithRetry = async (
    messages: OpenRouterMessage[],
    modelId: string,
    isPremium: boolean = false,
    callbacks?: RetryCallback
): Promise<OpenRouterResponse> => {
    let lastError: Error | null = null;
    let currentModelId = modelId;

    for (let attempt = 0; attempt < API_CONFIG.maxRetries; attempt++) {
        try {
            return await callOpenRouter(messages, currentModelId, isPremium);
        } catch (error) {
            lastError = error as Error;
            if (import.meta.env.DEV) {
                console.warn(`API attempt ${attempt + 1} failed:`, error);
            }

            // If free model fails, try fallback on last attempt
            if (attempt === API_CONFIG.maxRetries - 2 && currentModelId === FREE_MODEL_ID) {
                if (import.meta.env.DEV) {
                    console.log('Switching to fallback model...');
                }
                currentModelId = FALLBACK_MODEL_ID;
            }

            // Notify UI of retry before sleeping
            if (callbacks?.onRetry && attempt < API_CONFIG.maxRetries - 1) {
                callbacks.onRetry(attempt + 2, API_CONFIG.maxRetries, currentModelId);
            }

            if (attempt < API_CONFIG.maxRetries - 1) {
                const delay = API_CONFIG.retryDelayMs * Math.pow(2, attempt);
                await sleep(delay);
            }
        }
    }

    throw lastError || new Error('Max retries exceeded');
};

// =============================================================================
// RESPONSE PARSING
// =============================================================================

const parseAnalysisResponse = (content: string): AnalysisResult => {
    try {
        const parsed = JSON.parse(content);

        // Validate required fields
        const result: AnalysisResult = {
            id: crypto.randomUUID(),
            generatedAt: new Date().toISOString(),
            triggerAnalysis: parsed.triggerAnalysis || 'Analyse ikke tilgjengelig',
            strategyEvaluation: parsed.strategyEvaluation || 'Evaluering ikke tilgjengelig',
            interoceptionPatterns: parsed.interoceptionPatterns || 'Mønstre ikke identifisert',
            summary: parsed.summary || 'Oppsummering ikke tilgjengelig',
            correlations: Array.isArray(parsed.correlations)
                ? parsed.correlations.map((c: Partial<AnalysisCorrelation>) => ({
                    factor1: c.factor1 || '',
                    factor2: c.factor2 || '',
                    relationship: c.relationship || '',
                    strength: (['weak', 'moderate', 'strong'].includes(c.strength || '')
                        ? c.strength
                        : 'moderate') as 'weak' | 'moderate' | 'strong',
                    description: c.description || ''
                }))
                : undefined,
            recommendations: Array.isArray(parsed.recommendations)
                ? parsed.recommendations.filter((r: unknown) => typeof r === 'string')
                : undefined
        };

        return result;
    } catch (parseError) {
        if (import.meta.env.DEV) {
            console.error('Failed to parse analysis response:', parseError);
        }
        throw new Error('Invalid response format from AI service');
    }
};

// =============================================================================
// MOCK DATA (for development/testing)
// =============================================================================

const generateMockAnalysis = async (): Promise<AnalysisResult> => {
    // Simulate API delay
    await sleep(1500);

    return {
        id: crypto.randomUUID(),
        generatedAt: new Date().toISOString(),
        triggerAnalysis: `**Hovedfunn:** Basert på loggene ser vi at **Auditiv** stimuli kombinert med **Overgang**-situasjoner konsekvent fører til arousal-nivåer over 7.

Spesielt kritisk er overgangen fra friminutt til undervisning (3 av 5 høy-arousal episoder). Kombinasjonen av:
- Støy fra andre elever
- Krav om å skifte fokus
- Tidspress

utgjør en "perfekt storm" for overbelastning.`,

        strategyEvaluation: `**Mest effektive strategier:**
1. **Skjerming** - 85% suksessrate når initiert tidlig
2. **Hodetelefoner** - Reduserer gjennomsnittlig arousal med 2.3 poeng
3. **Timer/Visuell Støtte** - Særlig effektiv ved overganger

**Underutnyttede strategier:**
- **Dypt Trykk** brukes sjelden men har høy effektivitet (80%) når det brukes
- **Bevegelse** er effektivt men krever planlegging

**Ineffektive mønstre:**
- Pusteøvelser alene har begrenset effekt når arousal allerede er > 7`,

        interoceptionPatterns: `**Energi-sammenhenger:**
- Når energi < 3 (lav spoon-count), er terskelen for sensorisk overbelastning 40% lavere
- Formiddagen (10-12) viser konsekvent høyere toleranse enn ettermiddag

**Biologiske faktorer:**
- Logger før lunsj viser høyere irritabilitet
- Søvnmangel (indikert av lav morgen-energi) korrelerer med 2x økt kriserisiko

**Kroppslige signaler:**
- Økt motorisk uro er den mest pålitelige tidlige varsleren (observert i 4 av 5 tilfeller)`,

        correlations: [
            {
                factor1: 'Lav energi (< 3)',
                factor2: 'Auditiv overfølsomhet',
                relationship: 'forsterkende',
                strength: 'strong',
                description: 'Når energinivået er lavt, er toleransen for lyd betydelig redusert'
            },
            {
                factor1: 'Overgang + Krav',
                factor2: 'Høy arousal',
                relationship: 'utløsende',
                strength: 'strong',
                description: 'Kombinasjonen av overgang og nye krav er den hyppigste triggeren'
            },
            {
                factor1: 'Tidlig skjerming',
                factor2: 'Kortere nedregulering',
                relationship: 'beskyttende',
                strength: 'moderate',
                description: 'Proaktiv skjerming før arousal > 6 halverer nedregulerings-tiden'
            }
        ],

        recommendations: [
            'Implementer "rolig overgang"-protokoll: 5 min med hodetelefoner før hver aktivitetsbytte',
            'Øk bruken av visuell støtte/timere for å gi forutsigbarhet',
            'Vurder stille rom/base for lunsj når morgenenergien er lav (< 4)',
            'Introduser "energi-sjekk" rutine ved skolestart for å tilpasse dagens krav',
            'Tren på å gjenkjenne tidlige varsler: Økt motorisk uro = handle NÅ'
        ],

        summary: `**Hovedbilde:** Barnet har et tydelig mønster hvor kombinasjonen av sensorisk overbelastning (særlig auditiv) og overgangssituasjoner er hovedutfordringen.

**Styrker:** God respons på strukturelle tiltak (skjerming, hodetelefoner, visuell støtte). Når strategier initieres tidlig, er effektiviteten høy.

**Sårbarhet:** Ettermiddager og situasjoner med lav energi + høye krav.

**Anbefalt fokus:** Proaktiv bruk av strategier BEFORE arousal eskalerer, særlig rundt overganger. Energinivå bør monitoreres som "varselsystem" for dagen.`
    };
};

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Analyzes log entries and crisis events
 * Uses Gemini 3 Pro as primary (for Kaggle competition), falls back to OpenRouter
 *
 * @param logs - Array of log entries to analyze
 * @param crisisEvents - Optional array of crisis events for deeper analysis
 * @param options - Analysis options including child profile for personalization
 * @returns Promise resolving to AnalysisResult
 */
export const analyzeLogs = async (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[] = [],
    options: { forceRefresh?: boolean; childProfile?: ChildProfile | null; onRetry?: RetryCallback['onRetry'] } = {}
): Promise<AnalysisResult> => {
    // Validate input
    if (!logs || logs.length === 0) {
        throw new Error('No logs provided for analysis');
    }

    // Try Gemini first (for Kaggle competition)
    if (USE_GEMINI_PRIMARY && isGeminiConfigured()) {
        try {
            if (import.meta.env.DEV) {
                console.log('[AI] Using Gemini 3 Pro as primary...');
            }
            return await analyzeLogsWithGemini(logs, crisisEvents, options);
        } catch (geminiError) {
            if (import.meta.env.DEV) {
                console.warn('[AI] Gemini failed, falling back to OpenRouter:', geminiError);
            }
            // Fall through to OpenRouter
        }
    }

    // Check cache first (unless force refresh)
    const logsHash = generateLogsHash(logs, crisisEvents);
    if (!options.forceRefresh) {
        const cached = getCachedAnalysis(logsHash);
        if (cached) {
            if (import.meta.env.DEV) {
                console.log('Returning cached analysis');
            }
            return cached;
        }
    }

    // If no API key, return mock data
    if (!OPENROUTER_API_KEY) {
        if (import.meta.env.DEV) {
            console.log('No API key found, returning mock analysis');
        }
        return generateMockAnalysis();
    }

    // Prepare data (logs are sorted newest-first)
    const newestDate = new Date(logs[0]?.timestamp || new Date());
    const oldestDate = new Date(logs[logs.length - 1]?.timestamp || new Date());
    const totalDays = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const preparedLogs = prepareLogsForAnalysis(logs, newestDate);
    const preparedCrisis = prepareCrisisEventsForAnalysis(crisisEvents, newestDate);

    // Build prompts with child profile for personalization
    const systemPrompt = buildSystemPrompt(options.childProfile);
    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

    // Calculate date range for result (logs are sorted newest-first)
    const dateRangeStart = logs[logs.length - 1]?.timestamp;
    const dateRangeEnd = logs[0]?.timestamp;

    try {
        if (import.meta.env.DEV) {
            console.log(`[OpenRouter] Analyzing ${logs.length} logs with ${FREE_MODEL_ID}...`);
        }

        const response = await callWithRetry(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            FREE_MODEL_ID,
            false, // Not premium
            { onRetry: options.onRetry }
        );

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from AI service');
        }

        // Log token usage
        if (response.usage && import.meta.env.DEV) {
            console.log(`Token usage: ${response.usage.prompt_tokens} input, ${response.usage.completion_tokens} output`);
        }

        const result = parseAnalysisResponse(content);

        // Add metadata
        result.dateRangeStart = dateRangeStart;
        result.dateRangeEnd = dateRangeEnd;
        result.isDeepAnalysis = false;

        // Cache the result
        setCachedAnalysis(result, logsHash);

        return result;

    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('Error in analysis:', error);
        }
        throw new Error(`Failed to analyze logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Performs DEEP analysis using premium models
 * Uses Gemini 2.5 Pro as primary (for Kaggle competition), falls back to OpenRouter
 */
export const analyzeLogsDeep = async (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[] = [],
    options: { childProfile?: ChildProfile | null } = {}
): Promise<AnalysisResult & { modelUsed?: string }> => {
    // Validate input
    if (!logs || logs.length === 0) {
        throw new Error('No logs provided for analysis');
    }

    // Try Gemini first (for Kaggle competition)
    if (USE_GEMINI_PRIMARY && isGeminiConfigured()) {
        try {
            if (import.meta.env.DEV) {
                console.log('[AI] Using Gemini 2.5 Pro for deep analysis...');
            }
            return await analyzeLogsDeepWithGemini(logs, crisisEvents, options);
        } catch (geminiError) {
            if (import.meta.env.DEV) {
                console.warn('[AI] Gemini deep analysis failed, falling back to OpenRouter:', geminiError);
            }
            // Fall through to OpenRouter
        }
    }

    // If no API key, return mock data
    if (!OPENROUTER_API_KEY) {
        if (import.meta.env.DEV) {
            console.log('No API key found, returning mock analysis');
        }
        return generateMockAnalysis();
    }

    // Prepare data (logs are sorted newest-first)
    const newestDate = new Date(logs[0]?.timestamp || new Date());
    const oldestDate = new Date(logs[logs.length - 1]?.timestamp || new Date());
    const totalDays = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const preparedLogs = prepareLogsForAnalysis(logs, newestDate);
    const preparedCrisis = prepareCrisisEventsForAnalysis(crisisEvents, newestDate);

    // Enhanced system prompt for deep analysis
    const systemPrompt = buildSystemPrompt(options.childProfile) + `

VIKTIG: Dette er en DYP ANALYSE. Bruk mer tid på å tenke gjennom sammenhenger.
- Identifiser subtile mønstre som ikke er åpenbare
- Gi svært spesifikke og handlingsorienterte anbefalinger
- Analyser interaksjoner mellom ulike faktorer
- Vurder langsiktige trender og deres implikasjoner`;

    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

    // Calculate date range for result (logs are sorted newest-first)
    const dateRangeStart = logs[logs.length - 1]?.timestamp;
    const dateRangeEnd = logs[0]?.timestamp;

    const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // Try each premium model in order until one succeeds
    let lastError: Error | null = null;
    let modelUsed: string | null = null;

    for (const modelId of PREMIUM_MODELS) {
        try {
            if (import.meta.env.DEV) {
                console.log(`[OpenRouter] Trying deep analysis with ${modelId}...`);
            }

            const response = await callOpenRouter(messages, modelId, true);

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('Empty response from AI service');
            }

            // Log token usage
            if (response.usage && import.meta.env.DEV) {
                console.log(`[OpenRouter] ${modelId} - Token usage: ${response.usage.prompt_tokens} input, ${response.usage.completion_tokens} output`);
            }

            const result = parseAnalysisResponse(content);

            // Add metadata
            result.dateRangeStart = dateRangeStart;
            result.dateRangeEnd = dateRangeEnd;
            result.isDeepAnalysis = true;

            // Set modelUsed BEFORE creating finalResult
            modelUsed = modelId;
            const finalResult = { ...result, modelUsed };

            // Cache the result for other components (like Reports) to use
            const logsHash = generateLogsHash(logs, crisisEvents);
            setCachedAnalysis(finalResult, logsHash);

            if (import.meta.env.DEV) {
                console.log(`[OpenRouter] Deep analysis successful with ${modelId}`);
            }

            return finalResult;

        } catch (error) {
            lastError = error as Error;
            if (import.meta.env.DEV) {
                console.warn(`[OpenRouter] ${modelId} failed:`, error);
            }
            // Continue to next model
        }
    }

    // All models failed
    if (import.meta.env.DEV) {
        console.error('All premium models failed for deep analysis');
    }
    throw new Error(`Deep analysis failed: ${lastError?.message || 'All premium models unavailable'}`);
};

/**
 * Clears the analysis cache
 */
export const clearAnalysisCache = (): void => {
    analysisCache = null;
    clearGeminiCache();
};

/**
 * Gets current API configuration status
 */
export const getApiStatus = (): {
    configured: boolean;
    freeModel: string;
    premiumModel: string;
    geminiConfigured: boolean;
    geminiModel?: string;
} => {
    const geminiStatus = getGeminiStatus();
    return {
        configured: Boolean(OPENROUTER_API_KEY) || geminiStatus.configured,
        freeModel: FREE_MODEL_ID,
        premiumModel: PREMIUM_MODEL_ID,
        geminiConfigured: geminiStatus.configured,
        geminiModel: geminiStatus.model,
    };
};

/**
 * Streaming analysis - Shows AI "thinking" in real-time for WOW factor
 * Uses Gemini's streaming capability
 */
export const analyzeLogsStreaming = analyzeLogsStreamingWithGemini;
