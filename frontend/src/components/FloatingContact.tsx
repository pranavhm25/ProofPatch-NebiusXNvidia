import { MessageSquare } from 'lucide-react';

interface FloatingContactProps {
  email?: string;
  className?: string;
}

export function FloatingContact({
  email = 'support@proofpatch.io',
  className = '',
}: FloatingContactProps) {
  return (
    <a
      href={`mailto:${email}?subject=ProofPatch%20Repair%20Inquiry`}
      aria-label="Contact Support via email"
      title="Contact Support"
      className={`fixed bottom-20 right-6 z-30 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface text-xs font-semibold text-ink-primary dark:text-dark-ink-primary hover:bg-[#FAF8F5] dark:hover:bg-dark-pill shadow-elevated transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-2 ${className}`}
    >
      <MessageSquare className="h-4 w-4 text-[#27618D] dark:text-sky-400 shrink-0" strokeWidth={1.5} />
      <span className="hidden sm:inline">Contact</span>
    </a>
  );
}

