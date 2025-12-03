import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';
import LanguageDetector from 'i18next-browser-languagedetector';
import { supportedLanguages } from './languages';

// Import locale files
import no from './locales/no.json';
import en from './locales/en.json';
import pl from './locales/pl.json';
import uk from './locales/uk.json';

const resources = {
  no: { translation: no },
  en: { translation: en },
  pl: { translation: pl },
  uk: { translation: uk },
};

// Get supported language codes
const supportedLanguageCodes = supportedLanguages.map(lang => lang.code);

// Set default language to Norwegian if not already set (kun for web)
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  if (!localStorage.getItem('i18nextLng')) {
    localStorage.setItem('i18nextLng', 'no');
  }
}

// Konfigurer detection basert på plattform
const isWeb = Platform.OS === 'web';
const detectionConfig = isWeb ? {
  // For web: bruk localStorage og navigator
  order: ['localStorage', 'navigator', 'htmlTag'],
  lookupLocalStorage: 'i18nextLng',
  caches: ['localStorage'],
  checkWhitelist: true,
  convertDetectedLanguage: (lng) => {
    // If user has explicitly chosen a language, use it
    const savedLang = typeof window !== 'undefined' && window.localStorage 
      ? localStorage.getItem('i18nextLng') 
      : null;
    if (savedLang) {
      return savedLang;
    }
    
    // If browser language is English, default to Norwegian (unless user explicitly chose English)
    if (lng && lng.startsWith('en')) {
      return 'no';
    }
    
    // Map common browser languages to supported languages
    if (lng && lng.startsWith('no')) return 'no';
    if (lng && lng.startsWith('pl')) return 'pl';
    if (lng && lng.startsWith('uk')) return 'uk';
    
    // Default to Norwegian
    return 'no';
  },
} : {
  // For native: kun bruk navigator (ikke localStorage)
  order: ['navigator'],
  checkWhitelist: true,
  convertDetectedLanguage: (lng) => {
    // If browser language is English, default to Norwegian
    if (lng && lng.startsWith('en')) {
      return 'no';
    }
    
    // Map common browser languages to supported languages
    if (lng && lng.startsWith('no')) return 'no';
    if (lng && lng.startsWith('pl')) return 'pl';
    if (lng && lng.startsWith('uk')) return 'uk';
    
    // Default to Norwegian
    return 'no';
  },
};

// Get initial language
const getInitialLanguage = () => {
  if (isWeb && typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('i18nextLng') || 'no';
  }
  return 'no';
};

// Kun bruk LanguageDetector på web (den prøver å bruke localStorage på native)
if (isWeb) {
  i18n.use(LanguageDetector);
}

i18n
  // Detect user language from:
  // Web: localStorage (if user has manually selected a language), then browser/device language
  // Native: Device language settings only
  // Fallback to 'no' (Norwegian)
  .use(initReactI18next)
  .init({
    resources,
    lng: getInitialLanguage(),
    fallbackLng: 'no', // Default language if detection fails
    supportedLngs: supportedLanguageCodes, // Only allow supported languages
    
    // Language detection options (kun for web)
    ...(isWeb ? { detection: detectionConfig } : {}),
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    // React-specific options
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    },
    
    // Debug mode (set to false in production)
    debug: false, // Set to true for development to see translation keys
  });

export default i18n;
