// The live feed writes local Santiago wall-clock times ("2026-10-16 20:21:16") with no offset.
// Chile changes its offset with daylight saving, so convert through the IANA zone, not a constant.

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Santiago',
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

/** Santiago's offset from UTC at an instant, in milliseconds (e.g. −3 h in summer). */
function offsetMs(epoch: number): number {
  const p = Object.fromEntries(PARTS.formatToParts(epoch).map((x) => [x.type, Number(x.value)]))
  const wall = Date.UTC(
    p['year'] ?? 0,
    (p['month'] ?? 1) - 1,
    p['day'] ?? 1,
    p['hour'] ?? 0,
    p['minute'] ?? 0,
    p['second'] ?? 0,
  )
  return wall - epoch
}

const FORMAT = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

/** Parses "YYYY-MM-DD HH:mm:ss" in Santiago time to epoch milliseconds, or null if malformed. */
export function parseSantiagoTime(text: string): number | null {
  const m = FORMAT.exec(text)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m.map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  const wall = Date.UTC(y, mo - 1, d, h, mi, s)
  if (Number.isNaN(wall)) return null
  // Two passes: the offset at the guessed instant can differ near a daylight-saving change.
  const guess = wall - offsetMs(wall)
  return wall - offsetMs(guess)
}
