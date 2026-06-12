import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface PreferencesContextType {
  language: Language;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('talaat_lang');
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  });



  // Apply language side effects (RTL vs LTR)
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('talaat_lang', language);
  }, [language]);



  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'ar' ? 'en' : 'ar'));
  };



  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
  };

  return (
    <PreferencesContext.Provider
      value={{
        language,
        toggleLanguage,
        setLanguage,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferencesProvider');
  }
  return context;
};
