import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { en } from './en.ts'
import { es, type MessageKey } from './es.ts'

export type Locale = 'es' | 'en'
export type { MessageKey }
export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string

const CATALOGUES: Record<Locale, Record<MessageKey, string>> = { es, en }
const STORAGE_KEY = 'rutalibre-locale'

/** Fills {name} placeholders. A missing value stays visible as {name} rather than vanishing. */
export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

export function translator(locale: Locale): Translate {
  return (key, values) => format(CATALOGUES[locale][key], values)
}

/** Spanish unless the person chose English before, or their browser prefers it. */
export function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'es' || saved === 'en') return saved
  } catch {
    // Storage can be blocked (private mode); fall through to the browser language.
  }
  return typeof navigator !== 'undefined' && navigator.language.startsWith('en') ? 'en' : 'es'
}

interface I18n {
  locale: Locale
  t: Translate
  setLocale: (locale: Locale) => void
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({
  children,
  locale: fixed,
}: {
  children: ReactNode
  locale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(fixed ?? initialLocale)
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    document.documentElement.lang = next === 'es' ? 'es-CL' : 'en'
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not remembering the choice is fine.
    }
  }, [])
  const value = useMemo(() => ({ locale, t: translator(locale), setLocale }), [locale, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}
