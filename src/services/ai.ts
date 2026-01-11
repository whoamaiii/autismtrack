import type { LogEntry, AnalysisResult, CrisisEvent, ChildProfile } from '../types';
import {
    analyzeLogsWithGemini,
    analyzeLogsDeepWithGemini,
    analyzeLogsStreamingWithGemini,
    isGeminiConfigured,
    getGeminiStatus,
    clearGeminiCache
} from './gemini';
import {
    generateLogsHash,
    createAnalysisCache,
    prepareAnalysisData,
    buildSystemPrompt,
    buildUserPrompt,
    parseAnalysisResponse,
    type StreamCallbacks
} from './aiCommon';

// =============================================================================
// CONFIGURATION
// =============================================================================

// Fallback to Gemini if OpenRouter fails
const USE_GEMINI_FALLBACK = true;

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const SITE_URL = import.meta.env.VITE_SITE_URL || 'http://localhost:5173';
const SITE_NAME = 'NeuroLogg Pro';

// =============================================================================
// ERROR REPORTING
// =============================================================================

/**
 * Reports errors to logging service in production
 * In development, logs to console for debugging
 * @internal Reserved for future Sentry/LogRocket integration
 */
 
export function reportAIError(error: Error, context: Record<string, unknown>): void {
    if (import.meta.env.PROD) {
        // Future: Send to Sentry/LogRocket/custom error service
        console.error('[AI Error]', {
            message: error.message,
            stack: error.stack,
            ...context,
            timestamp: new Date().toISOString()
        });
    } else {
        console.error('[AI Error]', error.message, context);
    }
}

// =============================================================================
// MODEL CONFIGURATION
// =============================================================================

// FREE model for quick/automatic analysis
// Using Gemini Flash which is very cheap and reliable
const FREE_MODEL_ID = 'google/gemini-2.0-flash-001';

// PREMIUM models for deep analysis - ordered by preference
// Using verified OpenRouter model IDs
const PREMIUM_MODELS = [
    'google/gemini-2.5-pro-preview',  // Best: 1M context, strong reasoning
    'anthropic/claude-3.5-sonnet',     // Excellent: Balanced reasoning and analysis
    'openai/gpt-4o',                   // Fallback: Fast, reliable multimodal
] as const;

// Primary premium model
const PREMIUM_MODEL_ID = PREMIUM_MODELS[0];

// Fallback if free model fails
const FALLBACK_MODEL_ID = 'google/gemini-2.5-flash-preview-05-20';

// API Configuration - All configurable values in one place
const API_CONFIG = {
    // Endpoints
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',

    // Timeouts
    timeoutMs: 60000,           // Regular analysis: 1 minute
    timeoutMsPremium: 180000,   // Deep analysis: 3 minutes

    // Retry configuration
    maxRetries: 3,
    retryDelayMs: 1000,         // Base delay (exponential backoff applied)

    // Streaming retry configuration
    maxStreamingRetries: 2,
    streamingRetryDelayMs: 1500,
    streamReadTimeoutMs: 60000,  // Stream read timeout: 60 seconds

    // Token limits
    maxTokensFree: 4000,
    maxTokensPremium: 8000,

    // Temperature (creativity level)
    temperatureFree: 0.4,
    temperaturePremium: 0.2,

    // Cache
    cacheTtlMs: 15 * 60 * 1000, // 15 minutes

    // Mock/dev
    mockDelayMs: 1500,
} as const;

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

// Retry callback for UI visibility
export interface RetryCallback {
    onRetry?: (attempt: number, maxRetries: number, modelId: string) => void;
}

// =============================================================================
// CACHING (using shared cache factory with analysis type support)
// =============================================================================
const cache = createAnalysisCache();

// =============================================================================
// REQUEST DEDUPLICATION
// =============================================================================
// Prevents duplicate API calls when user clicks analyze multiple times rapidly
const pendingRequests = new Map<string, Promise<AnalysisResult>>();

/**
 * Deduplicates concurrent requests with the same key
 * If a request with the same key is already in progress, returns the existing promise
 */
function deduplicatedRequest<T extends AnalysisResult>(
    key: string,
    requestFn: () => Promise<T>
): Promise<T> {
    const existing = pendingRequests.get(key);
    if (existing) {
        if (import.meta.env.DEV) {
            console.log(`[AI] Request deduplicated: ${key}`);
        }
        return existing as Promise<T>;
    }

    const promise = requestFn().finally(() => {
        pendingRequests.delete(key);
    });

    pendingRequests.set(key, promise);
    return promise;
}

// =============================================================================
// API UTILITIES
// =============================================================================

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Parses API error responses into readable error messages
 * Handles both JSON and plain text error formats
 */
const parseApiError = (errorText: string): string => {
    try {
        const errorJson = JSON.parse(errorText);
        return errorJson.error?.message || errorJson.message || errorText;
    } catch {
        return errorText;
    }
};

/**
 * Creates standard headers for OpenRouter API requests
 */
const createApiHeaders = (): HeadersInit => ({
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': SITE_URL,
    'X-Title': SITE_NAME,
    'Content-Type': 'application/json'
});

// =============================================================================
// API COMMUNICATION
// =============================================================================

const callOpenRouter = async (
    messages: OpenRouterMessage[],
    modelId: string,
    isPremium: boolean = false
): Promise<OpenRouterResponse> => {
    const maxTokens = isPremium ? API_CONFIG.maxTokensPremium : API_CONFIG.maxTokensFree;
    const timeout = isPremium ? API_CONFIG.timeoutMsPremium : API_CONFIG.timeoutMs;

    const requestBody: Record<string, unknown> = {
        model: modelId,
        messages,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        temperature: isPremium ? API_CONFIG.temperaturePremium : API_CONFIG.temperatureFree,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(API_CONFIG.baseUrl, {
            method: 'POST',
            headers: createApiHeaders(),
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            const errorMsg = parseApiError(errorText);
            if (import.meta.env.DEV) {
                console.error(`OpenRouter API Error (${modelId}):`, response.status, errorMsg);
            }
            throw new Error(`OpenRouter: ${errorMsg} (${response.status})`);
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
// STREAMING SUPPORT
// =============================================================================

/**
 * Calls OpenRouter with streaming enabled (SSE)
 * Returns the accumulated full text after streaming completes
 */
const callOpenRouterStreaming = async (
    messages: OpenRouterMessage[],
    modelId: string,
    callbacks: StreamCallbacks,
    isPremium: boolean = false
): Promise<string> => {
    const maxTokens = isPremium ? API_CONFIG.maxTokensPremium : API_CONFIG.maxTokensFree;
    const timeout = isPremium ? API_CONFIG.timeoutMsPremium : API_CONFIG.timeoutMs;

    const requestBody = {
        model: modelId,
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature: isPremium ? API_CONFIG.temperaturePremium : API_CONFIG.temperatureFree,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(API_CONFIG.baseUrl, {
            method: 'POST',
            headers: createApiHeaders(),
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            const errorMsg = parseApiError(errorText);
            throw new Error(`OpenRouter streaming: ${errorMsg} (${response.status})`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        // Stream read with timeout protection
        const readStreamWithTimeout = async (): Promise<string> => {
            const streamTimeout = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Stream read timeout after 60 seconds')), API_CONFIG.streamReadTimeoutMs);
            });

            const readLoop = async (): Promise<string> => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Parse SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || !trimmed.startsWith('data: ')) continue;

                        const json = trimmed.slice(6); // Remove "data: " prefix
                        if (json === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(json);
                            const content = parsed.choices?.[0]?.delta?.content || '';
                            if (content) {
                                fullText += content;
                                callbacks.onChunk?.(content);
                            }
                        } catch {
                            // Skip malformed JSON chunks
                        }
                    }
                }
                return fullText;
            };

            return Promise.race([readLoop(), streamTimeout]);
        };

        const result = await readStreamWithTimeout();
        callbacks.onComplete?.(result);
        return result;
    } finally {
        clearTimeout(timeoutId);
    }
};

/**
 * Streaming analysis using OpenRouter with retry support
 * Matches Gemini's streaming API for consistent UX
 */
export const analyzeLogsStreamingWithOpenRouter = async (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[] = [],
    callbacks: StreamCallbacks,
    options: { childProfile?: ChildProfile | null } = {}
): Promise<AnalysisResult> => {
    // Validate input
    if (!logs || logs.length === 0) {
        throw new Error('No logs provided for analysis');
    }

    // If no API key, return mock data
    if (!OPENROUTER_API_KEY) {
        if (import.meta.env.DEV) {
            console.log('No API key found, returning mock analysis');
        }
        const result = await generateMockAnalysis();
        callbacks.onComplete?.(JSON.stringify(result));
        return result;
    }

    // Prepare data using shared utility
    const analysisData = prepareAnalysisData(logs, crisisEvents);
    const { preparedLogs, preparedCrisis, totalDays, dateRangeStart, dateRangeEnd, logsHash } = analysisData;

    const systemPrompt = buildSystemPrompt(options.childProfile);
    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

    const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // Retry loop matching Gemini pattern
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < API_CONFIG.maxStreamingRetries; attempt++) {
        try {
            if (import.meta.env.DEV) {
                console.log(`[OpenRouter] Streaming analysis with ${FREE_MODEL_ID} (attempt ${attempt + 1})...`);
            }

            const fullText = await callOpenRouterStreaming(messages, FREE_MODEL_ID, callbacks, false);
            const result = parseAnalysisResponse(fullText);

            // Add metadata
            result.dateRangeStart = dateRangeStart;
            result.dateRangeEnd = dateRangeEnd;
            result.isDeepAnalysis = false;

            // Cache the result
            cache.set(result, logsHash, 'regular');

            return result;

        } catch (error) {
            lastError = error as Error;
            if (import.meta.env.DEV) {
                console.warn(`[OpenRouter] Streaming attempt ${attempt + 1} failed:`, error);
            }

            // If not the last attempt, notify and retry
            if (attempt < API_CONFIG.maxStreamingRetries - 1) {
                callbacks.onRetry?.(attempt + 2, API_CONFIG.maxStreamingRetries);
                await sleep(API_CONFIG.streamingRetryDelayMs);
            }
        }
    }

    // All retries failed - fallback to non-streaming
    if (import.meta.env.DEV) {
        console.warn('[OpenRouter] Streaming failed, falling back to non-streaming');
    }

    try {
        const result = await analyzeLogs(logs, crisisEvents, options);
        callbacks.onComplete?.(result.summary || '');
        return result;
    } catch (fallbackError) {
        // Both streaming and non-streaming failed
        if (callbacks.onError) {
            callbacks.onError(lastError || fallbackError as Error);
        }
        throw lastError || fallbackError;
    }
};

// =============================================================================
// MOCK DATA (for development/testing)
// =============================================================================

const generateMockAnalysis = async (): Promise<AnalysisResult> => {
    // Simulate API delay
    await sleep(API_CONFIG.mockDelayMs);

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
 * Uses Gemini as primary, falls back to OpenRouter
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

    // Deduplicate concurrent requests
    const dedupeKey = `regular:${generateLogsHash(logs, crisisEvents)}`;
    return deduplicatedRequest(dedupeKey, async () => {
    // Try Gemini first
    if (USE_GEMINI_FALLBACK && isGeminiConfigured()) {
        try {
            if (import.meta.env.DEV) {
                console.log('[AI] Using Gemini as fallback...');
            }
            return await analyzeLogsWithGemini(logs, crisisEvents, options);
        } catch (geminiError) {
            if (import.meta.env.DEV) {
                console.warn('[AI] Gemini failed, falling back to OpenRouter:', geminiError);
            }
            // Fall through to OpenRouter
        }
    }

    // Prepare data using shared utility
    const analysisData = prepareAnalysisData(logs, crisisEvents);
    const { preparedLogs, preparedCrisis, totalDays, dateRangeStart, dateRangeEnd, logsHash } = analysisData;

    // Check cache first (unless force refresh)
    if (!options.forceRefresh) {
        const cached = cache.get(logsHash, 'regular');
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

    // Build prompts with child profile for personalization
    const systemPrompt = buildSystemPrompt(options.childProfile);
    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

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

        // Cache the result with analysis type
        cache.set(result, logsHash, 'regular');

        return result;

    } catch (error) {
        if (import.meta.env.DEV) {
            console.error('Error in analysis:', error);
        }
        throw new Error(`Failed to analyze logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    }); // End of deduplicatedRequest
};

/**
 * Performs DEEP analysis using premium cloud models
 * Uses Gemini as primary, falls back to OpenRouter premium models
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

    // Deduplicate concurrent requests
    const dedupeKey = `deep:${generateLogsHash(logs, crisisEvents)}`;
    return deduplicatedRequest(dedupeKey, async () => {
    // Try Gemini first
    if (USE_GEMINI_FALLBACK && isGeminiConfigured()) {
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

    // Prepare data using shared utility
    const analysisData = prepareAnalysisData(logs, crisisEvents);
    const { preparedLogs, preparedCrisis, totalDays, dateRangeStart, dateRangeEnd, logsHash } = analysisData;

    // Enhanced system prompt for deep analysis
    const systemPrompt = buildSystemPrompt(options.childProfile) + `

VIKTIG: Dette er en DYP ANALYSE. Bruk mer tid på å tenke gjennom sammenhenger.
- Identifiser subtile mønstre som ikke er åpenbare
- Gi svært spesifikke og handlingsorienterte anbefalinger
- Analyser interaksjoner mellom ulike faktorer
- Vurder langsiktige trender og deres implikasjoner`;

    const userPrompt = buildUserPrompt(preparedLogs, preparedCrisis, totalDays);

    const messages: OpenRouterMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];

    // Try each premium model in order until one succeeds
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
            cache.set(finalResult, logsHash, 'deep');

            if (import.meta.env.DEV) {
                console.log(`[OpenRouter] Deep analysis successful with ${modelId}`);
            }

            return finalResult;

        } catch (error) {
            if (import.meta.env.DEV) {
                console.warn(`[OpenRouter] ${modelId} failed:`, error);
            }
            // Continue to next model
        }
    }

    // All premium models failed - fallback to FREE_MODEL
    if (import.meta.env.DEV) {
        console.warn('[AI] All premium models failed, falling back to FREE_MODEL');
    }

    try {
        const response = await callWithRetry(messages, FREE_MODEL_ID, false);

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from AI service');
        }

        const result = parseAnalysisResponse(content);

        // Add metadata (downgraded analysis)
        result.dateRangeStart = dateRangeStart;
        result.dateRangeEnd = dateRangeEnd;
        result.isDeepAnalysis = false; // Downgraded

        modelUsed = FREE_MODEL_ID;
        const finalResult = { ...result, modelUsed };

        // Cache the result (reuse logsHash from prepareAnalysisData)
        cache.set(finalResult, logsHash, 'regular'); // Cache as regular since it's downgraded

        if (import.meta.env.DEV) {
            console.log(`[AI] Deep analysis downgraded to FREE_MODEL (${FREE_MODEL_ID})`);
        }

        return finalResult;

    } catch {
        // Final fallback: return mock data
        if (import.meta.env.DEV) {
            console.error('All models including FREE_MODEL failed for deep analysis');
        }
        return generateMockAnalysis();
    }
    }); // End of deduplicatedRequest
};

/**
 * Clears the analysis cache
 */
export const clearAnalysisCache = (): void => {
    cache.clear();
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
 * Uses Gemini as primary, falls back to OpenRouter
 */
export const analyzeLogsStreaming = async (
    logs: LogEntry[],
    crisisEvents: CrisisEvent[] = [],
    callbacks: StreamCallbacks,
    options: { childProfile?: ChildProfile | null } = {}
): Promise<AnalysisResult> => {
    // Try Gemini first
    if (USE_GEMINI_FALLBACK && isGeminiConfigured()) {
        try {
            if (import.meta.env.DEV) {
                console.log('[AI] Using Gemini streaming...');
            }
            return await analyzeLogsStreamingWithGemini(logs, crisisEvents, callbacks, options);
        } catch (geminiError) {
            if (import.meta.env.DEV) {
                console.warn('[AI] Gemini streaming failed, falling back to OpenRouter:', geminiError);
            }
            // Fall through to OpenRouter
        }
    }

    // Fallback to OpenRouter streaming
    return analyzeLogsStreamingWithOpenRouter(logs, crisisEvents, callbacks, options);
};
