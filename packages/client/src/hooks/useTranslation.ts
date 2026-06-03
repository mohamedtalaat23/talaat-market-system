import { usePreferences } from '../contexts/preferencesContext';
import { translations, type TranslationKey } from '../utils/translations';

export function useTranslation() {
  const { language } = usePreferences();

  const t = (key: TranslationKey): string => {
    const parts = key.split('.');
    let result: any = translations[language];

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
