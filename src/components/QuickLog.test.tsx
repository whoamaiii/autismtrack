/**
 * Tests for Quick Log Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuickLog } from './QuickLog';
import { BrowserRouter } from 'react-router-dom';
import { DataProvider } from '../store';
import { ToastProvider } from './Toast';

// =============================================================================
// TEST SETUP
// =============================================================================

const renderQuickLog = (props = {}) => {
    return render(
        <BrowserRouter>
            <DataProvider>
                <ToastProvider>
                    <QuickLog {...props} />
                </ToastProvider>
            </DataProvider>
        </BrowserRouter>
    );
};

describe('QuickLog', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    // =========================================================================
    // RENDER TESTS
    // =========================================================================

    describe('Rendering', () => {
        it('should render the quick log title', () => {
            renderQuickLog();
            expect(screen.getByText('Hurtiglogg')).toBeInTheDocument();
        });

        it('should render three traffic light buttons', () => {
            renderQuickLog();

            expect(screen.getByText('Bra')).toBeInTheDocument();
            expect(screen.getByText('Sliter')).toBeInTheDocument();
            expect(screen.getByText('Krise')).toBeInTheDocument();
        });

        it('should render context indicator', () => {
            renderQuickLog();

            // Should show either home or school (Norwegian text)
            const homeOrSchool = screen.queryByText('Hjemme') || screen.queryByText('Skole');
            expect(homeOrSchool).toBeInTheDocument();
        });

        it('should render in compact mode when specified', () => {
            renderQuickLog({ compact: true });

            // In compact mode, title should not be visible
            expect(screen.queryByText('Hurtiglogg')).not.toBeInTheDocument();
        });

        it('should render hint text in normal mode', () => {
            renderQuickLog();
            expect(screen.getByText(/Trykk én gang for å logge raskt/)).toBeInTheDocument();
        });

        it('should not render hint text in compact mode', () => {
            renderQuickLog({ compact: true });
            expect(screen.queryByText(/Trykk én gang for å logge raskt/)).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // INTERACTION TESTS
    // =========================================================================

    describe('Button Interactions', () => {
        it('should have accessible button labels', () => {
            renderQuickLog();

            // Check for buttons with Norwegian aria-labels
            expect(screen.getByRole('button', { name: /Bra.*Trykk for å logge/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Sliter.*Trykk for å logge/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Krise.*Trykk for å logge/i })).toBeInTheDocument();
        });

        it('should call onLogAdded callback when log is added', async () => {
            const onLogAdded = vi.fn();
            renderQuickLog({ onLogAdded });

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.click(goodButton!);

            await waitFor(() => {
                expect(onLogAdded).toHaveBeenCalled();
            });
        });

        it('should show success indicator after logging', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.click(goodButton!);

            await waitFor(() => {
                expect(screen.getByText('Logget!')).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // DETAILS PANEL TESTS
    // =========================================================================

    describe('Details Panel', () => {
        it('should show details panel on double click', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.doubleClick(goodButton!);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Hva skjer akkurat nå?')).toBeInTheDocument();
            });
        });

        it('should allow entering notes', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.doubleClick(goodButton!);

            await waitFor(() => {
                const textarea = screen.getByPlaceholderText('Hva skjer akkurat nå?');
                fireEvent.change(textarea, { target: { value: 'Test note' } });
                expect(textarea).toHaveValue('Test note');
            });
        });

        it('should have cancel and save buttons in details panel', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.doubleClick(goodButton!);

            await waitFor(() => {
                expect(screen.getByText('Avbryt')).toBeInTheDocument();
                expect(screen.getByText('Lagre logg')).toBeInTheDocument();
            });
        });

        it('should close details panel on cancel', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.doubleClick(goodButton!);

            await waitFor(() => {
                const cancelButton = screen.getByText('Avbryt');
                fireEvent.click(cancelButton);
            });

            await waitFor(() => {
                expect(screen.queryByPlaceholderText('Hva skjer akkurat nå?')).not.toBeInTheDocument();
            });
        });

        it('should save log with note when save is clicked', async () => {
            const onLogAdded = vi.fn();
            renderQuickLog({ onLogAdded });

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.doubleClick(goodButton!);

            await waitFor(() => {
                const textarea = screen.getByPlaceholderText('Hva skjer akkurat nå?');
                fireEvent.change(textarea, { target: { value: 'Test note' } });
            });

            const saveButton = screen.getByText('Lagre logg');
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(onLogAdded).toHaveBeenCalled();
            });
        });
    });

    // =========================================================================
    // CONTEXT SWITCHING TESTS
    // =========================================================================

    describe('Context Switching', () => {
        it('should switch context when context button is clicked', async () => {
            renderQuickLog();

            // Find the context button (has title attribute)
            const contextButton = screen.getByTitle('Bytt kontekst');
            const hasHome = screen.queryByText('Hjemme') !== null;

            fireEvent.click(contextButton);

            await waitFor(() => {
                if (hasHome) {
                    expect(screen.getByText('Skole')).toBeInTheDocument();
                } else {
                    expect(screen.getByText('Hjemme')).toBeInTheDocument();
                }
            });
        });
    });

    // =========================================================================
    // HAPTIC FEEDBACK TESTS
    // =========================================================================

    describe('Haptic Feedback', () => {
        it('should trigger vibration on supported devices', () => {
            // Mock navigator.vibrate
            const vibrateMock = vi.fn();
            Object.defineProperty(navigator, 'vibrate', {
                value: vibrateMock,
                writable: true,
                configurable: true
            });

            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.click(goodButton!);

            expect(vibrateMock).toHaveBeenCalled();
        });

        it('should use different vibration patterns for different levels', () => {
            const vibrateMock = vi.fn();
            Object.defineProperty(navigator, 'vibrate', {
                value: vibrateMock,
                writable: true,
                configurable: true
            });

            renderQuickLog();

            // Click good button (light vibration)
            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.click(goodButton!);
            expect(vibrateMock).toHaveBeenLastCalledWith(10);

            // Click struggling button (medium vibration)
            const strugglingButton = screen.getByText('Sliter').closest('button');
            fireEvent.click(strugglingButton!);
            expect(vibrateMock).toHaveBeenLastCalledWith(30);

            // Click crisis button (heavy vibration)
            const crisisButton = screen.getByText('Krise').closest('button');
            fireEvent.click(crisisButton!);
            expect(vibrateMock).toHaveBeenLastCalledWith([50, 30, 50]);
        });
    });

    // =========================================================================
    // ACCESSIBILITY TESTS
    // =========================================================================

    describe('Accessibility', () => {
        it('should have proper aria-labels on buttons', () => {
            renderQuickLog();

            const buttons = screen.getAllByRole('button');
            const trafficLightButtons = buttons.filter(btn =>
                btn.getAttribute('aria-label')?.includes('Trykk for å logge')
            );

            expect(trafficLightButtons.length).toBe(3);
        });

        it('should have proper placeholder text for note input', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.doubleClick(goodButton!);

            await waitFor(() => {
                const textarea = screen.getByPlaceholderText('Hva skjer akkurat nå?');
                expect(textarea).toBeInTheDocument();
            });
        });
    });

    // =========================================================================
    // DATA PERSISTENCE TESTS
    // =========================================================================

    describe('Data Persistence', () => {
        it('should store log entry in localStorage', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.click(goodButton!);

            await waitFor(() => {
                const storedLogs = localStorage.getItem('kreativium_logs');
                expect(storedLogs).toBeTruthy();
            });
        });

        it('should include correct data in log entry', async () => {
            renderQuickLog();

            const goodButton = screen.getByText('Bra').closest('button');
            fireEvent.click(goodButton!);

            await waitFor(() => {
                const storedLogs = JSON.parse(localStorage.getItem('kreativium_logs') || '[]');
                expect(storedLogs.length).toBeGreaterThan(0);

                const lastLog = storedLogs[storedLogs.length - 1];
                // Good level should have low arousal (1-3), high valence (7-10)
                expect(lastLog.arousal).toBeGreaterThanOrEqual(1);
                expect(lastLog.arousal).toBeLessThanOrEqual(3);
                expect(lastLog.valence).toBeGreaterThanOrEqual(7);
                expect(lastLog.valence).toBeLessThanOrEqual(10);
            });
        });
    });
});
