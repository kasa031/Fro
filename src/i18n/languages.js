// Sentral språkliste - legg til nye språk her
export const supportedLanguages = [
  {
    code: 'no',
    name: 'Norsk',
    flag: '🇳🇴',
    nativeName: 'Norsk'
  },
  {
    code: 'en',
    name: 'English',
    flag: '🇬🇧',
    nativeName: 'English'
  },
  {
    code: 'pl',
    name: 'Polski',
    flag: '🇵🇱',
    nativeName: 'Polski'
  },
  {
    code: 'uk',
    name: 'Ukrainian',
    flag: '🇺🇦',
    nativeName: 'Українська'
  },
  // Legg til flere språk her når oversettelsesfiler er klare:
  // {
  //   code: 'de',
  //   name: 'Deutsch',
  //   flag: '🇩🇪',
  //   nativeName: 'Deutsch'
  // },
  // {
  //   code: 'es',
  //   name: 'Español',
  //   flag: '🇪🇸',
  //   nativeName: 'Español'
  // },
  // {
  //   code: 'fr',
  //   name: 'Français',
  //   flag: '🇫🇷',
  //   nativeName: 'Français'
  // },
  // {
  //   code: 'sv',
  //   name: 'Svenska',
  //   flag: '🇸🇪',
  //   nativeName: 'Svenska'
  // },
  // {
  //   code: 'da',
  //   name: 'Dansk',
  //   flag: '🇩🇰',
  //   nativeName: 'Dansk'
  // },
  // {
  //   code: 'ar',
  //   name: 'العربية',
  //   flag: '🇸🇦',
  //   nativeName: 'العربية'
  // },
  // {
  //   code: 'ur',
  //   name: 'اردو',
  //   flag: '🇵🇰',
  //   nativeName: 'اردو'
  // },
  // {
  //   code: 'so',
  //   name: 'Soomaali',
  //   flag: '🇸🇴',
  //   nativeName: 'Soomaali'
  // },
  // {
  //   code: 'ti',
  //   name: 'ትግርኛ',
  //   flag: '🇪🇷',
  //   nativeName: 'ትግርኛ'
  // },
];

// Hjelpefunksjon for å hente språkinfo
export const getLanguageInfo = (code) => {
  return supportedLanguages.find(lang => lang.code === code) || supportedLanguages[0];
};

// Hjelpefunksjon for å sjekke om et språk er støttet
export const isLanguageSupported = (code) => {
  return supportedLanguages.some(lang => lang.code === code);
};

