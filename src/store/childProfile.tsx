/* eslint-disable react-refresh/only-export-components */
/**
 * Child Profile Context - Manages child profile with diagnoses and strategies
 */
import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import type { ChildProfile } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { ChildProfileSchema } from '../utils/validation';
import { generateUUID } from '../utils/uuid';
import { createStorageSyncHandlers, getStorageItem, safeSetItem, safeRemoveItem, STORAGE_REFRESH_EVENT } from './storage';
import type { ChildProfileContextType } from './types';

const ChildProfileContext = createContext<ChildProfileContextType | undefined>(undefined);

interface ChildProfileProviderProps {
    children: ReactNode;
}

export const ChildProfileProvider: React.FC<ChildProfileProviderProps> = ({ children }) => {
    const [childProfile, setChildProfileState] = useState<ChildProfile | null>(() =>
        getStorageItem(STORAGE_KEYS.CHILD_PROFILE, null, ChildProfileSchema.nullable())
    );

    // Multi-tab sync and refresh event handling
    useEffect(() => {
        const profileSync = createStorageSyncHandlers({
            key: STORAGE_KEYS.CHILD_PROFILE,
            getLatest: () => getStorageItem(STORAGE_KEYS.CHILD_PROFILE, null, ChildProfileSchema.nullable()),
            onUpdate: setChildProfileState
        });

        window.addEventListener('storage', profileSync.handleStorageChange);
        window.addEventListener(STORAGE_REFRESH_EVENT, profileSync.handleRefresh);
        return () => {
            window.removeEventListener('storage', profileSync.handleStorageChange);
            window.removeEventListener(STORAGE_REFRESH_EVENT, profileSync.handleRefresh);
        };
    }, []);

    const setChildProfile = useCallback((profile: ChildProfile) => {
        setChildProfileState(profile);
        safeSetItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(profile));
    }, []);

    const updateChildProfile = useCallback((updates: Partial<ChildProfile>) => {
        setChildProfileState(prev => {
            if (!prev) {
                // If no profile exists, create a new one with the updates
                const newProfile: ChildProfile = {
                    id: generateUUID(),
                    name: '',
                    diagnoses: [],
                    communicationStyle: 'verbal',
                    sensorySensitivities: [],
                    seekingSensory: [],
                    effectiveStrategies: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...updates
                };
                safeSetItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(newProfile));
                return newProfile;
            }
            const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };
            safeSetItem(STORAGE_KEYS.CHILD_PROFILE, JSON.stringify(updated));
            return updated;
        });
    }, []);

    const clearChildProfile = useCallback(() => {
        setChildProfileState(null);
        safeRemoveItem(STORAGE_KEYS.CHILD_PROFILE);
    }, []);

    const value = useMemo<ChildProfileContextType>(() => ({
        childProfile,
        setChildProfile,
        updateChildProfile,
        clearChildProfile
    }), [childProfile, setChildProfile, updateChildProfile, clearChildProfile]);

    return (
        <ChildProfileContext.Provider value={value}>
            {children}
        </ChildProfileContext.Provider>
    );
};

export const useChildProfile = (): ChildProfileContextType => {
    const context = useContext(ChildProfileContext);
    if (context === undefined) {
        throw new Error('useChildProfile must be used within a DataProvider');
    }
    return context;
};

export { ChildProfileContext };
