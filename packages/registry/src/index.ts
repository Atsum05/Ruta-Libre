import type { Registry } from '@rutalibre/core'
import stations from '../stations.json' with { type: 'json' }
import { parseStationsFile } from './schema.ts'

export { parseStationsFile } from './schema.ts'

let cached: Registry | undefined

/** The committed station registry, validated against its schema on first use. */
export function loadRegistry(): Registry {
  cached ??= parseStationsFile(stations)
  return cached
}
