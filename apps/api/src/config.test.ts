import { describe, expect, it } from 'vitest'
import { ConfigError, parseConfig } from './config.ts'

describe('parseConfig', () => {
  it('uses safe local defaults when nothing is set', () => {
    expect(parseConfig({})).toMatchObject({ port: 8787, env: 'local', commit: 'unknown' })
  })

  it('reads the port, environment, and commit', () => {
    const config = parseConfig({ PORT: '10000', APP_ENV: 'production', COMMIT_SHA: 'abc1234' })
    expect(config).toMatchObject({ port: 10_000, env: 'production', commit: 'abc1234' })
  })

  it("falls back to Render's commit variable", () => {
    expect(parseConfig({ RENDER_GIT_COMMIT: 'def5678' }).commit).toBe('def5678')
  })

  it('prefers COMMIT_SHA over the Render variable', () => {
    expect(parseConfig({ COMMIT_SHA: 'aaa', RENDER_GIT_COMMIT: 'bbb' }).commit).toBe('aaa')
  })

  // Regression: the prototype's BOM-in-the-key bug (docs/PROTOTYPE_LESSONS.md).
  it('rejects a value containing a BOM', () => {
    expect(() => parseConfig({ COMMIT_SHA: '﻿abc1234' })).toThrow(ConfigError)
  })

  it('rejects a value with surrounding whitespace', () => {
    expect(() => parseConfig({ COMMIT_SHA: 'abc1234\n' })).toThrow(ConfigError)
  })

  it.each(['0', '70000', 'eighty', ''])('rejects the port %j', (port) => {
    expect(() => parseConfig({ PORT: port })).toThrow(ConfigError)
  })

  it('rejects an unknown environment name', () => {
    expect(() => parseConfig({ APP_ENV: 'staging' })).toThrow(/APP_ENV/)
  })
})

describe('status settings', () => {
  it('defaults to polling seguimos.cl every 2 minutes with a 13-hour freshness limit', () => {
    expect(parseConfig({}).status).toEqual({
      sourceUrl: 'https://velocidades.seguimos.cl/?metro=1&all=1',
      pollMs: 120_000,
      timeoutMs: 10_000,
      maxAgeMs: 13 * 60 * 60_000,
    })
  })

  it('refuses to poll more often than once a minute (agreed with the maintainer)', () => {
    expect(() => parseConfig({ STATUS_POLL_SECONDS: '30' })).toThrow(/STATUS_POLL_SECONDS/)
  })

  it('rejects a malformed source URL', () => {
    expect(() => parseConfig({ STATUS_SOURCE_URL: 'not a url' })).toThrow(ConfigError)
  })
})
