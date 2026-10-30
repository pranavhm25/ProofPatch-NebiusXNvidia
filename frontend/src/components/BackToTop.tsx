import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface BackToTopProps {
  threshold?: number;
  className?: string;
}

export function BackToTop({ threshold = 300, className = '' }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setVisible(scrollY > threshold);
    };

    window.addEventListener('scroll', checkScroll, { passive: true });
    checkScroll();

    return () => window.removeEventListener('scroll', checkScroll);
  }, [threshold]);

  const scrollToTop = () => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top of page"
      title="Back to top"
      className={`fixed bottom-6 right-6 z-30 p-2.5 rounded-full border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-ink-primary dark:text-dark-ink-primary hover:bg-[#FAF8F5] dark:hover:bg-dark-pill shadow-elevated transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 ${className}`}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}

