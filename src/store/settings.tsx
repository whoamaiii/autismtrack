/* eslint-disable react-refresh/only-export-components */
/**
 * Settings Context - Manages onboarding state, analysis settings, and data refresh
 */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { STORAGE_KEYS } from '../constants/storage';
import { createStorageSyncHandlers, getStorageItem, safeSetItem, STORAGE_REFRESH_EVENT } from './storage';
import type { SettingsContextType, AnalysisSettings } from './types';
import { DEFAULT_ANALYSIS_SETTINGS } from './types';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
    children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
    const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() =>
        getStorageItem(STORAGE_KEYS.ONBOARDING_COMPLETED, false)
    );

    const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettings>(() =>
        getStorageItem(STORAGE_KEYS.ANALYSIS_SETTINGS, DEFAULT_ANALYSIS_SETTINGS)
    );

    // Multi-tab sync and refresh event handling
    useEffect(() => {
        const onboardingSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.ONBOARDING_COMPLETED,
            getLatest: () => getStorageItem(STORAGE_KEYS.ONBOARDING_COMPLETED, false),
            onUpdate: setHasCompletedOnboarding
        });

        const analysisSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.ANALYSIS_SETTINGS,
            getLatest: () => getStorageItem(STORAGE_KEYS.ANALYSIS_SETTINGS, DEFAULT_ANALYSIS_SETTINGS),
            onUpdate: setAnalysisSettings
        });

        const handleStorageChange = (e: StorageEvent) => {
            onboardingSync.handleStorageChange(e);
            analysisSync.handleStorageChange(e);
        };

        const handleRefresh = () => {
            onboardingSync.handleRefresh();
            analysisSync.handleRefresh();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener(STORAGE_REFRESH_EVENT, handleRefresh);
        };
    }, []);

    const completeOnboarding = useCallback(() => {
        setHasCompletedOnboarding(true);
        safeSetItem(STORAGE_KEYS.ONBOARDING_COMPLETED, JSON.stringify(true));
    }, []);

    const updateAnalysisSettings = useCallback((updates: Partial<AnalysisSettings>) => {
        setAnalysisSettings(prev => {
            const newSettings = { ...prev, ...updates };
            safeSetItem(STORAGE_KEYS.ANALYSIS_SETTINGS, JSON.stringify(newSettings));
            return newSettings;
        });
    }, []);

    // refreshData triggers a reload of all contexts from localStorage
    // This is used after importing data or loading mock data
    const refreshData = useCallback(() => {
        // Refresh local settings state
        setHasCompletedOnboarding(getStorageItem(STORAGE_KEYS.ONBOARDING_COMPLETED, false));
        setAnalysisSettings(getStorageItem(STORAGE_KEYS.ANALYSIS_SETTINGS, DEFAULT_ANALYSIS_SETTINGS));
        // Dispatch event for all other providers to refresh
        window.dispatchEvent(new CustomEvent(STORAGE_REFRESH_EVENT));
    }, []);

    const value = useMemo<SettingsContextType>(() => ({
        hasCompletedOnboarding,
        completeOnboarding,
        refreshData,
        analysisSettings,
        updateAnalysisSettings,
    }), [hasCompletedOnboarding, completeOnboarding, refreshData, analysisSettings, updateAnalysisSettings]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = (): SettingsContextType => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a DataProvider');
    }
    return context;
};

export { SettingsContext };
