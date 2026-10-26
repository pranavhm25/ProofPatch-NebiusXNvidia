import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NewRepairPage } from './pages/NewRepairPage';
import { ProgressPage } from './pages/ProgressPage';
import { ResultPage } from './pages/ResultPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0d0d0d] text-neutral-100 antialiased selection:bg-blue-600 selection:text-white">
        <Routes>
          <Route path="/" element={<NewRepairPage />} />
          <Route path="/jobs/:jobId" element={<ProgressPage />} />
          <Route path="/jobs/:jobId/result" element={<ResultPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
