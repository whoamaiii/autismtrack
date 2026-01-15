/**
 * Model Context
 * Provides global state management for the local Kreativium 4B model
 * Tracks download status, loading state, and provides actions
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { isNative } from '../utils/platform';
import {
    getModelStatus,
    downloadModel,
    cancelDownload,
    deleteModel,
    loadModel,
    unloadModel,
    getModelSizeDisplay,
    checkAndExtractBundledModel,
    type ModelStatus
} from '../services/localModel';

// =============================================================================
// TYPES
// =============================================================================

interface ModelContextState {
    // Status
    status: ModelStatus;
    isChecking: boolean;
    isExtracting: boolean;  // True when extracting bundled model from APK

    // Actions
    refreshStatus: () => Promise<void>;
    startDownload: () => Promise<void>;
    cancelModelDownload: () => Promise<void>;
    deleteLocalModel: () => Promise<void>;
    loadLocalModel: () => Promise<void>;
    unloadLocalModel: () => Promise<void>;

    // Helpers
    modelSizeDisplay: string;
    isNativeDevice: boolean;

    // First-launch prompt
    showDownloadPrompt: boolean;
    dismissDownloadPrompt: () => void;
    markPromptShown: () => void;
}

const STORAGE_KEY = 'kreativium_model_prompt_shown';
const POLLING_INTERVAL_MS = 500;

// =============================================================================
// CONTEXT
// =============================================================================

const ModelContext = createContext<ModelContextState | null>(null);

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Safe localStorage getter (handles private browsing mode)
 */
function safeGetItem(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * Safe localStorage setter (handles private browsing mode)
 */
function safeSetItem(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Ignore localStorage errors (e.g., private browsing mode)
    }
}

// =============================================================================
// PROVIDER
// =============================================================================

export function ModelProvider({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<ModelStatus>({
        available: false,
        downloaded: false,
        bundledAvailable: false,
        loaded: false,
        downloading: false,
        extracting: false,
        downloadProgress: 0
    });
    const [isChecking, setIsChecking] = useState(true);
    const [isExtracting, setIsExtracting] = useState(false);
    const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);

    // Cache isNative result (doesn't change at runtime)
    const isNativeDevice = useMemo(() => isNative(), []);

    // Refs for stable references
    const statusPollingRef = useRef<number | null>(null);
    const isMountedRef = useRef(true);

    // Refresh model status from native layer
    const refreshStatus = useCallback(async () => {
        if (!isNativeDevice) {
            setStatus({
                available: false,
                downloaded: false,
                bundledAvailable: false,
                loaded: false,
                downloading: false,
                extracting: false,
                downloadProgress: 0,
                error: 'Local model only available on Android'
            });
            setIsChecking(false);
            return;
        }

        try {
            const newStatus = await getModelStatus();
            // Only update state if still mounted
            if (isMountedRef.current) {
                setStatus(newStatus);
            }
        } catch (error) {
            if (isMountedRef.current) {
                setStatus(prev => ({
                    ...prev,
                    error: error instanceof Error ? error.message : 'Failed to get status'
                }));
            }
        } finally {
            if (isMountedRef.current) {
                setIsChecking(false);
            }
        }
    }, [isNativeDevice]);

    // Keep a ref to refreshStatus to avoid stale closure in interval
    const refreshStatusRef = useRef(refreshStatus);
    useEffect(() => {
        refreshStatusRef.current = refreshStatus;
    }, [refreshStatus]);

    // Track mounted state and cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;

            // Clear polling interval
            if (statusPollingRef.current) {
                clearInterval(statusPollingRef.current);
                statusPollingRef.current = null;
            }

            // Cancel any in-progress download on unmount
            cancelDownload().catch((err) => {
                if (import.meta.env.DEV) {
                    console.warn('[ModelContext] Cancel on unmount failed:', err);
                }
            });
        };
    }, []);

    // Initial status check
    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    // Auto-extract bundled model on startup if available
    useEffect(() => {
        if (!isNativeDevice || isChecking || isExtracting) return;

        // If model is already downloaded or bundled model isn't available, skip
        if (status.downloaded || !status.bundledAvailable) return;

        // Extract bundled model
        const extractBundled = async () => {
            if (import.meta.env.DEV) {
                console.log('[ModelContext] Bundled model detected, extracting...');
            }
            setIsExtracting(true);

            try {
                const extracted = await checkAndExtractBundledModel();
                if (extracted && isMountedRef.current) {
                    if (import.meta.env.DEV) {
                        console.log('[ModelContext] Bundled model extracted successfully');
                    }
                    // Refresh status to reflect extraction
                    await refreshStatus();
                }
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.error('[ModelContext] Failed to extract bundled model:', error);
                }
                // Propagate error to UI through status
                if (isMountedRef.current) {
                    setStatus(prev => ({
                        ...prev,
                        error: error instanceof Error ? error.message : 'Failed to extract bundled model'
                    }));
                }
            } finally {
                if (isMountedRef.current) {
                    setIsExtracting(false);
                }
            }
        };

        extractBundled();
    }, [isNativeDevice, isChecking, isExtracting, status.downloaded, status.bundledAvailable, refreshStatus]);

    // Check if we should show the download prompt on first launch
    useEffect(() => {
        if (!isNativeDevice || isChecking || isExtracting) return;

        const promptShown = safeGetItem(STORAGE_KEY);
        // Don't show prompt if model is downloaded OR if bundled model is available (will auto-extract)
        if (!promptShown && !status.downloaded && !status.downloading && !status.bundledAvailable) {
            setShowDownloadPrompt(true);
        }
    }, [isNativeDevice, isChecking, isExtracting, status.downloaded, status.downloading, status.bundledAvailable]);

    // Poll status while downloading OR extracting (using ref to avoid stale closure)
    useEffect(() => {
        const shouldPoll = status.downloading || isExtracting;

        if (shouldPoll && !statusPollingRef.current) {
            statusPollingRef.current = window.setInterval(() => {
                refreshStatusRef.current();
            }, POLLING_INTERVAL_MS);
        } else if (!shouldPoll && statusPollingRef.current) {
            clearInterval(statusPollingRef.current);
            statusPollingRef.current = null;
        }

        return () => {
            if (statusPollingRef.current) {
                clearInterval(statusPollingRef.current);
                statusPollingRef.current = null;
            }
        };
    }, [status.downloading, isExtracting]);

    // Start model download (with race condition guard)
    const startDownload = useCallback(async () => {
        if (!isNativeDevice) {
            throw new Error('Download only available on Android');
        }

        // Prevent concurrent downloads
        if (status.downloading) {
            if (import.meta.env.DEV) {
                console.warn('[ModelContext] Download already in progress');
            }
            return;
        }

        try {
            setStatus(prev => ({ ...prev, downloading: true, downloadProgress: 0, error: undefined }));
            await downloadModel();
            await refreshStatus();
        } catch (error) {
            if (isMountedRef.current) {
                setStatus(prev => ({
                    ...prev,
                    downloading: false,
                    error: error instanceof Error ? error.message : 'Download failed'
                }));
            }
            throw error;
        }
    }, [isNativeDevice, refreshStatus, status.downloading]);

    // Cancel download
    const cancelModelDownload = useCallback(async () => {
        if (!isNativeDevice) return;

        try {
            await cancelDownload();
            if (isMountedRef.current) {
                await refreshStatus();
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[ModelContext] Cancel failed:', error);
            }
        }
    }, [isNativeDevice, refreshStatus]);

    // Delete model
    const deleteLocalModel = useCallback(async () => {
        if (!isNativeDevice) return;

        try {
            await deleteModel();
            if (isMountedRef.current) {
                await refreshStatus();
            }
        } catch (error) {
            if (isMountedRef.current) {
                setStatus(prev => ({
                    ...prev,
                    error: error instanceof Error ? error.message : 'Delete failed'
                }));
            }
            throw error;
        }
    }, [isNativeDevice, refreshStatus]);

    // Load model into memory
    const loadLocalModel = useCallback(async () => {
        if (!isNativeDevice) {
            throw new Error('Load only available on Android');
        }

        try {
            await loadModel();
            if (isMountedRef.current) {
                await refreshStatus();
            }
        } catch (error) {
            if (isMountedRef.current) {
                setStatus(prev => ({
                    ...prev,
                    error: error instanceof Error ? error.message : 'Load failed'
                }));
            }
            throw error;
        }
    }, [isNativeDevice, refreshStatus]);

    // Unload model from memory
    const unloadLocalModel = useCallback(async () => {
        if (!isNativeDevice) return;

        try {
            await unloadModel();
            if (isMountedRef.current) {
                await refreshStatus();
            }
        } catch (error) {
            if (import.meta.env.DEV) {
                console.error('[ModelContext] Unload failed:', error);
            }
        }
    }, [isNativeDevice, refreshStatus]);

    // Dismiss the download prompt
    const dismissDownloadPrompt = useCallback(() => {
        setShowDownloadPrompt(false);
    }, []);

    // Mark prompt as shown (user made a choice)
    const markPromptShown = useCallback(() => {
        safeSetItem(STORAGE_KEY, 'true');
        setShowDownloadPrompt(false);
    }, []);

    // Memoize context value to prevent unnecessary re-renders
    const value = useMemo<ModelContextState>(() => ({
        status,
        isChecking,
        isExtracting,
        refreshStatus,
        startDownload,
        cancelModelDownload,
        deleteLocalModel,
        loadLocalModel,
        unloadLocalModel,
        modelSizeDisplay: getModelSizeDisplay(),
        isNativeDevice,
        showDownloadPrompt,
        dismissDownloadPrompt,
        markPromptShown
    }), [
        status,
        isChecking,
        isExtracting,
        refreshStatus,
        startDownload,
        cancelModelDownload,
        deleteLocalModel,
        loadLocalModel,
        unloadLocalModel,
        isNativeDevice,
        showDownloadPrompt,
        dismissDownloadPrompt,
        markPromptShown
    ]);

    return (
        <ModelContext.Provider value={value}>
            {children}
        </ModelContext.Provider>
    );
}

// =============================================================================
// HOOK
// =============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useModel(): ModelContextState {
    const context = useContext(ModelContext);
    if (!context) {
        throw new Error('useModel must be used within a ModelProvider');
    }
    return context;
}

// =============================================================================
// OPTIONAL HOOK (doesn't throw if outside provider)
// =============================================================================

// eslint-disable-next-line react-refresh/only-export-components
export function useModelOptional(): ModelContextState | null {
    return useContext(ModelContext);
}
