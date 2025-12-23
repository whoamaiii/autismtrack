import { GoogleGenAI } from "@google/genai";
import type { LogEntry, AnalysisResult, CrisisEvent, ChildProfile } from '../types';
import {
    generateLogsHash,
    createAnalysisCache,
    prepareLogsForAnalysis,
    prepareCrisisEventsForAnalysis,
    buildSystemPrompt,
    buildUserPrompt,
    parseAnalysisResponse,
    AI_CONFIG,
    type StreamCallbacks
} from './aiCommon';

// =============================================================================
// GEMINI CONFIGURATION
// =============================================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Lazy initialization - only create client when API key exists
let _genAI: GoogleGenAI | null = null;
const getGenAI = (): GoogleGenAI => {
    if (!_genAI) {
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key not configured');
        }
        _genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    }
    return _genAI;
};

// Model configuration
const MODEL_ID = 'gemini-2.0-flash';
const PREMIUM_MODEL_ID = 'gemini-2.5-pro-preview-06-05';

// Log warning for preview models in dev mode
if (import.meta.env.DEV && PREMIUM_MODEL_ID.includes('preview')) {
    console.warn(`[Gemini] Using preview model ${PREMIUM_MODEL_ID} - may be deprecated`);
}

// =============================================================================
// CACHING (using shared cache factory)
// =============================================================================
const cache = createAnalysisCache();

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
        const cached = cache.get(logsHash);
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

        const response = await getGenAI().models.generateContent({
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
        cache.set(result, logsHash);

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

        const response = await getGenAI().models.generateContent({
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
        cache.set(result, logsHash);

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
    for (let attempt = 0; attempt < AI_CONFIG.maxStreamingRetries; attempt++) {
        try {
            if (import.meta.env.DEV) {
                console.log(`[Gemini] Streaming analysis with ${MODEL_ID} (attempt ${attempt + 1})...`);
            }

            const response = await getGenAI().models.generateContentStream({
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
            cache.set(result, logsHash);

            return result;

        } catch (error) {
            lastError = error as Error;
            if (import.meta.env.DEV) {
                console.warn(`[Gemini] Streaming attempt ${attempt + 1} failed:`, error);
            }

            // If not the last attempt, notify and retry
            if (attempt < AI_CONFIG.maxStreamingRetries - 1) {
                callbacks.onRetry?.(attempt + 2, AI_CONFIG.maxStreamingRetries);
                await new Promise(resolve => setTimeout(resolve, AI_CONFIG.streamingRetryDelayMs));
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
    cache.clear();
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
