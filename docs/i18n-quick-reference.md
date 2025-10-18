# Tekir i18n Quick Reference

## Quick Start for Developers

### 1. Using translations in components

```typescript
'use client';

import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations();
  
  return (
    <div>
      <h1>{t('search.placeholder')}</h1>
      <p>{t('search.noResults', { query: 'example' })}</p>
    </div>
  );
}
```

### 2. Using scoped translations

```typescript
'use client';

import { useTranslations } from 'next-intl';

export default function MyComponent() {
  // Scope to specific namespace
  const t = useTranslations('search.tabs');
  
  return (
    <div>
      <button>{t('web')}</button>
      <button>{t('images')}</button>
    </div>
  );
}
```

### 3. Adding new translations

**Step 1:** Add to `/messages/en.json`
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is my new feature"
  }
}
```

**Step 2:** Add Turkish translation to `/messages/tr.json`
```json
{
  "myFeature": {
    "title": "Özelliğim",
    "description": "Bu benim yeni özelliğim"
  }
}
```

**Step 3:** Use in component
```typescript
const t = useTranslations('myFeature');
return <h1>{t('title')}</h1>;
```

### 4. Adding Language Switcher to UI

```typescript
import LanguageSwitcher from '@/components/language-switcher';

export default function MyPage() {
  return (
    <div>
      {/* Default variant with icon and full names */}
      <LanguageSwitcher />
      
      {/* Minimal variant with flags only */}
      <LanguageSwitcher variant="minimal" />
    </div>
  );
}
```

### 5. Adding a new language

**Step 1:** Update `/lib/i18n.ts`
```typescript
export const locales = ['en', 'tr', 'fr', 'de', 'es', 'ar'] as const; // Add 'ar'

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  // ... existing locales
  ar: { name: 'Arabic', flag: '🇸🇦', nativeName: 'العربية' },
};
```

**Step 2:** Create `/messages/ar.json`
```json
{
  "common": {
    "loading": "جار التحميل...",
    "error": "حدث خطأ"
  }
  // ... translate all keys
}
```

### 6. Checking current language

```typescript
'use client';

import { useSettings } from '@/lib/settings';
import { defaultLocale } from '@/lib/i18n';

export default function MyComponent() {
  const { settings } = useSettings();
  const currentLanguage = settings.language || defaultLocale;
  
  console.log('Current language:', currentLanguage);
  
  return <div>Language: {currentLanguage}</div>;
}
```

### 7. Dynamic values in translations

```typescript
// In translation file
{
  "welcome": "Welcome, {name}!",
  "itemsCount": "You have {count} items"
}

// In component
const t = useTranslations();
<p>{t('welcome', { name: 'John' })}</p>
<p>{t('itemsCount', { count: 5 })}</p>
```

### 8. Pluralization

```typescript
// In translation file
{
  "resultsCount": "{count, plural, one {# result} other {# results}}"
}

// In component
const t = useTranslations();
<p>{t('resultsCount', { count: 1 })}</p>  // "1 result"
<p>{t('resultsCount', { count: 5 })}</p>  // "5 results"
```

## Translation File Structure

```
messages/
├── en.json       # English (default)
├── tr.json       # Turkish
├── fr.json       # French
├── de.json       # German
└── es.json       # Spanish
```

## Available Namespaces

- `common` - Common UI strings (loading, error, buttons)
- `search` - Search-related strings
- `navigation` - Navigation links
- `settings` - Settings page strings
- `auth` - Authentication forms
- `wikipedia` - Wikipedia integration
- `images` - Image search
- `videos` - Video search
- `news` - News search
- `ai` - AI/Karakulak features
- `feedback` - User feedback
- `errors` - Error messages
- `footer` - Footer content

## Best Practices

1. **Always use scoped translations** when possible
   ```typescript
   ✅ const t = useTranslations('search');
   ❌ const t = useTranslations();
   ```

2. **Group related translations** under clear namespaces
   ```json
   ✅ { "search": { "tabs": { "web": "Search" } } }
   ❌ { "searchTabWeb": "Search" }
   ```

3. **Use descriptive keys** that indicate context
   ```json
   ✅ "noResultsFound": "No results found"
   ❌ "noResults": "No results found"
   ```

4. **Provide context in comments** for translators
   ```json
   {
     // Displayed when search returns empty results
     "noResultsFound": "No results found for \"{query}\""
   }
   ```

5. **Test language switching** locally before committing
   - Change language in settings
   - Verify all strings update
   - Check for missing translations

## Common Issues

### Issue: Translations not loading

**Solution:** Ensure component is wrapped in `I18nProvider`
```typescript
// In app/layout.tsx or ClientLayout
<I18nProvider>
  {children}
</I18nProvider>
```

### Issue: useTranslations hook error

**Solution:** Add `'use client'` directive
```typescript
'use client';

import { useTranslations } from 'next-intl';
```

### Issue: Language not persisting

**Solution:** Verify settings are syncing
```typescript
const { settings, updateSetting } = useSettings();
updateSetting('language', 'tr');
```

## Development Workflow

1. **Add English translation** (source)
2. **Add other language translations**
3. **Use in component** with `useTranslations()`
4. **Test in browser** by switching languages
5. **Commit** with descriptive message
6. **Crowdin sync** (automatic for production)

## Support

- See full documentation: `.github/instructions/i18n.instructions.md`
- Configuration: `/lib/i18n.ts`
- Provider: `/components/i18n-provider.tsx`
- Language Switcher: `/components/language-switcher.tsx`
