import { useState, useEffect } from 'react';

export interface UtmParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

const STORAGE_KEY = 'proofpatch_utm';

export function useUtmParams(): UtmParams {
  const [utm, setUtm] = useState<UtmParams>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const searchParams = new URLSearchParams(window.location.search);
      const detected: UtmParams = {};
      const keys: (keyof UtmParams)[] = [
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'utm_term',
        'utm_content',
      ];

      let found = false;
      keys.forEach((key) => {
        const val = searchParams.get(key);
        if (val) {
          detected[key] = val;
          found = true;
        }
      });

      if (found) {
        setUtm((prev) => {
          const merged = { ...prev, ...detected };
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch {
            // Storage quota
          }
          return merged;
        });
      }
    } catch {
      // Ignore URL parsing errors
    }
  }, []);

  return utm;
}

