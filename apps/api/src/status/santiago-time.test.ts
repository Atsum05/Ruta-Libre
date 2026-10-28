import { describe, expect, it } from 'vitest'
import { parseSantiagoTime } from './santiago-time.ts'

describe('parseSantiagoTime', () => {
  it('uses summer time (UTC−3) in October', () => {
    expect(parseSantiagoTime('2026-10-16 20:21:16')).toBe(Date.parse('2026-10-16T23:21:16Z'))
  })

  it('uses winter time (UTC−4) in July', () => {
    expect(parseSantiagoTime('2026-07-01 12:00:00')).toBe(Date.parse('2026-07-01T16:00:00Z'))
  })

  it.each(['2026-10-16T20:21:16', '16/10/2026 20:21', '', 'yesterday'])('rejects %j', (text) => {
    expect(parseSantiagoTime(text)).toBeNull()
  })
})
