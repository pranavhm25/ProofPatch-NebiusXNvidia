export interface PillTabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number;
}

interface PillTabsProps<T extends string = string> {
  tabs: PillTabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
}

export function PillTabs<T extends string = string>({ tabs, activeTab, onChange }: PillTabsProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-warm-pill dark:bg-dark-pill rounded-full border border-warm-border/60 dark:border-dark-border/60 max-w-fit">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-2 ${
              isActive
                ? 'bg-white dark:bg-dark-surface text-ink-primary dark:text-dark-ink-primary shadow-soft border border-warm-border dark:border-dark-border font-semibold'
                : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-white/50 dark:hover:bg-dark-muted/50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-warm-pill dark:bg-dark-pill text-ink-primary dark:text-dark-ink-primary'
                    : 'bg-warm-border dark:bg-dark-border text-ink-secondary dark:text-dark-ink-secondary'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
