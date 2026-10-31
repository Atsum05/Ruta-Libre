import type { ReactNode } from 'react'
import type { Sky } from './sky.ts'

/**
 * The top of the panel: the Andes as seen from Santiago, under a sky that follows the time of
 * day (dawn sun behind the peaks, pink snow at dusk, stars at night), with the Gran Torre on the
 * skyline. Purely decorative: the content on top carries all the meaning.
 */
export function SkyHeader({ sky, children }: { sky: Sky; children: ReactNode }) {
  return (
    <header className="sky" data-sky={sky}>
      <span className="sky__stars" aria-hidden="true" />
      <span className="sky__orb" aria-hidden="true" />
      <div className="sky__content">{children}</div>
      <Andes />
    </header>
  )
}

function Andes() {
  return (
    <svg
      className="sky__andes"
      viewBox="0 0 400 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="sky__ridge sky__ridge--far"
        d="M0 62 L18 50 L30 56 L48 38 L60 46 L74 40 L92 24 L106 36 L118 31 L134 44 L150 30 L164 20 L178 33 L190 28 L206 42 L222 34 L238 18 L252 30 L266 26 L282 40 L298 32 L314 44 L330 28 L346 22 L360 34 L376 30 L400 46 L400 100 L0 100 Z"
      />
      <path
        className="sky__snow"
        d="M92 24 L85.5 29.8 L88.5 29 L90.5 31 L93 28.8 L95 30 L97 28.3 Z M164 20 L158.4 24 L161 23.6 L163 26 L165.5 23.8 L167.5 25.6 L169.6 25.2 Z M238 18 L231.6 24.4 L234.5 23.5 L236.5 26 L239 23.4 L241.4 24.8 L243.6 22.8 Z M346 22 L339.6 24.4 L342 24.6 L344 27 L346.5 25 L349 27.4 L351.6 26.8 Z"
      />
      <path
        className="sky__ridge sky__ridge--mid"
        d="M0 74 L24 62 L44 68 L70 54 L92 64 L116 56 L140 66 L168 52 L194 64 L214 60 L236 70 L262 58 L286 66 L304 62 L324 72 L350 60 L374 68 L400 62 L400 100 L0 100 Z"
      />
      {/* Santiago's skyline, with the Gran Torre Santiago standing out. */}
      <path
        className="sky__city"
        d="M266 100 V80 H275 V100 Z M276 100 V72 H284 V100 Z M288 100 V50 L290.5 45.5 L292.5 43 H294.5 L297 47 V100 Z M300 100 V66 H307 V100 Z M309 100 V75 H319 V100 Z M321 100 V79 H327 V100 Z"
      />
      <path
        className="sky__ridge sky__ridge--near"
        d="M0 92 C50 84 110 90 170 87 S280 82 330 88 S380 92 400 86 L400 100 L0 100 Z"
      />
    </svg>
  )
}
