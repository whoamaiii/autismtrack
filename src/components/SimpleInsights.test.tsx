/**
 * Tests for SimpleInsights component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { SimpleInsights } from './SimpleInsights';
import type { LogEntry, CrisisEvent } from '../types';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: React.PropsWithChildren<object>) => <div {...props}>{children}</div>
    }
}));

// Helper to wrap component with Router
const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
};

// Test data factory
const createMockLog = (overrides: Partial<LogEntry> = {}): LogEntry => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    context: 'home',
    arousal: 5,
    valence: 5,
    energy: 5,
    sensoryTriggers: [],
    contextTriggers: [],
    strategies: [],
    duration: 0,
    note: '',
    ...overrides
});

const createMockCrisis = (overrides: Partial<CrisisEvent> = {}): CrisisEvent => ({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    context: 'home',
    type: 'meltdown',
    durationSeconds: 600,
    peakIntensity: 7,
    warningSignsObserved: [],
    sensoryTriggers: [],
    contextTriggers: [],
    strategiesUsed: [],
    resolution: 'self_regulated',
    hasAudioRecording: false,
    notes: '',
    ...overrides
});

describe('SimpleInsights', () => {
    describe('Empty state', () => {
        it('shows empty state when no logs provided', () => {
            renderWithRouter(
                <SimpleInsights logs={[]} />
            );

            expect(screen.getByText(/Log your first observation/i)).toBeInTheDocument();
            expect(screen.getByText(/Add observation/i)).toBeInTheDocument();
        });

        it('shows link to log page in empty state', () => {
            renderWithRouter(
                <SimpleInsights logs={[]} />
            );

            const link = screen.getByRole('link', { name: /Add observation/i });
            expect(link).toHaveAttribute('href', '/log');
        });
    });

    describe('Loading state', () => {
        it('shows loading skeleton when isLoading is true', () => {
            renderWithRouter(
                <SimpleInsights logs={[]} isLoading={true} />
            );

            // Should show pulse animations (skeleton)
            const skeletons = document.querySelectorAll('.animate-pulse');
            expect(skeletons.length).toBeGreaterThan(0);
        });
    });

    describe('Status calculation', () => {
        it('shows "God dag" for low arousal logs', () => {
            const logs = [
                createMockLog({ arousal: 2 }),
                createMockLog({ arousal: 3 }),
                createMockLog({ arousal: 2 })
            ];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText('God dag')).toBeInTheDocument();
        });

        it('shows "Varierende dag" for moderate arousal', () => {
            const logs = [
                createMockLog({ arousal: 5 }),
                createMockLog({ arousal: 6 }),
                createMockLog({ arousal: 5 })
            ];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText('Varierende dag')).toBeInTheDocument();
        });

        it('shows "Krevende dag" for high arousal logs', () => {
            const logs = [
                createMockLog({ arousal: 8 }),
                createMockLog({ arousal: 9 }),
                createMockLog({ arousal: 8 })
            ];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText('Krevende dag')).toBeInTheDocument();
        });

        it('shows "Krevende dag" when crisis occurred today', () => {
            const logs = [
                createMockLog({ arousal: 3 }) // Low arousal
            ];
            const crisisEvents = [
                createMockCrisis({ timestamp: new Date().toISOString() }) // Today
            ];

            renderWithRouter(
                <SimpleInsights logs={logs} recentCrisisEvents={crisisEvents} />
            );

            expect(screen.getByText('Krevende dag')).toBeInTheDocument();
        });
    });

    describe('Personalization', () => {
        it('uses child name in description', () => {
            const logs = [createMockLog({ arousal: 2 })];

            renderWithRouter(
                <SimpleInsights logs={logs} childName="Emma" />
            );

            expect(screen.getByText(/Emma har hatt/i)).toBeInTheDocument();
        });

        it('uses default "barnet" when no child name provided', () => {
            const logs = [createMockLog({ arousal: 2 })];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText(/barnet har hatt/i)).toBeInTheDocument();
        });
    });

    describe('Observation count', () => {
        it('shows correct observation count singular', () => {
            const logs = [createMockLog()];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText(/1 observasjon/)).toBeInTheDocument();
        });

        it('shows correct observation count plural', () => {
            const logs = [createMockLog(), createMockLog(), createMockLog()];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText(/3 observasjoner/)).toBeInTheDocument();
        });
    });

    describe('Quick tips', () => {
        it('shows tips section', () => {
            const logs = [createMockLog()];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText('Tips akkurat nå')).toBeInTheDocument();
        });

        it('shows calming tips for high stress days', () => {
            const logs = [
                createMockLog({ arousal: 9 }),
                createMockLog({ arousal: 8 })
            ];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText(/Prioriter rolige aktiviteter/i)).toBeInTheDocument();
        });
    });

    describe('Crisis alerts', () => {
        it('shows crisis alert when recent crises exist', () => {
            const logs = [createMockLog()];
            const crisisEvents = [createMockCrisis()];

            renderWithRouter(
                <SimpleInsights logs={logs} recentCrisisEvents={crisisEvents} />
            );

            expect(screen.getByText(/1 krise siste 7 dager/i)).toBeInTheDocument();
        });

        it('shows plural for multiple crises', () => {
            const logs = [createMockLog()];
            const crisisEvents = [createMockCrisis(), createMockCrisis()];

            renderWithRouter(
                <SimpleInsights logs={logs} recentCrisisEvents={crisisEvents} />
            );

            expect(screen.getByText(/2 kriser siste 7 dager/i)).toBeInTheDocument();
        });

        it('shows link to crisis page', () => {
            const logs = [createMockLog()];
            const crisisEvents = [createMockCrisis()];

            renderWithRouter(
                <SimpleInsights logs={logs} recentCrisisEvents={crisisEvents} />
            );

            const link = screen.getByRole('link', { name: /Se kriseoversikt/i });
            expect(link).toHaveAttribute('href', '/crisis');
        });

        it('does not show crisis alert when no crises', () => {
            const logs = [createMockLog()];

            renderWithRouter(
                <SimpleInsights logs={logs} recentCrisisEvents={[]} />
            );

            expect(screen.queryByText(/krise/i)).not.toBeInTheDocument();
        });
    });

    describe('Navigation links', () => {
        it('shows link to detailed analysis', () => {
            const logs = [createMockLog()];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            const link = screen.getByRole('link', { name: /Se detaljert AI-analyse/i });
            expect(link).toHaveAttribute('href', '/analysis');
        });
    });

    describe('Energy trend', () => {
        it('shows rising energy trend', () => {
            const now = new Date();
            const logs = [
                createMockLog({ energy: 3, timestamp: new Date(now.getTime() - 3600000).toISOString() }),
                createMockLog({ energy: 4, timestamp: new Date(now.getTime() - 1800000).toISOString() }),
                createMockLog({ energy: 7, timestamp: now.toISOString() }),
                createMockLog({ energy: 8, timestamp: now.toISOString() })
            ];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText(/Energien øker/i)).toBeInTheDocument();
        });

        it('shows falling energy trend', () => {
            const now = new Date();
            const logs = [
                createMockLog({ energy: 8, timestamp: new Date(now.getTime() - 3600000).toISOString() }),
                createMockLog({ energy: 7, timestamp: new Date(now.getTime() - 1800000).toISOString() }),
                createMockLog({ energy: 3, timestamp: now.toISOString() }),
                createMockLog({ energy: 2, timestamp: now.toISOString() })
            ];

            renderWithRouter(
                <SimpleInsights logs={logs} />
            );

            expect(screen.getByText(/Energien synker/i)).toBeInTheDocument();
        });
    });
});
