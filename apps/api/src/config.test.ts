import { describe, expect, it } from 'vitest'
import { ConfigError, parseConfig } from './config.ts'

describe('parseConfig', () => {
  it('uses safe local defaults when nothing is set', () => {
    expect(parseConfig({})).toEqual({ port: 8787, env: 'local', commit: 'unknown' })
  })

  it('reads the port, environment, and commit', () => {
    const config = parseConfig({ PORT: '10000', APP_ENV: 'production', COMMIT_SHA: 'abc1234' })
    expect(config).toEqual({ port: 10_000, env: 'production', commit: 'abc1234' })
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
