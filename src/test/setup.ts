import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock react-i18next with withTranslation HOC
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string | object) => {
            if (typeof fallback === 'object' && fallback !== null) {
                return key;
            }
            return typeof fallback === 'string' ? fallback : key;
        },
        i18n: {
            language: 'no',
            changeLanguage: vi.fn(),
        },
    }),
    withTranslation: () => <T extends React.ComponentType<unknown>>(Component: T) => Component,
    Trans: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn(),
    },
}));

// Mock localStorage for tests
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
        length: 0,
        key: vi.fn((i: number) => Object.keys(store)[i] || null),
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock crypto.randomUUID for generating test IDs
Object.defineProperty(crypto, 'randomUUID', {
    value: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
});
