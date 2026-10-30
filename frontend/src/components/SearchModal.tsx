import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Wrench, Inbox, Cpu, Shield, Info, ArrowRight, CornerDownLeft, X, Sparkles } from 'lucide-react';

export interface SearchEntry {
  id: string;
  title: string;
  description: string;
  category: 'Navigation' | 'Models' | 'Security & Docs';
  path: string;
  icon: React.ElementType;
}

const SEARCH_DATABASE: SearchEntry[] = [
  {
    id: 'nav-new-repair',
    title: 'New Repair',
    description: 'Upload Python repository ZIP and initiate automated patch generation.',
    category: 'Navigation',
    path: '/',
    icon: Wrench,
  },
  {
    id: 'nav-jobs',
    title: 'Repair Jobs History',
    description: 'Inspect past repair jobs, verdicts, durations, and attempt counts.',
    category: 'Navigation',
    path: '/jobs',
    icon: Inbox,
  },
  {
    id: 'nav-models',
    title: 'Models & Role Architecture',
    description: 'Nebius Token Factory dispatching: FAST, REASONING, and ADVANCED tiers.',
    category: 'Navigation',
    path: '/models',
    icon: Cpu,
  },
  {
    id: 'nav-security',
    title: 'Security & Sandbox Boundaries',
    description: 'Environment variable scrubbing, isolated subprocesses, 60-min retention.',
    category: 'Navigation',
    path: '/security',
    icon: Shield,
  },
  {
    id: 'nav-about',
    title: 'About ProofPatch',
    description: 'Verification-first philosophy: Evidence over assertion.',
    category: 'Navigation',
    path: '/about',
    icon: Info,
  },
  {
    id: 'model-nemotron-fast',
    title: 'nvidia/Nemotron-3_5-Lightning',
    description: 'FAST role: Context extraction and initial test plan formulation.',
    category: 'Models',
    path: '/models',
    icon: Sparkles,
  },
  {
    id: 'model-nemotron-ultra',
    title: 'nvidia/Nemotron-3-Ultra-550b-a55b',
    description: 'REASONING role: 95.7% benchmarked hunk precision for unified diffs.',
    category: 'Models',
    path: '/models',
    icon: Sparkles,
  },
  {
    id: 'model-glm-flash',
    title: 'zai-org/GLM-5.3-Flash',
    description: 'REASONING role: 97.1% success rate on multi-file Python repairs.',
    category: 'Models',
    path: '/models',
    icon: Sparkles,
  },
  {
    id: 'doc-retention',
    title: '60-Minute Retention Policy',
    description: 'Uploaded archives and generated artifacts are purged automatically.',
    category: 'Security & Docs',
    path: '/security',
    icon: Shield,
  },
  {
    id: 'doc-env-scrub',
    title: 'Environment Variable Scrubbing',
    description: 'NEBIUS, OPENAI, and TOKEN secrets are scrubbed before sandbox test execution.',
    category: 'Security & Docs',
    path: '/security',
    icon: Shield,
  },
];

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SEARCH_DATABASE;
    return SEARCH_DATABASE.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredEntries.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? Math.max(0, filteredEntries.length - 1) : prev - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredEntries[selectedIndex];
        if (selected) {
          navigate(selected.path);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredEntries, selectedIndex, navigate, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site Search"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-3xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface shadow-elevated overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-warm-border dark:border-dark-border">
          <Search className="h-4 w-4 text-ink-muted dark:text-dark-ink-muted shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, models, security controls… (Press Esc to close)"
            aria-label="Search site content"
            className="flex-1 bg-transparent text-xs text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted/70 dark:placeholder:text-dark-ink-muted/70 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-ink-muted dark:text-dark-ink-muted bg-warm-pill dark:bg-dark-pill rounded border border-warm-border/60 dark:border-dark-border/60">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Search suggestions"
          className="max-h-80 overflow-y-auto divide-y divide-warm-border-subtle dark:divide-dark-border-subtle p-2"
        >
          {filteredEntries.length === 0 ? (
            <li className="py-8 text-center text-xs text-ink-muted dark:text-dark-ink-muted">
              No results found for &ldquo;{query}&rdquo;
            </li>
          ) : (
            filteredEntries.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    navigate(item.path);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary'
                      : 'hover:bg-[#FAF8F5] dark:hover:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl border border-warm-border dark:border-dark-border shrink-0 ${
                        isSelected
                          ? 'bg-white dark:bg-dark-surface shadow-xs text-ink-primary dark:text-dark-ink-primary'
                          : 'bg-white/60 dark:bg-dark-card/60 text-ink-muted dark:text-dark-ink-muted'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-ink-primary dark:text-dark-ink-primary truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-warm-pill dark:bg-dark-muted text-ink-muted dark:text-dark-ink-muted border border-warm-border/60 dark:border-dark-border/60 shrink-0">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary truncate mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-ink-muted dark:text-dark-ink-muted">
                    {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-ink-primary dark:text-dark-ink-primary" />}
                    <ArrowRight className="h-3.5 w-3.5 opacity-60" />
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#FAF8F5] dark:bg-dark-card border-t border-warm-border dark:border-dark-border text-[11px] text-ink-muted dark:text-dark-ink-muted">
          <span>Navigate with &uarr; &darr;</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
}

