import { describe, expect, it } from 'vitest'
import pkg from '../package.json' with { type: 'json' }

// Guards ADR 0002: core stays dependency-free so it can run anywhere
// (server, browser, tests) and never pulls I/O in through a library.
describe('@rutalibre/core', () => {
  it('has no runtime dependencies', () => {
    expect(pkg).not.toHaveProperty('dependencies')
    expect(pkg).not.toHaveProperty('peerDependencies')
  })
})
