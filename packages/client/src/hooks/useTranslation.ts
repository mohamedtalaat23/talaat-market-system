import { useCallback } from 'react';
import { usePreferences } from '../contexts/preferencesContext';
import { translations } from '../utils/translations';

export function useTranslation() {
  const { language } = usePreferences();

  // Memoised on `language` so consumers can safely list `t` in effect /
  // useCallback dependency arrays. A fresh function per render would restart
  // every effect that depends on it (and can loop when the effect sets state).
  const t = useCallback(
    (key: string): string => {
      const parts = key.split('.');
      let result: any = translations[language as 'en' | 'ar'];

      for (const part of parts) {
        if (result && part in result) {
          result = result[part];
        } else {
          return key; // Fallback to key if not found
        }
      }

      return typeof result === 'string' ? result : key;
    },
    [language],
  );

  return { t, language };
}
