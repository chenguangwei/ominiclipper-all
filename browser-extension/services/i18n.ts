/**
 * Internationalization (i18n) Service
 *
 * Handles translations for the browser extension.
 * Supports English (en), Chinese (zh_CN), and Japanese (ja).
 */

// Supported languages
export type SupportedLocale = 'en' | 'zh_CN' | 'ja';

// Default locale
const DEFAULT_LOCALE: SupportedLocale = 'en';

// Locale storage key
const LOCALE_KEY = 'omniclipper_locale';

// Cache for loaded translations
const translationCache: Record<string, Record<string, string>> = {};

// Current locale
let currentLocale: SupportedLocale = DEFAULT_LOCALE;

/**
 * Get the current browser language
 */
function getBrowserLocale(): SupportedLocale {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language.toLowerCase();

    if (lang.startsWith('zh')) {
      return 'zh_CN';
    }
    if (lang.startsWith('ja') || lang.startsWith('jp')) {
      return 'ja';
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Initialize i18n system
 */
export async function initI18n(): Promise<void> {
  // Try to get saved locale from storage
  try {
    const stored = localStorage.getItem(LOCALE_KEY);
    if (stored) {
      currentLocale = stored as SupportedLocale;
    } else {
      // Auto-detect from browser
      currentLocale = getBrowserLocale();
      await setLocale(currentLocale);
    }
  } catch (e) {
    currentLocale = DEFAULT_LOCALE;
  }
}

/**
 * Get current locale
 */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * Set locale and save preference
 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  currentLocale = locale;

  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch (e) {
    console.warn('Failed to save locale preference');
  }
}

/**
 * Load translation file for a locale
 */
async function loadTranslation(locale: SupportedLocale): Promise<Record<string, string>> {
  // Check cache first
  if (translationCache[locale]) {
    return translationCache[locale];
  }

  try {
    // Load from _locales directory
    const response = await fetch(`/_locales/${locale}/messages.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${locale} translations`);
    }

    const messages = await response.json();
    translationCache[locale] = flattenMessages(messages);
    return translationCache[locale];
  } catch (error) {
    console.warn(`Failed to load translations for ${locale}:`, error);
    // Fall back to English
    if (locale !== DEFAULT_LOCALE) {
      return loadTranslation(DEFAULT_LOCALE);
    }
    return {};
  }
}

/**
 * Flatten nested message object to dot notation
 */
function flattenMessages(
  obj: Record<string, any>,
  prefix: string = ''
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null && !value.message) {
        // Recursively flatten nested objects
        Object.assign(result, flattenMessages(value, newKey));
      } else if (typeof value === 'string') {
        result[newKey] = value;
      } else if (value?.message) {
        // Handle { message: "text", description: "..." } format
        result[newKey] = value.message;
      }
    }
  }

  return result;
}

/**
 * Get a translation by key
 */
export async function t(key: string, params?: Record<string, string>): Promise<string> {
  const translations = await loadTranslation(currentLocale);

  let text = translations[key] || translations[`${DEFAULT_LOCALE}.${key}`] || key;

  // Replace placeholders with parameters
  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), value);
    }
  }

  return text;
}

/**
 * Get translation synchronously (uses cached translations)
 */
export function tSync(key: string, params?: Record<string, string>): string {
  const translations = translationCache[currentLocale] || {};
  let text = translations[key] || translations[`${DEFAULT_LOCALE}.${key}`] || key;

  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), value);
    }
  }

  return text;
}

/**
 * Format a date according to current locale
 */
export function formatDate(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;

  if (currentLocale === 'zh_CN') {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return d.toLocaleDateString('en-US');
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (currentLocale === 'zh_CN') {
    if (diffSec < 60) return '刚刚';
    if (diffMin < 60) return `${diffMin} 分钟前`;
    if (diffHour < 24) return `${diffHour} 小时前`;
    if (diffDay < 7) return `${diffDay} 天前`;
    return formatDate(d);
  }

  if (currentLocale === 'ja') {
    if (diffSec < 60) return 'たった今';
    if (diffMin < 60) return `${diffMin} 分前`;
    if (diffHour < 24) return `${diffHour} 時間前`;
    if (diffDay < 7) return `${diffDay} 日前`;
    return formatDate(d);
  }

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  return formatDate(d);
}

/**
 * Get list of available locales
 */
export function getAvailableLocales(): { code: SupportedLocale; name: string }[] {
  return [
    { code: 'en', name: 'English' },
    { code: 'zh_CN', name: '简体中文' },
    { code: 'ja', name: '日本語' }
  ];
}

/**
 * Preload translations for all supported locales
 */
export async function preloadAllTranslations(): Promise<void> {
  const locales = getAvailableLocales();
  await Promise.all(locales.map(l => loadTranslation(l.code)));
}

// Create a hook-like API for React components
export function createI18nHook() {
  return function useI18n() {
    return {
      locale: currentLocale,
      setLocale,
      t: tSync,
      tAsync: t,
      formatDate,
      formatRelativeTime,
      getAvailableLocales
    };
  };
}
