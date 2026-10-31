// One small icon set, drawn for RutaLibre: 24×24, 2px rounded strokes, currentColor. Icons are
// decorative (aria-hidden); the words next to them carry the meaning.

import type { ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 20, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const WalkIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="13" cy="4" r="2" />
    <path d="m9 21 2.5-6.5L14 17v4" />
    <path d="m7 12 3-4 4 1 2 4 3 1" />
  </Icon>
)

export const MetroIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 15V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
    <path d="M6 10h12M9.5 17 8 20.5M14.5 17l1.5 3.5M6 21h12" />
    <circle cx="9.5" cy="13.5" r=".6" fill="currentColor" />
    <circle cx="14.5" cy="13.5" r=".6" fill="currentColor" />
  </Icon>
)

export const BusIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="16" height="13" rx="2.5" />
    <path d="M4 10h16M12 4v6" />
    <circle cx="8" cy="19" r="1.6" />
    <circle cx="16" cy="19" r="1.6" />
  </Icon>
)

export const RailIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 3h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z" />
    <path d="M5 10h14M9 17l-3 4M15 17l3 4M8 21h8" />
  </Icon>
)

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
    <circle cx="12" cy="9" r="2.5" />
  </Icon>
)

export const LocateIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
)

export const RouteIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5" />
  </Icon>
)

export const SwapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 4v16M8 4 4 8M8 4l4 4" />
    <path d="M16 20V4M16 20l-4-4M16 20l4-4" />
  </Icon>
)

export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Icon>
)

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
  </Icon>
)

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)

export const ArrowIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
)

export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
)

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
)

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 10v4M12 17h.01" />
  </Icon>
)

export const BlockedIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 8.5 7 7M15.5 8.5l-7 7" />
  </Icon>
)

export const QuestionIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01" />
  </Icon>
)

export const ElevatorIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M12 3v18M7.5 9 9 7l1.5 2M13.5 7l1.5 2 1.5-2" />
  </Icon>
)
