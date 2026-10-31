import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initialLocale, useI18n } from './index.tsx'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('initialLocale', () => {
  it('defaults to Spanish', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-CL')
    expect(initialLocale()).toBe('es')
  })

  it('follows a browser set to English', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB')
    expect(initialLocale()).toBe('en')
  })

  it('prefers the choice the person made before', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    localStorage.setItem('rutalibre-locale', 'es')
    expect(initialLocale()).toBe('es')
  })

  it('ignores a corrupted saved value', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('es-CL')
    localStorage.setItem('rutalibre-locale', 'fr')
    expect(initialLocale()).toBe('es')
  })

  it('still works when storage is blocked (private mode)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
    expect(initialLocale()).toBe('en')
  })
})

function Orphan() {
  useI18n()
  return null
}

describe('useI18n', () => {
  it('fails loudly outside the provider instead of rendering untranslated keys', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Orphan />)).toThrow('useI18n must be used inside <I18nProvider>')
  })
})
