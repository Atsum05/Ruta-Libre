import { describe, expect, it } from 'vitest'
// @ts-expect-error: plain JavaScript build script, no type declarations
import { redirectsFor } from './netlify-redirects.mjs'

describe('redirectsFor', () => {
  it('proxies /api/* to the API origin', () => {
    expect(redirectsFor('https://rutalibre-api.onrender.com')).toBe(
      '/api/*  https://rutalibre-api.onrender.com/:splat  200!\n',
    )
  })

  it('accepts a trailing slash', () => {
    expect(redirectsFor('https://api.rutalibre.cl/')).toBe(
      '/api/*  https://api.rutalibre.cl/:splat  200!\n',
    )
  })

  it.each([
    [undefined, /must be a URL/],
    ['', /must be a URL/],
    ['rutalibre-api.onrender.com', /must be a URL/],
    ['http://rutalibre-api.onrender.com', /https/],
    ['https://rutalibre-api.onrender.com/v1', /no path/],
  ])('rejects %j so a bad setting fails the build, not the users', (origin, message) => {
    expect(() => redirectsFor(origin)).toThrow(message)
  })
})
