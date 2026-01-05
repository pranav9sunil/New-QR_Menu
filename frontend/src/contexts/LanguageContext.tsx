import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { translations } from '@/i18n/translations';
import type { Language } from '@/i18n/translations';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
    getLocalizedText: (item: { name: string; translations?: { es?: { name?: string; description?: string } } }, field: 'name' | 'description') => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'preferred_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'en' || saved === 'es') return saved;
        }
        return 'en';
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, language);
    }, [language]);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
    };

    // Translate static UI text
    const t = (key: string): string => {
        return translations[language][key] || translations['en'][key] || key;
    };

    // Get localized text from menu items (with fallback to English/default)
    const getLocalizedText = (
        item: { name: string; description?: string; translations?: { es?: { name?: string; description?: string } } },
        field: 'name' | 'description'
    ): string => {
        if (language === 'es' && item.translations?.es?.[field]) {
            return item.translations.es[field]!;
        }
        // Fallback to default (English) value
        return field === 'name' ? item.name : (item.description || '');
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, getLocalizedText }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
