import { useEffect, useState } from 'react'

/** The sky over the Andes in the header, following the real time of day in Santiago. */
export type Sky = 'dawn' | 'day' | 'dusk' | 'night'
export type Greeting = 'morning' | 'afternoon' | 'evening'

const SKIES: readonly Sky[] = ['dawn', 'day', 'dusk', 'night']

/** Hour (0–23) and month (1–12) in Santiago, whatever the device's own time zone. */
export function santiagoClock(now: Date): { hour: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    month: 'numeric',
    hourCycle: 'h23',
    timeZone: 'America/Santiago',
  }).formatToParts(now)
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { hour: value('hour'), month: value('month') }
}

/**
 * Roughly when the light changes in Santiago: summer evenings (October to March) stay bright
 * until after nine; in winter it's dark soon after six.
 */
export function skyAt(hour: number, month: number): Sky {
  const summer = month >= 10 || month <= 3
  const [dawn, day, dusk, night] = summer ? [6, 9, 19, 22] : [7, 10, 17, 20]
  if (hour >= dawn && hour < day) return 'dawn'
  if (hour >= day && hour < dusk) return 'day'
  if (hour >= dusk && hour < night) return 'dusk'
  return 'night'
}

/** "Buenos días" until noon, "buenas tardes" until eight, then "buenas noches". */
export function greetingAt(hour: number): Greeting {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 20) return 'afternoon'
  return 'evening'
}

/** `?sky=dusk` in the address shows that sky whatever the time: handy to compare them all. */
function skyFromAddress(): Sky | null {
  if (typeof window === 'undefined') return null
  const asked = new URLSearchParams(window.location.search).get('sky')
  return SKIES.find((s) => s === asked) ?? null
}

/** The current sky and greeting, refreshed every few minutes while the page stays open. */
export function useSky(now: () => Date = () => new Date()): { sky: Sky; greeting: Greeting } {
  const read = () => {
    const { hour, month } = santiagoClock(now())
    return { sky: skyFromAddress() ?? skyAt(hour, month), greeting: greetingAt(hour) }
  }
  const [state, setState] = useState(read)
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once a minute, not per render
  useEffect(() => {
    const timer = setInterval(() => {
      const next = read()
      setState((prev) => (prev.sky === next.sky && prev.greeting === next.greeting ? prev : next))
    }, 60_000)
    return () => clearInterval(timer)
  }, [])
  return state
}
