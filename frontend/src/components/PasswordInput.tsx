import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function PasswordInput({
  label,
  error,
  id = 'password-input',
  className = '',
  ...props
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary dark:text-dark-ink-secondary"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          {...props}
          id={id}
          type={showPassword ? 'text' : 'password'}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full rounded-xl border border-warm-border dark:border-dark-border bg-white dark:bg-dark-surface px-3.5 py-2 pr-10 text-xs text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted/70 dark:placeholder:text-dark-ink-muted/70 focus:border-ink-primary dark:focus:border-dark-ink-primary focus:ring-1 focus:ring-ink-primary dark:focus:ring-dark-ink-primary transition-colors shadow-soft ${
            error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''
          } ${className}`}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-muted dark:text-dark-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary transition-colors focus-visible:outline-2"
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

