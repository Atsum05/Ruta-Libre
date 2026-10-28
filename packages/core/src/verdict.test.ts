import { describe, expect, it } from 'vitest'
import { VERDICT_KINDS } from './verdict.ts'

describe('VERDICT_KINDS', () => {
  it('includes an explicit unknown outcome', () => {
    expect(VERDICT_KINDS).toContain('unknown')
  })
})
