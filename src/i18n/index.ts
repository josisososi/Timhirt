import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import am from './am';
import en from './en';

export type Language = 'en' | 'am';

const deviceLanguage: Language = getLocales()[0]?.languageCode === 'am' ? 'am' : 'en';

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, am: { translation: am } },
  lng: deviceLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
