export {
  type Candidate,
  type CandidateSource,
  chooseRoute,
  hasAccessibleRoute,
  type Plan,
} from './choose.ts'
export { DEFAULT_MAX_SNAPSHOT_AGE_MS, type EvaluateOptions, evaluateRoute } from './evaluate.ts'
export { distanceMeters, type LatLng } from './geo.ts'
export { DeviceId, StationId } from './ids.ts'
export { MATCH_RADIUS_M, type MatchOptions, matchStop, resolveTerminal } from './match.ts'
export { type Headsign, normalizeName, parseHeadsign } from './names.ts'
export type { Device, DeviceKind, DeviceScope, Line, Registry, Station } from './registry.ts'
export type { Leg, Route, TransitLeg, TransitMode, TransitStop, WalkLeg } from './route.ts'
export type { DeviceState, StatusSnapshot } from './status.ts'
export {
  combineFindings,
  type Finding,
  type PlatformRelation,
  type Reason,
  VERDICT_KINDS,
  type Verdict,
  type VerdictKind,
} from './verdict.ts'
export { adjustedDurationSeconds, adjustWalkingTime, WALKING_FACTOR } from './walking.ts'
