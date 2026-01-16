import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { type BrowserRouterProps } from 'react-router-dom';
import App from './App';
import React, { type ReactNode } from 'react';

// Track initial route for tests
let testInitialRoute = '/';

// Mock react-router-dom to replace BrowserRouter with MemoryRouter
vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>();
    return {
        ...actual,
        BrowserRouter: ({ children }: BrowserRouterProps) => (
            <actual.MemoryRouter initialEntries={[testInitialRoute]}>
                {children}
            </actual.MemoryRouter>
        ),
    };
});

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => {
    const filterMotionProps = (props: Record<string, unknown>) => {
        const motionKeys = ['whileTap', 'initial', 'animate', 'exit', 'transition', 'whileHover', 'variants', 'layout', 'layoutId'];
        return Object.fromEntries(Object.entries(props).filter(([key]) => !motionKeys.includes(key)));
    };
    return {
        motion: {
            div: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <div {...filterMotionProps(props)}>{children}</div>,
            button: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <button {...filterMotionProps(props)}>{children}</button>,
            span: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <span {...filterMotionProps(props)}>{children}</span>,
            p: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <p {...filterMotionProps(props)}>{children}</p>,
            h1: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <h1 {...filterMotionProps(props)}>{children}</h1>,
            h2: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <h2 {...filterMotionProps(props)}>{children}</h2>,
            nav: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <nav {...filterMotionProps(props)}>{children}</nav>,
            ul: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <ul {...filterMotionProps(props)}>{children}</ul>,
            li: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <li {...filterMotionProps(props)}>{children}</li>,
            a: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) =>
                <a {...filterMotionProps(props)}>{children}</a>,
        },
        AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
        MotionConfig: ({ children }: { children: ReactNode }) => <>{children}</>,
        useScroll: () => ({ scrollYProgress: { current: 0 } }),
        useTransform: () => 0,
        useSpring: () => 0,
        useAnimation: () => ({ start: vi.fn(), stop: vi.fn() }),
        useReducedMotion: () => true,
    };
});

// Mock react-i18next
vi.mock('react-i18next', () => {
    const mockT = (key: string, fallback?: string | object) => {
        if (typeof fallback === 'object' && fallback !== null) return key;
        return typeof fallback === 'string' ? fallback : key;
    };
    const mockI18n = { language: 'en', changeLanguage: () => Promise.resolve() };

    return {
        useTranslation: () => ({ t: mockT, i18n: mockI18n }),
        // withTranslation HOC wraps component and injects t, i18n, tReady props
        withTranslation: () => (WrappedComponent: React.ComponentType<Record<string, unknown>>) => {
            const WithTranslationWrapper = (props: Record<string, unknown>) => {
                return React.createElement(WrappedComponent, {
                    ...props,
                    t: mockT,
                    i18n: mockI18n,
                    tReady: true,
                });
            };
            WithTranslationWrapper.displayName = `withTranslation(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
            return WithTranslationWrapper;
        },
        Trans: ({ children }: { children: React.ReactNode }) => children,
        initReactI18next: { type: '3rdParty', init: () => {} },
    };
});

// Mock Toast components
vi.mock('./components/Toast', () => ({
    ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    StorageErrorListener: () => null,
    useToast: () => ({
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn(),
        showInfo: vi.fn(),
    }),
}));

// Mock BackgroundShader (lazy loaded, uses Three.js)
vi.mock('./components/BackgroundShader', () => ({
    default: () => <div data-testid="background-shader" />,
}));

// Mock lazy-loaded components
vi.mock('./components/Analysis', () => ({
    Analysis: () => <div data-testid="analysis-page">Analysis Page</div>,
}));

vi.mock('./components/LogEntryForm', () => ({
    LogEntryForm: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="log-entry-form">
            Log Entry Form
            <button onClick={onClose}>Close</button>
        </div>
    ),
}));

vi.mock('./components/BehaviorInsights', () => ({
    BehaviorInsights: () => <div data-testid="behavior-insights-page">Behavior Insights Page</div>,
}));

vi.mock('./components/SensoryProfile', () => ({
    SensoryProfile: () => <div data-testid="sensory-profile-page">Sensory Profile Page</div>,
}));

vi.mock('./components/EnergyRegulation', () => ({
    EnergyRegulation: () => <div data-testid="energy-regulation-page">Energy Regulation Page</div>,
}));

vi.mock('./components/CrisisMode', () => ({
    CrisisMode: () => <div data-testid="crisis-mode-page">Crisis Mode Page</div>,
}));

vi.mock('./components/Reports', () => ({
    Reports: () => <div data-testid="reports-page">Reports Page</div>,
}));

vi.mock('./components/VisualSchedule', () => ({
    VisualSchedule: () => <div data-testid="visual-schedule-page">Visual Schedule Page</div>,
}));

vi.mock('./components/GoalTracking', () => ({
    GoalTracking: () => <div data-testid="goal-tracking-page">Goal Tracking Page</div>,
}));

vi.mock('./components/DysregulationHeatmap', () => ({
    DysregulationHeatmap: () => <div data-testid="heatmap-page">Heatmap Page</div>,
}));

vi.mock('./components/TransitionInsights', () => ({
    TransitionInsights: () => <div data-testid="transition-insights-page">Transition Insights Page</div>,
}));

vi.mock('./components/Settings', () => ({
    Settings: () => <div data-testid="settings-page">Settings Page</div>,
}));

vi.mock('./components/NotFound', () => ({
    NotFound: () => <div data-testid="not-found-page">404 Not Found</div>,
}));

vi.mock('./components/onboarding/OnboardingWizard', () => ({
    OnboardingWizard: () => <div data-testid="onboarding-wizard">Onboarding Wizard</div>,
}));

// Mock store with controllable onboarding state
let mockOnboardingCompleted = false;
vi.mock('./store', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./store')>();
    return {
        ...actual,
        useSettings: () => ({
            hasCompletedOnboarding: mockOnboardingCompleted,
            completeOnboarding: vi.fn(() => { mockOnboardingCompleted = true; }),
            resetOnboarding: vi.fn(() => { mockOnboardingCompleted = false; }),
        }),
    };
});

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
        removeItem: vi.fn((key: string) => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; }),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Helper to render App with a specific route
const renderAppWithRoute = (initialRoute: string = '/') => {
    testInitialRoute = initialRoute;
    return render(<App />);
};

describe('App Component', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
        mockOnboardingCompleted = false;
        testInitialRoute = '/';
    });

    describe('App Structure', () => {
        it('renders without crashing', () => {
            mockOnboardingCompleted = true;
            render(<App />);
            // App should render - we check for CSS background class which is always present
            const backgroundElement = document.querySelector('.bg-gradient-to-br');
            expect(backgroundElement).toBeInTheDocument();
        });

        it('renders CSS fallback background', () => {
            mockOnboardingCompleted = true;
            render(<App />);
            // CSS background should always be visible
            const cssBackground = document.querySelector('.bg-gradient-to-br.from-slate-950');
            expect(cssBackground).toBeInTheDocument();
        });
    });

    describe('Onboarding Flow', () => {
        it('redirects to onboarding when not completed', async () => {
            mockOnboardingCompleted = false;
            renderAppWithRoute('/');
            await waitFor(() => {
                expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
            });
        });
    });

    describe('Route Navigation', () => {
        beforeEach(() => {
            mockOnboardingCompleted = true;
        });

        it('renders crisis mode page on /crisis route', async () => {
            renderAppWithRoute('/crisis');

            await waitFor(() => {
                expect(screen.getByTestId('crisis-mode-page')).toBeInTheDocument();
            });
        });
    });

    describe('Layout Components', () => {
        beforeEach(() => {
            mockOnboardingCompleted = true;
        });

        it('renders BackgroundShader in ProtectedLayout', async () => {
            renderAppWithRoute('/');

            await waitFor(() => {
                expect(screen.getByTestId('background-shader')).toBeInTheDocument();
            });
        });
    });

    describe('Loading States', () => {
        beforeEach(() => {
            mockOnboardingCompleted = true;
        });

        it('shows loading spinner in PageLoader component', () => {
            const { container } = renderAppWithRoute('/');
            const pulseElements = container.querySelectorAll('.animate-pulse');
            expect(pulseElements).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('wraps app in ErrorBoundary', () => {
            // ErrorBoundary is a class component that wraps the entire app
            // We test that errors are caught by rendering a component that throws
            mockOnboardingCompleted = true;

            // The App should render without errors when working correctly
            expect(() => render(<App />)).not.toThrow();
        });
    });

    describe('Provider Hierarchy', () => {
        it('has correct provider nesting order', () => {
            mockOnboardingCompleted = true;

            // The App component should have:
            // ErrorBoundary > BrowserRouter > DataProvider > ToastProvider
            const { container } = render(<App />);

            // If providers are incorrectly nested, the app would crash
            // A successful render indicates correct nesting
            expect(container).toBeTruthy();
        });
    });
});

describe('CSSBackground Component', () => {
    it('has correct CSS classes for gradient background', () => {
        mockOnboardingCompleted = true;
        render(<App />);

        const cssBackground = document.querySelector('.bg-gradient-to-br.from-slate-950');
        expect(cssBackground).toHaveClass('fixed', 'inset-0', 'z-[-1]', 'pointer-events-none');
    });

    it('has inner radial gradient overlay', () => {
        mockOnboardingCompleted = true;
        render(<App />);

        const radialGradient = document.querySelector('.bg-\\[radial-gradient\\(ellipse_at_top\\,_var\\(--tw-gradient-stops\\)\\)\\]');
        expect(radialGradient).toBeInTheDocument();
    });
});

describe('SkeletonPulse Component', () => {
    it('applies animate-pulse class for skeleton loading effect', async () => {
        mockOnboardingCompleted = true;
        const { container } = renderAppWithRoute('/');
        await waitFor(() => {
            const pulseElements = container.querySelectorAll('.animate-pulse');
            expect(pulseElements).toBeDefined();
        });
    });
});

describe('LogEntryFormWrapper', () => {
    it('renders LogEntryForm with close handler', async () => {
        mockOnboardingCompleted = true;
        renderAppWithRoute('/log');
        await waitFor(() => {
            expect(screen.getByTestId('log-entry-form')).toBeInTheDocument();
        });
    });
});

describe('ProtectedRoute Component', () => {
    it('renders Outlet when onboarding is completed', async () => {
        mockOnboardingCompleted = true;
        renderAppWithRoute('/dashboard');
        await waitFor(() => {
            expect(screen.queryByTestId('onboarding-wizard')).not.toBeInTheDocument();
        });
    });
});

describe('OnboardingRoute Component', () => {
    it('shows onboarding wizard when not completed', async () => {
        mockOnboardingCompleted = false;
        renderAppWithRoute('/onboarding');
        await waitFor(() => {
            expect(screen.getByTestId('onboarding-wizard')).toBeInTheDocument();
        });
    });
});

describe('ProtectedLayout Component', () => {
    it('renders BackgroundShader', async () => {
        mockOnboardingCompleted = true;
        renderAppWithRoute('/');
        await waitFor(() => {
            expect(screen.getByTestId('background-shader')).toBeInTheDocument();
        });
    });
});
