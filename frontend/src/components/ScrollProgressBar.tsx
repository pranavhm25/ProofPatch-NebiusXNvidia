import { useEffect, useRef } from 'react';

export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) return;

      rafId.current = window.requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight =
          document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const progress = scrollHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollHeight)) : 0;

        if (barRef.current) {
          barRef.current.style.transform = `scaleX(${progress})`;
        }
        rafId.current = null;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) {
        window.cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 h-[3px] bg-transparent z-50 pointer-events-none"
    >
      <div
        ref={barRef}
        className="h-full w-full bg-ink-primary dark:bg-amber-500 origin-left will-change-transform"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
}

