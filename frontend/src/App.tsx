import React, { Suspense, lazy } from 'react';
import { RouterProvider, useRouter } from './router';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ErrorBoundary } from './components/ErrorBoundary';

// Code-split dynamic page imports for optimal performance & minimal initial payload
const OverviewPage = lazy(() => import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const MissionBrowserPage = lazy(() => import('./pages/MissionBrowserPage').then((m) => ({ default: m.MissionBrowserPage })));
const MissionRoutePlannerPage = lazy(() => import('./pages/MissionRoutePlannerPage').then((m) => ({ default: m.MissionRoutePlannerPage })));

const RouteLoadingFallback: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3">
    <div className="w-8 h-8 border-2 border-white/20 border-t-[#58D8D0] rounded-full animate-spin" />
    <span className="font-mono text-xs text-white/60 tracking-widest uppercase">
      SYNCHRONIZING MISSION TELEMETRY...
    </span>
  </div>
);

const AppContent: React.FC = () => {
  const { currentPath } = useRouter();

  // Route selector
  const renderCurrentPage = () => {
    switch (currentPath) {
      case '/':
      case '/space-observer':
        return <OverviewPage />;
      case '/mission-browser':
      case '/trade-offs':
      case '/site-decision':
      case '/research-lab':
      case '/scenario-comparison':
      case '/scientific-lab':
      case '/system-diagnostics':
        return <MissionBrowserPage />;
      case '/route-planner':
      case '/launch-planner':
      case '/mission-planner':
        return <MissionRoutePlannerPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="min-h-screen bg-black font-body-md text-white flex flex-col selection:bg-[#FFFFFF] selection:text-black antialiased">
      {/* Persistent Navigation Header */}
      <Header />

      {/* Main Multi-Page Route Render Container */}
      <main className="w-full flex-1 flex flex-col">
        <ErrorBoundary fallbackTitle="Mission Control Route Error">
          <Suspense fallback={<RouteLoadingFallback />}>
            {renderCurrentPage()}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Unified Footer */}
      <Footer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
};

export default App;
