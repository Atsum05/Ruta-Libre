/**
 * The RutaLibre mark: a route climbing over the Andes, from an open circle (where you are) to a
 * filled one (where you're going), on a dusk-coloured tile. The name is read out once, from the
 * visible text.
 */
export function Wordmark() {
  return (
    <span className="wordmark">
      <svg
        className="wordmark__glyph"
        viewBox="0 0 32 32"
        width="34"
        height="34"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id="rl-tile" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff7a59" />
            <stop offset="1" stopColor="#6a3fd6" />
          </linearGradient>
          <clipPath id="rl-clip">
            <rect x="1" y="1" width="30" height="30" rx="9" />
          </clipPath>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#rl-tile)" />
        <path
          d="M0 27 L9 17 L13 21 L19.5 13 L32 25 V32 H0 Z"
          fill="#ffffff"
          opacity="0.22"
          clipPath="url(#rl-clip)"
        />
        <path
          d="M8 23.5c2.5-6 6.5-1.5 9-6.5s4-7 7.5-7.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <circle cx="8" cy="23.5" r="2.7" fill="#d9566b" stroke="#ffffff" strokeWidth="2" />
        <circle cx="24.5" cy="9.5" r="3.1" fill="#ffffff" />
      </svg>
      <span className="wordmark__text">
        Ruta<b>Libre</b>
      </span>
    </span>
  )
}
