/**
 * Local Model Service
 * Provides on-device AI inference using Kreativium 4B via MediaPipe
 * Only available on native Android platforms
 */

import { registerPlugin } from '@capacitor/core';
import { isNative } from '../utils/platform';
import type { LogEntry, CrisisEvent, AnalysisResult, ChildProfile } from '../types';
import {
    prepareAnalysisData,
    buildSystemPrompt,
    buildUserPrompt,
    parseAnalysisResponse,
    createAnalysisCache,
    generateLogsHash
} from './aiCommon';

// =============================================================================
// PLUGIN INTERFACE
// =============================================================================

interface KreativiumPluginInterface {
    isModelDownloaded(): Promise<{
        downloaded: boolean;
        bundledAvailable?: boolean;
        path?: string;
        size?: number;
        partialDownload?: boolean;
        partialSize?: number;
    }>;
    isModelLoaded(): Promise<{ loaded: boolean }>;
    getModelStatus(): Promise<{
        downloaded: boolean;
        bundledAvailable?: boolean;
        loaded: boolean;
        downloading: boolean;
        extracting?: boolean;
        downloadProgress: number;
        modelSize?: number;
        etaSeconds?: number;
        speedBytesPerSec?: number;
    }>;
    checkNetworkStatus(): Promise<{ connected: boolean; isWifi: boolean }>;
    downloadModel(options?: { hfToken?: string }): Promise<{ success: boolean; path?: string; size?: number; message?: string }>;
    cancelDownload(): Promise<{ cancelled: boolean }>;
    loadModel(): Promise<{ success: boolean; message?: string }>;
    unloadModel(): Promise<{ success: boolean }>;
    generateResponse(options: { prompt: string }): Promise<{ response: string; durationMs: number }>;
    deleteModel(): Promise<{ deleted: boolean }>;
    setHfToken(options: { token: string }): Promise<{ success: boolean }>;
    clearHfToken(): Promise<{ success: boolean }>;
    // Bundled model extraction (for APKs with pre-bundled model)
    extractBundledModelIfNeeded(): Promise<{
        success: boolean;
        extracted?: boolean;
        bundled?: boolean;
        message?: string;
        path?: string;
        size?: number;
    }>;
}

// Register the native plugin (only works on Android)
const KreativiumPlugin = registerPlugin<KreativiumPluginInterface>('Kreativium');

// =============================================================================
// TYPES
// =============================================================================

export interface ModelStatus {
    available: boolean;       // Is this device capable of running local models
    downloaded: boolean;      // Is the model file downloaded
    bundledAvailable: boolean; // Is a bundled model available in APK assets (not yet extracted)
    loaded: boolean;          // Is the model loaded in memory
    downloading: boolean;     // Is a download in progress
    extracting: boolean;      // Is extraction from APK assets in progress
    downloadProgress: number; // 0-1 download progress
    modelSize?: number;       // Size of downloaded model in bytes
    error?: string;           // Last error message if any
    etaSeconds?: number;      // Estimated time remaining in seconds
    speedBytesPerSec?: number; // Current download speed
    partialDownload?: boolean; // Is there a partial download that can be resumed
    partialSize?: number;     // Size of partial download in bytes
}

export interface NetworkStatus {
    connected: boolean;       // Is network available
    isWifi: boolean;          // Is connected via WiFi
}

export interface DownloadProgressEvent {
    progress: number;        // 0-1
    downloadedBytes: number;
    totalBytes: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MODEL_SIZE_BYTES = 2_560_000_000; // ~2.56GB (actual size of model file)
const MODEL_SIZE_DISPLAY = '2.56 GB';

// =============================================================================
// CACHE
// =============================================================================

const localAnalysisCache = createAnalysisCache();

// =============================================================================
// MODEL STATUS & MANAGEMENT
// =============================================================================

/**
 * Check if local model inference is available on this device
 */
export async function isLocalModelAvailable(): Promise<boolean> {
    if (!isNative()) {
        return false;
    }
    try {
        const status = await KreativiumPlugin.getModelStatus();
        return status.downloaded;
    } catch {
        return false;
    }
}

/**
 * Check if the local model is ready for inference
 */
export async function isLocalModelReady(): Promise<boolean> {
    if (!isNative()) {
        return false;
    }
    try {
        const status = await KreativiumPlugin.getModelStatus();
        return status.downloaded && status.loaded;
    } catch {
        return false;
    }
}

/**
 * Get comprehensive model status
 */
export async function getModelStatus(): Promise<ModelStatus> {
    if (!isNative()) {
        return {
            available: false,
            downloaded: false,
            bundledAvailable: false,
            loaded: false,
            downloading: false,
            extracting: false,
            downloadProgress: 0,
            error: 'Local model only available on Android'
        };
    }

    try {
        const status = await KreativiumPlugin.getModelStatus();
        return {
            available: true,
            downloaded: status.downloaded,
            bundledAvailable: status.bundledAvailable ?? false,
            loaded: status.loaded,
            downloading: status.downloading,
            extracting: status.extracting ?? false,
            downloadProgress: status.downloadProgress,
            modelSize: status.modelSize,
            etaSeconds: status.etaSeconds,
            speedBytesPerSec: status.speedBytesPerSec
        };
    } catch (error) {
        return {
            available: false,
            downloaded: false,
            bundledAvailable: false,
            loaded: false,
            downloading: false,
            extracting: false,
            downloadProgress: 0,
            error: error instanceof Error ? error.message : 'Failed to get model status'
        };
    }
}

/**
 * Get display-friendly model size string
 */
export function getModelSizeDisplay(): string {
    return MODEL_SIZE_DISPLAY;
}

/**
 * Get model size in bytes
 */
export function getModelSizeBytes(): number {
    return MODEL_SIZE_BYTES;
}

/**
 * Check network connectivity status
 * Returns network availability and whether connected via WiFi
 */
export async function checkNetworkStatus(): Promise<NetworkStatus> {
    if (!isNative()) {
        // On web, assume connected (browser will handle network errors)
        return { connected: true, isWifi: false };
    }

    try {
        return await KreativiumPlugin.checkNetworkStatus();
    } catch (error) {
        console.warn('[LocalModel] Failed to check network status:', error);
        // Assume connected if we can't check
        return { connected: true, isWifi: false };
    }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes >= 1_000_000_000) {
        return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
    } else if (bytes >= 1_000_000) {
        return `${(bytes / 1_000_000).toFixed(1)} MB`;
    } else if (bytes >= 1_000) {
        return `${(bytes / 1_000).toFixed(0)} KB`;
    }
    return `${bytes} bytes`;
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
}

// =============================================================================
// MODEL DOWNLOAD & BUNDLED EXTRACTION
// =============================================================================

/**
 * Extract bundled model from APK assets if available
 * This is used when the model is pre-bundled in the APK (for private distribution)
 * The extraction copies the model from assets to app storage (required by MediaPipe)
 *
 * @returns Object with extraction result
 */
export async function extractBundledModel(): Promise<{
    success: boolean;
    extracted: boolean;
    message: string;
}> {
    if (!isNative()) {
        return {
            success: false,
            extracted: false,
            message: 'Bundled model extraction only available on Android'
        };
    }

    try {
        const result = await KreativiumPlugin.extractBundledModelIfNeeded();
        return {
            success: result.success,
            extracted: result.extracted ?? false,
            message: result.message ?? (result.success ? 'Model extracted successfully' : 'Extraction failed')
        };
    } catch (error) {
        return {
            success: false,
            extracted: false,
            message: error instanceof Error ? error.message : 'Failed to extract bundled model'
        };
    }
}

/**
 * Check if bundled model is available and extract if needed
 * Returns true if model is now available (either already downloaded or just extracted)
 */
export async function checkAndExtractBundledModel(): Promise<boolean> {
    if (!isNative()) {
        return false;
    }

    try {
        const status = await KreativiumPlugin.getModelStatus();

        // If already downloaded, no need to extract
        if (status.downloaded) {
            return true;
        }

        // If bundled model is available, extract it
        if (status.bundledAvailable) {
            console.log('[LocalModel] Bundled model found, extracting...');
            const result = await KreativiumPlugin.extractBundledModelIfNeeded();
            if (result.success) {
                console.log('[LocalModel] Bundled model extracted successfully');
                return true;
            }
            console.error('[LocalModel] Failed to extract bundled model:', result.message);
        }

        return false;
    } catch (error) {
        console.error('[LocalModel] Error checking bundled model:', error);
        return false;
    }
}

/**
 * Download the Kreativium 4B model
 * Returns a promise that resolves when download is complete
 * Progress can be monitored via getModelStatus() polling
 *
 * @param hfToken - Optional Hugging Face token for gated model access
 */
export async function downloadModel(hfToken?: string): Promise<void> {
    if (!isNative()) {
        throw new Error('Model download only available on Android');
    }

    try {
        const options = hfToken ? { hfToken } : undefined;
        const result = await KreativiumPlugin.downloadModel(options);
        if (!result.success) {
            throw new Error(result.message || 'Download failed');
        }
    } catch (error) {
        throw new Error(
            `Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Cancel an in-progress download
 */
export async function cancelDownload(): Promise<void> {
    if (!isNative()) return;

    try {
        await KreativiumPlugin.cancelDownload();
    } catch (error) {
        console.error('[LocalModel] Failed to cancel download:', error);
    }
}

/**
 * Delete the downloaded model to free storage
 */
export async function deleteModel(): Promise<void> {
    if (!isNative()) return;

    try {
        await KreativiumPlugin.deleteModel();
        localAnalysisCache.clear();
    } catch (error) {
        throw new Error(
            `Failed to delete model: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

// =============================================================================
// MODEL LOADING
// =============================================================================

/**
 * Load the model into memory for inference
 * This should be called before generateResponse
 */
export async function loadModel(): Promise<void> {
    if (!isNative()) {
        throw new Error('Model loading only available on Android');
    }

    try {
        const status = await KreativiumPlugin.getModelStatus();
        if (!status.downloaded) {
            throw new Error('Model not downloaded. Please download first.');
        }

        if (status.loaded) {
            return; // Already loaded
        }

        const result = await KreativiumPlugin.loadModel();
        if (!result.success) {
            throw new Error(result.message || 'Failed to load model');
        }
    } catch (error) {
        throw new Error(
            `Failed to load model: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Unload the model from memory to free RAM
 */
export async function unloadModel(): Promise<void> {
    if (!isNative()) return;

    try {
        await KreativiumPlugin.unloadModel();
    } catch (error) {
        console.error('[LocalModel] Failed to unload model:', error);
    }
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================

/**
 * Analyze logs using the local Kreativium model
 * Primary analysis function for native Android
 */
export async function analyzeLogsWithLocalModel(
    logs: LogEntry[],
    crisisEvents: CrisisEvent[],
    childProfile?: ChildProfile | null
): Promise<AnalysisResult> {
    if (!isNative()) {
        throw new Error('Local model analysis only available on Android');
    }

    // Validate input
    if (!logs || logs.length === 0) {
        throw new Error('At least one log entry is required for analysis');
    }

    // Check cache first
    const logsHash = generateLogsHash(logs, crisisEvents);
    const cachedResult = localAnalysisCache.get(logsHash, 'regular');
    if (cachedResult) {
        if (import.meta.env.DEV) {
            console.log('[LocalModel] Returning cached analysis');
        }
        return cachedResult;
    }

    // Ensure model is loaded
    const status = await KreativiumPlugin.getModelStatus();
    if (!status.loaded) {
        if (!status.downloaded) {
            throw new Error('Model not downloaded. Please download from Settings.');
        }
        await loadModel();
    }

    // Prepare data for analysis
    const analysisData = prepareAnalysisData(logs, crisisEvents);

    // Build prompts using shared utilities
    const systemPrompt = buildSystemPrompt(childProfile);
    const userPrompt = buildUserPrompt(
        analysisData.preparedLogs,
        analysisData.preparedCrisis,
        analysisData.totalDays
    );

    // Combine prompts for single-turn inference
    // This model works best with a combined prompt format
    const fullPrompt = `<start_of_turn>system
${systemPrompt}
<end_of_turn>
<start_of_turn>user
${userPrompt}
<end_of_turn>
<start_of_turn>model
`;

    if (import.meta.env.DEV) {
        console.log('[LocalModel] Sending prompt to Kreativium 4B...');
        console.log('[LocalModel] Prompt length:', fullPrompt.length);
    }

    try {
        const { response, durationMs } = await KreativiumPlugin.generateResponse({
            prompt: fullPrompt
        });

        if (import.meta.env.DEV) {
            console.log(`[LocalModel] Response received in ${durationMs}ms`);
            console.log('[LocalModel] Response length:', response.length);
        }

        // Parse the response using shared utility
        const result = parseAnalysisResponse(response);

        // Add metadata
        result.dateRangeStart = analysisData.dateRangeStart;
        result.dateRangeEnd = analysisData.dateRangeEnd;
        result.modelUsed = 'kreativium-4b-it-int4 (local)';

        // Cache the result
        localAnalysisCache.set(result, logsHash, 'regular');

        return result;
    } catch (error) {
        console.error('[LocalModel] Analysis failed:', error);
        throw new Error(
            `Local analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Clear the local analysis cache
 */
export function clearLocalAnalysisCache(): void {
    localAnalysisCache.clear();
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if we should prefer local model over cloud
 * Returns true if local model is ready and we're on native
 */
export async function shouldUseLocalModel(): Promise<boolean> {
    if (!isNative()) {
        return false;
    }

    try {
        const status = await KreativiumPlugin.getModelStatus();
        return status.downloaded && status.loaded;
    } catch {
        return false;
    }
}

/**
 * Ensure model is ready for inference
 * Downloads if needed (returns false), loads if downloaded
 * Returns true if ready for immediate inference
 */
export async function ensureModelReady(): Promise<boolean> {
    if (!isNative()) {
        return false;
    }

    try {
        const status = await KreativiumPlugin.getModelStatus();

        if (!status.downloaded) {
            return false; // Needs download
        }

        if (!status.loaded) {
            await loadModel();
        }

        return true;
    } catch {
        return false;
    }
}

// =============================================================================
// TOKEN MANAGEMENT
// =============================================================================

/**
 * Validate Hugging Face token format
 * Valid tokens start with 'hf_' followed by alphanumeric characters
 *
 * @returns Object with isValid boolean and optional error message
 */
export function validateHfToken(token: string): { isValid: boolean; error?: string } {
    if (!token || token.trim().length === 0) {
        return { isValid: false, error: 'Token cannot be empty' };
    }

    const trimmedToken = token.trim();

    // Check for correct prefix
    if (!trimmedToken.startsWith('hf_')) {
        return {
            isValid: false,
            error: 'Token must start with "hf_". Get your token from huggingface.co/settings/tokens'
        };
    }

    // Check minimum length (hf_ + at least some characters)
    if (trimmedToken.length < 10) {
        return { isValid: false, error: 'Token appears too short. Check that you copied it completely.' };
    }

    // Check for valid characters (alphanumeric after hf_)
    const tokenBody = trimmedToken.substring(3);
    if (!/^[a-zA-Z0-9]+$/.test(tokenBody)) {
        return { isValid: false, error: 'Token contains invalid characters. Only letters and numbers are allowed.' };
    }

    return { isValid: true };
}

/**
 * Set Hugging Face token for gated model downloads
 * The token will be stored securely and used for future downloads
 *
 * To get a token:
 * 1. Go to https://huggingface.co/litert-community/Gemma3-4B-IT
 * 2. Accept the model license
 * 3. Go to https://huggingface.co/settings/tokens
 * 4. Create a new token with "read" permission
 */
export async function setHfToken(token: string): Promise<void> {
    if (!isNative()) {
        throw new Error('Token management only available on Android');
    }

    try {
        await KreativiumPlugin.setHfToken({ token });
    } catch (error) {
        throw new Error(
            `Failed to set HF token: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Clear stored Hugging Face token
 */
export async function clearHfToken(): Promise<void> {
    if (!isNative()) {
        return;
    }

    try {
        await KreativiumPlugin.clearHfToken();
    } catch (error) {
        console.error('[LocalModel] Failed to clear HF token:', error);
    }
}
