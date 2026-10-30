import React, { useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { ScrollProgressBar } from '../ScrollProgressBar';
import { BackToTop } from '../BackToTop';
import { CookieBanner } from '../CookieBanner';
import { FloatingContact } from '../FloatingContact';
import { SearchModal } from '../SearchModal';
import { ThemeToggle } from '../ThemeToggle';
import { Search } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  currentJobId?: string | null;
}

export function AppLayout({ children, currentJobId }: AppLayoutProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K search shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-warm-bg dark:bg-dark-bg flex flex-col lg:flex-row antialiased font-sans text-ink-primary dark:text-dark-ink-primary transition-colors duration-150">
      {/* Scroll Progress Bar at the top */}
      <ScrollProgressBar />

      {/* Accessible Skip-to-Content Link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Sidebar navigation */}
      <Sidebar currentJobId={currentJobId} onOpenSearch={() => setSearchOpen(true)} />

      {/* Main Container Area with Scroll Margins */}
      <div className="flex-1 p-2 sm:p-3 lg:p-3 min-w-0 flex flex-col scroll-pt-16">
        <div className="bg-white dark:bg-dark-surface rounded-3xl border border-warm-border dark:border-dark-border shadow-soft flex-1 flex flex-col overflow-x-hidden min-h-[calc(100vh-1.5rem)] relative">
          {/* Sticky Desktop & Tablet Header */}
          <header className="sticky top-0 z-20 backdrop-blur-md bg-white/90 dark:bg-dark-surface/90 border-b border-warm-border-subtle dark:border-dark-border-subtle px-5 sm:px-8 py-3 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary tracking-tight">
                ProofPatch Orchestrator
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search site (Ctrl+K)"
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-warm-border dark:border-dark-border bg-[#FAF8F5] dark:bg-dark-card text-xs text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary hover:border-[#D8D2CA] dark:hover:border-dark-border shadow-soft transition-colors focus-visible:outline-2"
              >
                <Search className="h-3.5 w-3.5 text-ink-muted dark:text-dark-ink-muted" strokeWidth={1.5} />
                <span>Search pages & models…</span>
                <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-dark-surface rounded border border-warm-border/60 dark:border-dark-border/60">
                  Ctrl K
                </kbd>
              </button>

              <ThemeToggle />
            </div>
          </header>

          {/* Main Content Region with id for skip link */}
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 p-5 sm:p-8 flex flex-col focus:outline-none printable-container"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Global Interactive Utilities */}
      <BackToTop />
      <FloatingContact />
      <CookieBanner />
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
