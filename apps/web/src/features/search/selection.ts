import type { Waypoint } from '@rutalibre/contract'

/** A chosen origin or destination, with the text shown in its field. */
export interface Selection {
  readonly waypoint: Waypoint
  readonly label: string
}

/** A new autocomplete session token. One per search; renewed after each pick (billing). */
export const newSession = (): string => crypto.randomUUID()
