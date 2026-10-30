import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { NewRepairPage } from './pages/NewRepairPage';
import { ProgressPage } from './pages/ProgressPage';
import { ResultPage } from './pages/ResultPage';
import { JobsPage } from './pages/JobsPage';
import { ModelsPage } from './pages/ModelsPage';
import { SecurityPage } from './pages/SecurityPage';
import { AboutPage } from './pages/AboutPage';
import { jobSessionStore } from './lib/jobSessionStore';

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
        </AppLayoutWrapper>
      </ToastProvider>
    </BrowserRouter>
  );
}
