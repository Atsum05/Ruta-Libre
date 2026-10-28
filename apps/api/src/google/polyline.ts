/**
 * Decodes Google's encoded polyline format into [lng, lat] pairs (GeoJSON order). Hand-written
 * (~20 lines) rather than a dependency; ported from the prototype, now with tests.
 */
export function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0

  const next = (): number | null => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      if (index >= encoded.length) return null
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    const dLat = next()
    const dLng = next()
    // A truncated string ends the path rather than inventing a point.
    if (dLat === null || dLng === null) break
    lat += dLat
    lng += dLng
    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}
