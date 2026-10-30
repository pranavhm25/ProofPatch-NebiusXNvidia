import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Wrench,
  Search,
  Bell,
  ChevronDown,
  Inbox,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileCheck,
  Cpu,
  Shield,
  Info,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

interface SidebarProps {
  currentJobId?: string | null;
  onOpenSearch?: () => void;
}

export function Sidebar({ currentJobId, onOpenSearch }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Handle Escape key and focus trap when mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      // Trap focus inside drawer
      if (e.key === 'Tab' && drawerRef.current) {
        const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors focus-visible:outline-2 ${
      isActive
        ? 'bg-warm-muted dark:bg-dark-muted text-ink-primary dark:text-dark-ink-primary font-semibold'
        : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-[#EAE5DE] dark:hover:bg-dark-pill'
    }`;

  const subNavLinkClass = (filter: string) => {
    const isJobsPage = location.pathname === '/jobs';
    const params = new URLSearchParams(location.search);
    const active =
      isJobsPage &&
      (params.get('filter') === filter || (!params.get('filter') && filter === 'all'));
    return `flex items-center gap-2 py-1 px-2.5 text-xs rounded-lg transition-colors focus-visible:outline-2 ${
      active
        ? 'bg-warm-muted dark:bg-dark-muted text-ink-primary dark:text-dark-ink-primary font-semibold'
        : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-[#EAE5DE] dark:hover:bg-dark-pill'
    }`;
  };

  const content = (
    <div className="flex flex-col h-full p-4 w-[260px] text-ink-primary dark:text-dark-ink-primary select-none">
      {/* Top Header: Brand + Quick Actions */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-ink-primary dark:bg-dark-surface border dark:border-dark-border flex items-center justify-center text-warm-bg dark:text-amber-400 shadow-xs">
            <Sparkles className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <span className="font-semibold text-sm tracking-tight text-ink-primary dark:text-dark-ink-primary">
            ProofPatch
          </span>
        </div>
        <div className="flex items-center gap-1 text-ink-muted dark:text-dark-ink-muted">
          <ThemeToggle />
          <button
            type="button"
            onClick={onOpenSearch}
            className="p-1.5 rounded-lg hover:bg-warm-muted dark:hover:bg-dark-pill hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors focus-visible:outline-2"
            title="Search repair history (Ctrl+K)"
            aria-label="Search"
          >
            <Search className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="relative p-1.5 rounded-lg hover:bg-warm-muted dark:hover:bg-dark-pill hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors focus-visible:outline-2"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
        </div>
      </div>

      {/* Workspace Selector Dropdown Pill */}
      <div className="mb-5">
        <button
          type="button"
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white dark:bg-dark-surface border border-warm-border dark:border-dark-border shadow-soft text-xs font-medium text-ink-primary dark:text-dark-ink-primary hover:border-[#D8D2CA] dark:hover:border-dark-border transition-colors focus-visible:outline-2"
        >
          <div className="flex items-center gap-2 truncate">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">NVIDIA × Nebius</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-ink-muted dark:text-dark-ink-muted shrink-0 ml-1.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto space-y-5 pr-1">
        {/* Workspace section */}
        <div>
          <p className="px-2 mb-1.5 text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary uppercase tracking-wider">
            Workspace
          </p>
          <nav className="space-y-0.5" aria-label="Workspace navigation">
            <NavLink to="/" end className={navLinkClass}>
              <Wrench className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>New Repair</span>
            </NavLink>

            <div>
              <NavLink to="/jobs" className={navLinkClass}>
                <Inbox className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span>Jobs</span>
              </NavLink>

              {/* Nested Sub-Items with Indent Line */}
              <div className="relative pl-6 mt-1 space-y-0.5 text-xs">
                <div className="absolute left-3.5 top-1 bottom-2 w-px bg-warm-border dark:bg-dark-border" />

                <NavLink to="/jobs?filter=all" className={() => subNavLinkClass('all')}>
                  <span className="text-ink-secondary dark:text-dark-ink-secondary select-none">└─</span>
                  <span>All Jobs</span>
                </NavLink>

                <NavLink to="/jobs?filter=verified" className={() => subNavLinkClass('verified')}>
                  <span className="text-ink-secondary dark:text-dark-ink-secondary select-none">└─</span>
                  <CheckCircle2 className="h-3 w-3 text-[#1E6B3C] dark:text-emerald-400 shrink-0" strokeWidth={1.5} />
                  <span>Verified</span>
                </NavLink>

                <NavLink to="/jobs?filter=running" className={() => subNavLinkClass('running')}>
                  <span className="text-ink-secondary dark:text-dark-ink-secondary select-none">└─</span>
                  <AlertCircle className="h-3 w-3 text-[#27618D] dark:text-sky-400 shrink-0" strokeWidth={1.5} />
                  <span>Running</span>
                </NavLink>

                <NavLink to="/jobs?filter=failed" className={() => subNavLinkClass('failed')}>
                  <span className="text-ink-secondary dark:text-dark-ink-secondary select-none">└─</span>
                  <XCircle className="h-3 w-3 text-[#9C2A2A] dark:text-red-400 shrink-0" strokeWidth={1.5} />
                  <span>Failed</span>
                </NavLink>
              </div>
            </div>
          </nav>
        </div>

        {/* Insight section */}
        <div>
          <p className="px-2 mb-1.5 text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary uppercase tracking-wider">
            Insight
          </p>
          <nav className="space-y-0.5" aria-label="Insight navigation">
            <NavLink
              to={currentJobId ? `/jobs/${currentJobId}/result` : '/jobs'}
              className={navLinkClass}
            >
              <FileCheck className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>Evidence & Result</span>
            </NavLink>

            <NavLink to="/models" className={navLinkClass}>
              <Cpu className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>Models & Roles</span>
            </NavLink>
          </nav>
        </div>

        {/* Info section */}
        <div>
          <p className="px-2 mb-1.5 text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary uppercase tracking-wider">
            Info
          </p>
          <nav className="space-y-0.5" aria-label="Information navigation">
            <NavLink to="/security" className={navLinkClass}>
              <Shield className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>Security Boundaries</span>
            </NavLink>

            <NavLink to="/about" className={navLinkClass}>
              <Info className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>About ProofPatch</span>
            </NavLink>
          </nav>
        </div>
      </div>

      {/* Footer / System Status */}
      <div className="pt-3 border-t border-warm-border dark:border-dark-border mt-auto px-1">
        <div className="flex items-center justify-between text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Backend Active
          </span>
          <span className="font-mono text-[10px]">v1.0.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-warm-bg dark:bg-dark-bg border-b border-warm-border dark:border-dark-border sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-ink-primary dark:bg-dark-surface border dark:border-dark-border flex items-center justify-center text-warm-bg dark:text-amber-400">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
          </div>
          <span className="font-semibold text-sm text-ink-primary dark:text-dark-ink-primary">
            ProofPatch
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            ref={menuButtonRef}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation-drawer"
            className="p-1.5 rounded-lg border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-ink-primary dark:text-dark-ink-primary focus-visible:outline-2"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          id="mobile-navigation-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex animate-in fade-in duration-150"
        >
          <div
            ref={drawerRef}
            className="bg-warm-bg dark:bg-dark-bg w-[260px] h-full shadow-elevated border-r border-warm-border dark:border-dark-border animate-in slide-in-from-left duration-200"
          >
            {content}
          </div>
          <div
            className="flex-1"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 bg-warm-bg dark:bg-dark-bg border-r border-warm-border/60 dark:border-dark-border/60 min-h-screen sticky top-0 h-screen overflow-hidden">
        {content}
      </aside>
    </>
  );
}
