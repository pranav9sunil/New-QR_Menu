import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/i18n/translations';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const flags: Record<Language, { emoji: string; label: string }> = {
    en: { emoji: '🇬🇧', label: 'English' },
    es: { emoji: '🇪🇸', label: 'Español' },
};

export default function LanguageSelector() {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-sm font-medium"
            >
                <span className="text-xl">{flags[language].emoji}</span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close on click outside */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border shadow-lg z-50 py-1 min-w-[140px]">
                        {(Object.keys(flags) as Language[]).map((lang) => (
                            <button
                                key={lang}
                                onClick={() => {
                                    setLanguage(lang);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${language === lang ? 'bg-orange-50 text-orange-600' : ''
                                    }`}
                            >
                                <span className="text-xl">{flags[lang].emoji}</span>
                                <span>{flags[lang].label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
