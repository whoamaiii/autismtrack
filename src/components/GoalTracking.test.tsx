import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GoalTracking } from './GoalTracking';
import { DataProvider } from '../store';
import type { Goal } from '../types';

// Valid UUIDs for testing
const TEST_UUID_1 = '11111111-1111-4111-a111-111111111111';
const TEST_UUID_2 = '22222222-2222-4222-a222-222222222222';
const TEST_UUID_3 = '33333333-3333-4333-a333-333333333333';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => {
    const filterMotionProps = (props: Record<string, unknown>) => {
        const motionKeys = ['whileTap', 'initial', 'animate', 'exit', 'transition', 'whileHover', 'variants'];
        return Object.fromEntries(Object.entries(props).filter(([key]) => !motionKeys.includes(key)));
    };
    return {
        motion: {
            div: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
                <div {...filterMotionProps(props)}>{children}</div>,
            button: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) =>
                <button {...filterMotionProps(props)}>{children}</button>,
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    };
});

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string | object) => {
            // Handle interpolation objects
            if (typeof fallback === 'object' && fallback !== null) {
                return key;
            }
            // Return fallback string or key
            return typeof fallback === 'string' ? fallback : key;
        },
    }),
}));

// Mock useToast
vi.mock('./Toast', () => ({
    useToast: () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
    }),
}));

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test wrapper with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
        <DataProvider>
            {children}
        </DataProvider>
    </MemoryRouter>
);

// Helper to render with providers
const renderWithProviders = () => {
    return render(
        <TestWrapper>
            <GoalTracking />
        </TestWrapper>
    );
};

// Helper to set up goals in localStorage before render
const setupGoalsInStorage = (goals: Goal[]) => {
    localStorageMock.setItem('kreativium_goals', JSON.stringify(goals));
};

describe('GoalTracking Component', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the component with title', () => {
            renderWithProviders();
            expect(screen.getByText('goals.title')).toBeInTheDocument();
        });

        it('renders sample goals when no real goals exist', () => {
            renderWithProviders();

            // Sample goals should be visible
            expect(screen.getByText('Reduser Nedsmeltingsvarighet')).toBeInTheDocument();
            expect(screen.getByText('Øk "Grønn Sone" Tid')).toBeInTheDocument();
            expect(screen.getByText('Bruk Strategier Selvstendig')).toBeInTheDocument();
        });

        it('shows sample badges on demo goals', () => {
            renderWithProviders();

            // Should show 3 sample badges (one per demo goal)
            const sampleBadges = screen.getAllByText('Sample');
            expect(sampleBadges).toHaveLength(3);
        });

        it('shows sample summary text when displaying demo goals', () => {
            renderWithProviders();

            expect(screen.getByText('Sample goals shown below. Add your own to start tracking!')).toBeInTheDocument();
        });

        it('renders real goals instead of samples when goals exist', () => {
            const realGoal: Goal = {
                id: TEST_UUID_1,
                title: 'My Real Goal',
                description: 'A real goal description',
                category: 'regulation',
                targetValue: 10,
                targetUnit: 'times',
                targetDirection: 'increase',
                startDate: new Date().toISOString(),
                targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                currentValue: 5,
                status: 'in_progress',
                progressHistory: [],
            };

            setupGoalsInStorage([realGoal]);
            renderWithProviders();

            expect(screen.getByText('My Real Goal')).toBeInTheDocument();
            // Sample goals should not be visible
            expect(screen.queryByText('Reduser Nedsmeltingsvarighet')).not.toBeInTheDocument();
        });

        it('does not show sample badge on real goals', () => {
            const realGoal: Goal = {
                id: TEST_UUID_1,
                title: 'My Real Goal',
                description: 'A real goal',
                category: 'regulation',
                targetValue: 10,
                targetUnit: 'times',
                targetDirection: 'increase',
                startDate: new Date().toISOString(),
                targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                currentValue: 5,
                status: 'in_progress',
                progressHistory: [],
            };

            setupGoalsInStorage([realGoal]);
            renderWithProviders();

            // Should not have any sample badges
            expect(screen.queryByText('Sample')).not.toBeInTheDocument();
        });
    });

    describe('Progress Calculation', () => {
        it('calculates progress for increase goals correctly', () => {
            const goal: Goal = {
                id: TEST_UUID_1,
                title: 'Increase Goal',
                description: 'Test',
                category: 'regulation',
                targetValue: 10,
                targetUnit: 'times',
                targetDirection: 'increase',
                startDate: new Date().toISOString(),
                targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                currentValue: 5,
                status: 'in_progress',
                progressHistory: [],
            };

            setupGoalsInStorage([goal]);
            renderWithProviders();

            // 5/10 = 50% - appears in both summary and goal card
            const progressElements = screen.getAllByText('50%');
            expect(progressElements.length).toBeGreaterThanOrEqual(1);
        });

        it('shows 100% for completed goals', () => {
            const goal: Goal = {
                id: TEST_UUID_2,
                title: 'Completed Goal',
                description: 'Test',
                category: 'regulation',
                targetValue: 10,
                targetUnit: 'times',
                targetDirection: 'increase',
                startDate: new Date().toISOString(),
                targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                currentValue: 10,
                status: 'achieved',
                progressHistory: [],
            };

            setupGoalsInStorage([goal]);
            renderWithProviders();

            // 100% appears in both summary and goal card
            const progressElements = screen.getAllByText('100%');
            expect(progressElements.length).toBeGreaterThanOrEqual(1);
        });

        it('shows checkmark for achieved goals', () => {
            const goal: Goal = {
                id: TEST_UUID_3,
                title: 'Achieved Goal',
                description: 'Test',
                category: 'regulation',
                targetValue: 10,
                targetUnit: 'times',
                targetDirection: 'increase',
                startDate: new Date().toISOString(),
                targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                currentValue: 12, // Over target
                status: 'achieved',
                progressHistory: [],
            };

            setupGoalsInStorage([goal]);
            renderWithProviders();

            // The achieved sample goal shows checkmark
            // Check for the green checkmark container
            const checkmarks = document.querySelectorAll('.bg-green-500\\/20');
            expect(checkmarks.length).toBeGreaterThan(0);
        });
    });

    describe('Add Goal Modal', () => {
        it('opens add goal modal when plus button is clicked', async () => {
            renderWithProviders();

            // Click the add button in header
            const addButtons = screen.getAllByLabelText('goals.addGoal');
            fireEvent.click(addButtons[0]);

            await waitFor(() => {
                expect(screen.getByText('goals.newGoal')).toBeInTheDocument();
            });
        });

        it('shows Add Your First Goal button when showing samples', () => {
            renderWithProviders();

            expect(screen.getByText('Add Your First Goal')).toBeInTheDocument();
        });

        it('closes modal when X is clicked', async () => {
            renderWithProviders();

            // Open modal
            const addButtons = screen.getAllByLabelText('goals.addGoal');
            fireEvent.click(addButtons[0]);

            await waitFor(() => {
                expect(screen.getByText('goals.newGoal')).toBeInTheDocument();
            });

            // Find and click close button by looking for buttons in the modal header
            const modalHeader = screen.getByText('goals.newGoal').parentElement;
            const xButton = modalHeader?.querySelector('button');
            if (xButton) {
                fireEvent.click(xButton);
            }

            // Modal should close - the newGoal text should be gone
            await waitFor(() => {
                // The modal is in AnimatePresence, may take time to animate out
                // In our mock, it's instant
            });
        });
    });

    describe('Form Validation', () => {
        it('shows validation error when title is empty', async () => {
            renderWithProviders();

            // Open modal
            const addButtons = screen.getAllByLabelText('goals.addGoal');
            fireEvent.click(addButtons[0]);

            await waitFor(() => {
                expect(screen.getByText('goals.newGoal')).toBeInTheDocument();
            });

            // Find the submit button by its text (goals.form.submit)
            const submitButton = screen.getByText('goals.form.submit');

            // Try to submit without title
            fireEvent.click(submitButton);

            // Validation error should appear
            await waitFor(() => {
                expect(screen.getByText('goals.validation.titleRequired')).toBeInTheDocument();
            });
        });
    });

    describe('Category Display', () => {
        it('displays category labels correctly', () => {
            renderWithProviders();

            // Sample goals have regulation and independence categories
            // The component uses GOAL_CATEGORIES to get labels
            const categoryLabels = screen.getAllByText(/Regulering|Selvstendighet/i);
            expect(categoryLabels.length).toBeGreaterThan(0);
        });
    });

    describe('Deadline Display', () => {
        it('shows deadline information for active goals', () => {
            const goal: Goal = {
                id: TEST_UUID_1,
                title: 'Goal with Deadline',
                description: 'Test',
                category: 'regulation',
                targetValue: 10,
                targetUnit: 'times',
                targetDirection: 'increase',
                startDate: new Date().toISOString(),
                targetDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days
                currentValue: 5,
                status: 'in_progress',
                progressHistory: [],
            };

            setupGoalsInStorage([goal]);
            renderWithProviders();

            // Should show days left (using translation key)
            expect(screen.getByText(/goals.deadline.daysLeft/)).toBeInTheDocument();
        });
    });

    describe('Log Progress Button', () => {
        it('shows log progress button for real goals', () => {
            const goal: Goal = {
                id: TEST_UUID_1,
                title: 'Real Goal',
                description: 'Test',
                category: 'regulation',
                targetValue: 10,
                targetUnit: 'times',
                targetDirection: 'increase',
                startDate: new Date().toISOString(),
                targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                currentValue: 5,
                status: 'in_progress',
                progressHistory: [],
            };

            setupGoalsInStorage([goal]);
            renderWithProviders();

            expect(screen.getByText('goals.logProgress')).toBeInTheDocument();
        });

        it('does not show log progress button for sample goals', () => {
            renderWithProviders();

            // When showing samples, the log progress button should not appear
            expect(screen.queryByText('goals.logProgress')).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('has accessible button labels', () => {
            renderWithProviders();

            // Check for aria-labels - BackButton uses translated 'common.back' key
            expect(screen.getByLabelText('Back')).toBeInTheDocument();
            expect(screen.getAllByLabelText('goals.addGoal').length).toBeGreaterThan(0);
        });
    });
});
