import { usePreferences } from '../contexts/preferencesContext';
import { translations } from '../utils/translations';

export function useTranslation() {
  const { language } = usePreferences();

  const t = (key: string): string => {
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
  };

  return { t, language };
}
