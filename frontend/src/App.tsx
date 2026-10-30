import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { PageSkeleton } from './components/Skeleton';
import { jobSessionStore } from './lib/jobSessionStore';

// Route-level code splitting with React.lazy
const NewRepairPage = lazy(() =>
  import('./pages/NewRepairPage').then((m) => ({ default: m.NewRepairPage }))
);
const ProgressPage = lazy(() =>
  import('./pages/ProgressPage').then((m) => ({ default: m.ProgressPage }))
);
const ResultPage = lazy(() =>
  import('./pages/ResultPage').then((m) => ({ default: m.ResultPage }))
);
const JobsPage = lazy(() =>
  import('./pages/JobsPage').then((m) => ({ default: m.JobsPage }))
);
const ModelsPage = lazy(() =>
  import('./pages/ModelsPage').then((m) => ({ default: m.ModelsPage }))
);
const SecurityPage = lazy(() =>
  import('./pages/SecurityPage').then((m) => ({ default: m.SecurityPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);

function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const match = location.pathname.match(/^\/jobs\/([^/]+)/);
  const pathJobId = match && match[1] !== 'undefined' ? match[1] : null;
  const currentJobId = pathJobId || jobSessionStore.getLastJobId();

  return <AppLayout currentJobId={currentJobId}>{children}</AppLayout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppLayoutWrapper>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/" element={<NewRepairPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:jobId" element={<ProgressPage />} />
              <Route path="/jobs/:jobId/result" element={<ResultPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppLayoutWrapper>
      </ToastProvider>
    </BrowserRouter>
  );
}
