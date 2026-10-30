import React from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  currentJobId?: string | null;
}

export function AppLayout({ children, currentJobId }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-warm-bg flex flex-col lg:flex-row antialiased font-sans text-ink-primary">
      <Sidebar currentJobId={currentJobId} />
      <div className="flex-1 p-2 sm:p-3 lg:p-3 min-w-0 flex flex-col">
        <div className="bg-white rounded-3xl border border-warm-border shadow-soft flex-1 flex flex-col p-5 sm:p-8 overflow-x-hidden min-h-[calc(100vh-1.5rem)]">
          {children}
        </div>
      </div>
    </div>
  );
}

