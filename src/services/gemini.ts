import { GoogleGenAI } from "@google/genai";
import type { LogEntry, AnalysisResult, CrisisEvent, AnalysisCorrelation, ChildProfile } from '../types';

// =============================================================================
// GEMINI 3 PRO CONFIGURATION
// For Kaggle Competition: "Vibe Code with Gemini 3 Pro in AI Studio"
// =============================================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize the Gemini client
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Model configuration - Using Gemini 3 Pro for the competition
const MODEL_ID = 'gemini-2.0-flash'; // Will update to gemini-3-pro when available
const PREMIUM_MODEL_ID = 'gemini-2.5-pro-preview-06-05'; // For deep analysis

// =============================================================================
// TYPES
// =============================================================================

interface StreamCallbacks {
    onChunk?: (chunk: string) => void;
    onComplete?: (fullText: string) => void;
    onError?: (error: Error) => void;
    onRetry?: (attempt: number, maxRetries: number) => void;
}

// Streaming retry configuration
const MAX_STREAMING_RETRIES = 2;
const STREAMING_RETRY_DELAY_MS = 1500;

interface AnalysisCache {
    result: AnalysisResult;
    timestamp: number;
    logsHash: string;
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

const sanitizeText = (text: string): string => {
    if (!text) return '';
    return text
        .replace(/(?<!^|\. |\? |! |: )([A-Z][a-z]+)/g, '[PERSON]')
        .replace(/\b\d{8,}\b/g, '[PHONE]')
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
};

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
// TOKEN OPTIMIZATION
// =============================================================================

const logsToSummaryStrings = (logs: PreparedLog[]): string => {
    if (logs.length === 0) return 'Ingen logger tilgjengelig.';

    const summaries = logs.map(log => {
        const parts: string[] = [];
        parts.push(`${log.relativeTime} (${log.context})`);

        const arousalLevel = log.arousal <= 3 ? 'Lav' : log.arousal <= 6 ? 'Moderat' : 'Høy';
        const valenceLevel = log.valence <= 3 ? 'Negativ' : log.valence <= 6 ? 'Nøytral' : 'Positiv';
        const energyLevel = log.energy <= 3 ? 'Lav' : log.energy <= 6 ? 'Moderat' : 'Høy';

        parts.push(`A:${log.arousal}(${arousalLevel})`);
        parts.push(`V:${log.valence}(${valenceLevel})`);
        parts.push(`E:${log.energy}(${energyLevel})`);

        if (log.triggers.length > 0) {
            parts.push(`Triggere:[${log.triggers.join(',')}]`);
        }

        if (log.strategies.length > 0) {
            const effectSymbol = log.strategyEffectiveness === 'helped' ? '✓' :
                log.strategyEffectiveness === 'escalated' ? '✗' : '~';
            parts.push(`Tiltak:[${log.strategies.join(',')}](${effectSymbol})`);
        }

        if (log.note && log.note.trim()) {
            const shortNote = log.note.length > 50 ? log.note.substring(0, 50) + '...' : log.note;
            parts.push(`"${shortNote}"`);
        }

        return parts.join(' | ');
    });

    return summaries.join('\n');
};

const crisisToSummaryStrings = (events: PreparedCrisis[]): string => {
    if (events.length === 0) return '';

    const summaries = events.map(event => {
        const parts: string[] = [];
        const typeMap: Record<string, string> = {
            'meltdown': 'Nedsmelting',
            'shutdown': 'Shutdown',
            'anxiety': 'Angst',
            'sensory_overload': 'Sensorisk overbelastning',
            'other': 'Annet'
        };
        parts.push(`${event.relativeTime}: ${typeMap[event.type] || event.type} (${event.context})`);
        parts.push(`Varighet:${event.durationMinutes}min, Intensitet:${event.peakIntensity}/10`);

        if (event.precedingArousal !== undefined || event.precedingEnergy !== undefined) {
            const preParts: string[] = [];
            if (event.precedingArousal !== undefined) preParts.push(`A:${event.precedingArousal}`);
            if (event.precedingEnergy !== undefined) preParts.push(`E:${event.precedingEnergy}`);
            parts.push(`Før:[${preParts.join(',')}]`);
        }

        if (event.warningSignsObserved.length > 0) {
            parts.push(`Forvarsler:[${event.warningSignsObserved.slice(0, 3).join(',')}]`);
        }

        if (event.triggers.length > 0) {
            parts.push(`Triggere:[${event.triggers.join(',')}]`);
        }

        const resolutionMap: Record<string, string> = {
            'self_regulated': 'Selvregulert',
            'co_regulated': 'Samregulert',
            'timed_out': 'Utløpt',
            'interrupted': 'Avbrutt'
        };
        parts.push(`Løsning:${resolutionMap[event.resolution] || event.resolution}`);

        if (event.recoveryTimeMinutes !== undefined) {
            parts.push(`Restitusjon:${event.recoveryTimeMinutes}min`);
        }

        return parts.join(' | ');
    });

    return summaries.join('\n');
};

const generateStatsSummary = (logs: PreparedLog[], crisisEvents: PreparedCrisis[]): string => {
    if (logs.length === 0) return '';

    const avgArousal = logs.reduce((sum, l) => sum + l.arousal, 0) / logs.length;
    const avgValence = logs.reduce((sum, l) => sum + l.valence, 0) / logs.length;
    const avgEnergy = logs.reduce((sum, l) => sum + l.energy, 0) / logs.length;

    const highArousalCount = logs.filter(l => l.arousal >= 7).length;
    const lowEnergyCount = logs.filter(l => l.energy <= 3).length;

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

const buildChildProfileContext = (profile: ChildProfile | null): string => {
    if (!profile) return '';

    const parts: string[] = [];

    if (profile.name || profile.age) {
        const nameAge = [profile.name, profile.age ? `${profile.age} år` : ''].filter(Boolean).join(', ');
        parts.push(`Barnet: ${nameAge}`);
    }

    if (profile.diagnoses.length > 0) {
        parts.push(`Diagnoser: ${profile.diagnoses.join(', ')}`);
    }

    const commStyleMap: Record<string, string> = {
        'verbal': 'Verbal kommunikasjon',
        'limited_verbal': 'Begrenset verbal kommunikasjon',
        'non_verbal': 'Non-verbal',
        'aac': 'Bruker ASK/AAC'
    };
    if (profile.communicationStyle) {
        parts.push(`Kommunikasjon: ${commStyleMap[profile.communicationStyle] || profile.communicationStyle}`);
    }

    if (profile.sensorySensitivities.length > 0) {
        parts.push(`Sensoriske utfordringer: ${profile.sensorySensitivities.join(', ')}`);
    }
    if (profile.seekingSensory.length > 0) {
        parts.push(`Sensorisk søking: ${profile.seekingSensory.join(', ')}`);
    }

    if (profile.effectiveStrategies.length > 0) {
        parts.push(`Kjente effektive strategier: ${profile.effectiveStrategies.join(', ')}`);
    }

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
    totalDays: number
): string => {
    const hasCrisisData = preparedCrisis.length > 0;

    let prompt = `Analyser følgende datasett fra ${totalDays} dager med ${preparedLogs.length} logger`;
    if (hasCrisisData) {
        prompt += ` og ${preparedCrisis.length} krisehendelser`;
    }
    prompt += ':\n\n';

    prompt += generateStatsSummary(preparedLogs, preparedCrisis);
    prompt += '\n';

    prompt += `=== DETALJERTE LOGGER ===\n`;
    prompt += `Format: Tid (Kontekst) | A:arousal | V:valens | E:energi | Triggere | Tiltak(effekt)\n`;
    prompt += `Effekt-symboler: ✓=hjalp, ✗=eskalerte, ~=ingen endring\n\n`;
    prompt += logsToSummaryStrings(preparedLogs);

    if (hasCrisisData) {
        prompt += `\n\n=== KRISEHENDELSER ===\n`;
        prompt += crisisToSummaryStrings(preparedCrisis);
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
// RESPONSE PARSING
// =============================================================================

const parseAnalysisResponse = (content: string): AnalysisResult => {
    try {
        // Try to extract JSON from the response
        let jsonContent = content;

        // If wrapped in markdown code blocks, extract the JSON
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch?.[1]) {
            jsonContent = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonContent);

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
            console.error('Failed to parse analysis response:', parseError, content);
        }
        throw new Error('Invalid response format from Gemini');
    }
};

// =============================================================================
// GEMINI API CALLS
// =============================================================================

/**
 * Analyze logs using Gemini 3 Pro
 */
export const analyzeLogsWithGemini = async (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[] = [],
    options: { forceRefresh?: boolean; childProfile?: ChildProfile | null } = {}
): Promise<AnalysisResult> => {
    if (!logs || logs.length === 0) {
        throw new Error('No logs provided for analysis');
    }

    // Check cache first
    const logsHash = generateLogsHash(logs, crisisEvents);
    if (!options.forceRefresh) {
        const cached = getCachedAnalysis(logsHash);
        if (cached) {
            if (import.meta.env.DEV) {
                console.log('[Gemini] Returning cached analysis');
            }
            return cached;
        }
    }

    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    // Prepare data (logs are sorted newest-first)
    const newestDate = new Date(logs[0]?.timestamp || new Date());
    const oldestDate = new Date(logs[logs.length - 1]?.timestamp || new Date());
    const totalDays = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const preparedLogs = prepareLogsForAnalysis(logs, newestDate);
    const preparedCrisis = prepareCrisisEventsForAnalysis(crisisEvents, newestDate);

    const systemPrompt = buildSystemPrompt(options.childProfile);
    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

    try {
        if (import.meta.env.DEV) {
            console.log(`[Gemini] Analyzing ${logs.length} logs with ${MODEL_ID}...`);
        }

        const response = await genAI.models.generateContent({
            model: MODEL_ID,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                }
            ],
            config: {
                temperature: 0.3,
                maxOutputTokens: 4000,
                responseMimeType: 'application/json'
            }
        });

        const content = response.text;
        if (!content) {
            throw new Error('Empty response from Gemini');
        }

        if (import.meta.env.DEV) {
            console.log('[Gemini] Response received, parsing...');
        }

        const result = parseAnalysisResponse(content);

        // Add metadata (logs are sorted newest-first)
        result.dateRangeStart = logs[logs.length - 1]?.timestamp;
        result.dateRangeEnd = logs[0]?.timestamp;
        result.isDeepAnalysis = false;
        result.modelUsed = MODEL_ID;

        // Cache the result
        setCachedAnalysis(result, logsHash);

        return result;

    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('[Gemini] Error in analysis:', error);
        }
        throw new Error(`Failed to analyze logs with Gemini: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Deep analysis using Gemini 2.5 Pro (premium model)
 */
export const analyzeLogsDeepWithGemini = async (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[] = [],
    options: { childProfile?: ChildProfile | null } = {}
): Promise<AnalysisResult & { modelUsed?: string }> => {
    if (!logs || logs.length === 0) {
        throw new Error('No logs provided for analysis');
    }

    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    // Prepare data (logs are sorted newest-first)
    const newestDate = new Date(logs[0]?.timestamp || new Date());
    const oldestDate = new Date(logs[logs.length - 1]?.timestamp || new Date());
    const totalDays = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const preparedLogs = prepareLogsForAnalysis(logs, newestDate);
    const preparedCrisis = prepareCrisisEventsForAnalysis(crisisEvents, newestDate);

    const systemPrompt = buildSystemPrompt(options.childProfile) + `

VIKTIG: Dette er en DYP ANALYSE. Bruk mer tid på å tenke gjennom sammenhenger.
- Identifiser subtile mønstre som ikke er åpenbare
- Gi svært spesifikke og handlingsorienterte anbefalinger
- Analyser interaksjoner mellom ulike faktorer
- Vurder langsiktige trender og deres implikasjoner`;

    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

    try {
        if (import.meta.env.DEV) {
            console.log(`[Gemini] Deep analysis with ${PREMIUM_MODEL_ID}...`);
        }

        const response = await genAI.models.generateContent({
            model: PREMIUM_MODEL_ID,
            contents: [
                {
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                }
            ],
            config: {
                temperature: 0.2,
                maxOutputTokens: 8000,
                responseMimeType: 'application/json'
            }
        });

        const content = response.text;
        if (!content) {
            throw new Error('Empty response from Gemini');
        }

        const result = parseAnalysisResponse(content);

        // Add metadata (logs are sorted newest-first)
        result.dateRangeStart = logs[logs.length - 1]?.timestamp;
        result.dateRangeEnd = logs[0]?.timestamp;
        result.isDeepAnalysis = true;
        result.modelUsed = PREMIUM_MODEL_ID;

        // Cache the result
        const logsHash = generateLogsHash(logs, crisisEvents);
        setCachedAnalysis(result, logsHash);

        return { ...result, modelUsed: PREMIUM_MODEL_ID };

    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('[Gemini] Error in deep analysis:', error);
        }
        throw new Error(`Deep analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * Streaming analysis - Shows AI "thinking" in real-time for WOW factor
 * Includes retry logic for resilience
 */
export const analyzeLogsStreamingWithGemini = async (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[] = [],
    callbacks: StreamCallbacks,
    options: { childProfile?: ChildProfile | null } = {}
): Promise<AnalysisResult> => {
    if (!logs || logs.length === 0) {
        throw new Error('No logs provided for analysis');
    }

    if (!GEMINI_API_KEY) {
        throw new Error('Gemini API key not configured');
    }

    // Prepare data (logs are sorted newest-first)
    const newestDate = new Date(logs[0]?.timestamp || new Date());
    const oldestDate = new Date(logs[logs.length - 1]?.timestamp || new Date());
    const totalDays = Math.ceil((newestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const preparedLogs = prepareLogsForAnalysis(logs, newestDate);
    const preparedCrisis = prepareCrisisEventsForAnalysis(crisisEvents, newestDate);

    const systemPrompt = buildSystemPrompt(options.childProfile);
    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

    let lastError: Error | null = null;

    // Retry loop for streaming resilience
    for (let attempt = 0; attempt < MAX_STREAMING_RETRIES; attempt++) {
        try {
            if (import.meta.env.DEV) {
                console.log(`[Gemini] Streaming analysis with ${MODEL_ID} (attempt ${attempt + 1})...`);
            }

            const response = await genAI.models.generateContentStream({
                model: MODEL_ID,
                contents: [
                    {
                        role: 'user',
                        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                    }
                ],
                config: {
                    temperature: 0.3,
                    maxOutputTokens: 4000,
                    responseMimeType: 'application/json'
                }
            });

            let fullText = '';

            for await (const chunk of response) {
                const chunkText = chunk.text || '';
                fullText += chunkText;

                if (callbacks.onChunk) {
                    callbacks.onChunk(chunkText);
                }
            }

            if (callbacks.onComplete) {
                callbacks.onComplete(fullText);
            }

            const result = parseAnalysisResponse(fullText);

            // Add metadata (logs are sorted newest-first)
            result.dateRangeStart = logs[logs.length - 1]?.timestamp;
            result.dateRangeEnd = logs[0]?.timestamp;
            result.isDeepAnalysis = false;
            result.modelUsed = MODEL_ID;

            // Cache the result
            const logsHash = generateLogsHash(logs, crisisEvents);
            setCachedAnalysis(result, logsHash);

            return result;

        } catch (error) {
            lastError = error as Error;
            if (import.meta.env.DEV) {
                console.warn(`[Gemini] Streaming attempt ${attempt + 1} failed:`, error);
            }

            // If not the last attempt, notify and retry
            if (attempt < MAX_STREAMING_RETRIES - 1) {
                callbacks.onRetry?.(attempt + 2, MAX_STREAMING_RETRIES);
                await new Promise(resolve => setTimeout(resolve, STREAMING_RETRY_DELAY_MS));
            }
        }
    }

    // All retries failed
    if (callbacks.onError && lastError) {
        callbacks.onError(lastError);
    }
    throw lastError || new Error('Streaming failed after retries');
};

/**
 * Clear the analysis cache
 */
export const clearGeminiCache = (): void => {
    analysisCache = null;
};

/**
 * Check if Gemini API is configured
 */
export const isGeminiConfigured = (): boolean => {
    return Boolean(GEMINI_API_KEY);
};

/**
 * Get Gemini API status
 */
export const getGeminiStatus = (): {
    configured: boolean;
    model: string;
    premiumModel: string;
} => {
    return {
        configured: Boolean(GEMINI_API_KEY),
        model: MODEL_ID,
        premiumModel: PREMIUM_MODEL_ID
    };
};
