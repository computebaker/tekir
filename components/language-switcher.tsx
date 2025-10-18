/**
 * Language Switcher Component
 * 
 * Provides a UI for users to select their preferred language.
 * Updates user settings in Convex + localStorage for persistence.
 * Supports real-time language switching without page reload.
 * 
 * @see /.github/instructions/i18n.instructions.md
 */

'use client';

import { useSettings } from '@/lib/settings';
import { locales, localeMetadata, defaultLocale } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'default' | 'minimal';
  className?: string;
}

export default function LanguageSwitcher({ 
  variant = 'default',
  className = '' 
}: LanguageSwitcherProps) {
  const { settings, updateSetting } = useSettings();
  const currentLanguage = (settings.language as Locale) || defaultLocale;

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = event.target.value;
    updateSetting('language', newLanguage);
  };

  if (variant === 'minimal') {
    return (
      <select
        value={currentLanguage}
        onChange={handleLanguageChange}
        className={`bg-transparent border-0 text-sm cursor-pointer hover:text-primary transition-colors ${className}`}
        aria-label="Language"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeMetadata[locale].flag}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      <select
        value={currentLanguage}
        onChange={handleLanguageChange}
        className="px-3 py-2 border border-border rounded-md bg-background text-foreground cursor-pointer hover:border-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="Language"
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeMetadata[locale].flag} {localeMetadata[locale].nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
