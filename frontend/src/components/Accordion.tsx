import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItem {
  id: string;
  question: string;
  answer: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
  defaultExpandedIds?: string[];
  className?: string;
}

export function Accordion({
  items,
  allowMultiple = false,
  defaultExpandedIds = [],
  className = '',
}: AccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(defaultExpandedIds)
  );

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item) => {
        const isExpanded = expandedIds.has(item.id);
        const headerId = `accordion-header-${item.id}`;
        const contentId = `accordion-panel-${item.id}`;

        return (
          <div
            key={item.id}
            className="rounded-2xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface shadow-soft overflow-hidden transition-colors"
          >
            <h3>
              <button
                type="button"
                id={headerId}
                aria-expanded={isExpanded}
                aria-controls={contentId}
                onClick={() => toggle(item.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left text-xs font-semibold text-ink-primary dark:text-dark-ink-primary hover:bg-[#FAF8F5] dark:hover:bg-dark-pill transition-colors focus-visible:outline-2"
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`h-4 w-4 text-ink-muted dark:text-dark-ink-muted transition-transform duration-200 shrink-0 ml-3 ${
                    isExpanded ? 'rotate-180 text-ink-primary dark:text-dark-ink-primary' : ''
                  }`}
                  strokeWidth={1.5}
                />
              </button>
            </h3>

            <div
              id={contentId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isExpanded}
              className={`px-5 pb-4 pt-1 text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed border-t border-warm-border-subtle dark:border-dark-border-subtle ${
                !isExpanded ? 'hidden' : ''
              }`}
            >
              {item.answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}

