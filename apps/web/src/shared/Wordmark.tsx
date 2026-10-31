/**
 * The RutaLibre mark: a route from an open circle (where you are) to a filled one (where you're
 * going), bending around an obstacle. The name is read out once, from the visible text.
 */
export function Wordmark() {
  return (
    <span className="wordmark">
      <svg
        className="wordmark__glyph"
        viewBox="0 0 32 32"
        width="30"
        height="30"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M8 25V15a7 7 0 0 1 7-7h2a7 7 0 0 1 0 14h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle
          cx="8"
          cy="25"
          r="3.6"
          fill="var(--paper)"
          stroke="currentColor"
          strokeWidth="2.6"
        />
        <circle
          cx="25"
          cy="25"
          r="3.6"
          fill="var(--signal)"
          stroke="currentColor"
          strokeWidth="2.6"
        />
      </svg>
      <span className="wordmark__text">
        Ruta<b>Libre</b>
      </span>
    </span>
  )
}
