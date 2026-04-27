/**
 * i18n bootstrap.
 *
 * Single entry point for all translations. Loaded once from `main.tsx`.
 *
 * - Default language: French (the team and the original copy were FR-first).
 * - Detection: localStorage > navigator > 'fr'.
 * - Persistence: localStorage key 'lang'.
 *
 * Adding a string:
 *   1. Add `t('namespace:key')` in the component
 *   2. Add the entry in `locales/fr/<namespace>.json` and `locales/en/<namespace>.json`
 *
 * Adding a namespace: register it in `ns` below and import in `resources`.
 */
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import frCommon from './locales/fr/common.json'
import frHome from './locales/fr/home.json'
import frOverview from './locales/fr/overview.json'
import frPlan from './locales/fr/plan.json'
import frErrors from './locales/fr/errors.json'
import frMarketing from './locales/fr/marketing.json'
import frEditor from './locales/fr/editor.json'

import enCommon from './locales/en/common.json'
import enHome from './locales/en/home.json'
import enOverview from './locales/en/overview.json'
import enPlan from './locales/en/plan.json'
import enErrors from './locales/en/errors.json'
import enMarketing from './locales/en/marketing.json'
import enEditor from './locales/en/editor.json'

export const SUPPORTED_LANGS = ['fr', 'en'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'fr',
    supportedLngs: SUPPORTED_LANGS,
    defaultNS: 'common',
    ns: ['common', 'home', 'overview', 'plan', 'errors', 'marketing', 'editor'],
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'lang',
      caches: ['localStorage'],
    },
    resources: {
      fr: {
        common: frCommon,
        home: frHome,
        overview: frOverview,
        plan: frPlan,
        errors: frErrors,
        marketing: frMarketing,
        editor: frEditor,
      },
      en: {
        common: enCommon,
        home: enHome,
        overview: enOverview,
        plan: enPlan,
        errors: enErrors,
        marketing: enMarketing,
        editor: enEditor,
      },
    },
  })

export default i18n
