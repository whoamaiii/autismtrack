import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { Suspense, lazy, useCallback } from 'react';
import { DataProvider, useSettings } from './store';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { ToastProvider, StorageErrorListener } from './components/Toast';

// Eagerly loaded - these are on the main navigation path
import { Home } from './components/Home';
import { Dashboard } from './components/Dashboard';

// Lazy loaded - BackgroundShader uses Three.js (large dependency)
const BackgroundShader = lazy(() => import('./components/BackgroundShader'));

// CSS-only fallback background shown while shader loads
const CSSBackground = () => (
  <div className="fixed inset-0 z-[-1] pointer-events-none bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
  </div>
);

// Lazy loaded - secondary pages loaded on demand
const Analysis = lazy(() => import('./components/Analysis').then(m => ({ default: m.Analysis })));
const LogEntryForm = lazy(() => import('./components/LogEntryForm').then(m => ({ default: m.LogEntryForm })));
const BehaviorInsights = lazy(() => import('./components/BehaviorInsights').then(m => ({ default: m.BehaviorInsights })));
const SensoryProfile = lazy(() => import('./components/SensoryProfile').then(m => ({ default: m.SensoryProfile })));
const EnergyRegulation = lazy(() => import('./components/EnergyRegulation').then(m => ({ default: m.EnergyRegulation })));
const CrisisMode = lazy(() => import('./components/CrisisMode').then(m => ({ default: m.CrisisMode })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));
const VisualSchedule = lazy(() => import('./components/VisualSchedule').then(m => ({ default: m.VisualSchedule })));
const GoalTracking = lazy(() => import('./components/GoalTracking').then(m => ({ default: m.GoalTracking })));
const DysregulationHeatmap = lazy(() => import('./components/DysregulationHeatmap').then(m => ({ default: m.DysregulationHeatmap })));
const TransitionInsights = lazy(() => import('./components/TransitionInsights').then(m => ({ default: m.TransitionInsights })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const NotFound = lazy(() => import('./components/NotFound').then(m => ({ default: m.NotFound })));

// Lazy loaded onboarding
const OnboardingWizard = lazy(() => import('./components/onboarding/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));



// Skeleton loading component for better UX during lazy load
const SkeletonPulse = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-white/10 rounded-xl ${className || ''}`} />
);

// Loading fallback component with skeleton UI
const PageLoader = () => (
  <div className="flex flex-col gap-6 p-4 animate-in fade-in duration-200">
    {/* Header skeleton */}
    <div className="flex items-center gap-4">
      <SkeletonPulse className="w-10 h-10 rounded-full" />
      <div className="flex flex-col gap-2">
        <SkeletonPulse className="w-32 h-6" />
        <SkeletonPulse className="w-24 h-4" />
      </div>
    </div>

    {/* Content skeleton cards */}
    <SkeletonPulse className="w-full h-48" />
    <SkeletonPulse className="w-full h-32" />
    <SkeletonPulse className="w-full h-24" />

    {/* Loading indicator */}
    <div className="flex items-center justify-center py-4">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  </div>
);

// Wrapper for LogEntryForm with safe navigation
const LogEntryFormWrapper = () => {
  const navigate = useNavigate();
  const handleClose = useCallback(() => {
    // Check if we can go back, otherwise navigate to home
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return <LogEntryForm onClose={handleClose} />;
};

// Route guard - redirects to onboarding if not completed
const ProtectedRoute = () => {
  const { hasCompletedOnboarding } = useSettings();

  if (!hasCompletedOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

// Onboarding route - redirects to home if already completed
const OnboardingRoute = () => {
  const { hasCompletedOnboarding } = useSettings();

  if (hasCompletedOnboarding) {
    return <Navigate to="/" replace />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <OnboardingWizard />
    </Suspense>
  );
};

// Layout wrapper with error boundary for protected routes
const ProtectedLayout = () => (
  <>
    {/* Load shader after main app shell renders - doesn't block content */}
    <Suspense fallback={null}>
      <BackgroundShader />
    </Suspense>
    <Layout>
      <RouteErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </RouteErrorBoundary>
    </Layout>
  </>
);

const AppContent = () => {
  return (
    <Routes>
      {/* Onboarding route - standalone, no Layout */}
      <Route path="/onboarding" element={<OnboardingRoute />} />

      {/* Protected routes - require onboarding completion */}
      <Route element={<ProtectedRoute />}>
        <Route element={<ProtectedLayout />}>
          {/* Eager routes */}
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Lazy routes */}
          <Route path="/crisis" element={<CrisisMode />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/schedule" element={<VisualSchedule />} />
          <Route path="/goals" element={<GoalTracking />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/log" element={<LogEntryFormWrapper />} />
          <Route path="/behavior-insights" element={<BehaviorInsights />} />
          <Route path="/sensory-profile" element={<SensoryProfile />} />
          <Route path="/energy-regulation" element={<EnergyRegulation />} />
          <Route path="/heatmap" element={<DysregulationHeatmap />} />
          <Route path="/transitions" element={<TransitionInsights />} />
          <Route path="/settings" element={<Settings />} />

          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <DataProvider>
          <ToastProvider>
            <StorageErrorListener />
            {/* CSS background always visible - shader loads in ProtectedLayout */}
            <CSSBackground />
            <AppContent />
          </ToastProvider>
        </DataProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
