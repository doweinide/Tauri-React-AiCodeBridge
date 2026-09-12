import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from '../../locales/zh.json'
import en from '../../locales/en.json'

/** Product supports Chinese (default) and English only. */
const resources = {
  zh: { translation: zh },
  en: { translation: en },
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  fallbackLng: 'zh',
  interpolation: {
    escapeValue: false, // React already escapes
  },
})

// Update document lang on language change
i18n.on('languageChanged', lng => {
  document.documentElement.dir = 'ltr'
  document.documentElement.lang = lng
})

export default i18n

// Export for use in non-React contexts (like menu building)
export { i18n }

/** Supported UI languages (zh default, en). */
export const availableLanguages: string[] = ['zh', 'en']

// Check if a language is RTL — not used for zh/en
export const isRTL = (_lng: string): boolean => false
