declare const brand: unique symbol

// Branded strings: a StationId can't be passed where a DeviceId is expected, even though both
// are plain strings at runtime.
export type StationId = string & { readonly [brand]: 'StationId' }
export type DeviceId = string & { readonly [brand]: 'DeviceId' }

export const StationId = (id: string): StationId => id as StationId
export const DeviceId = (id: string): DeviceId => id as DeviceId
