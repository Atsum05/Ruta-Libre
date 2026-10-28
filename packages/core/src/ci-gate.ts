// Deliberate violation to prove CI blocks it (roadmap phase 1 "done when").
// This PR must never be merged.
import { readFileSync } from 'node:fs'

export const readsFiles = readFileSync
