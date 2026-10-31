import { useRef } from 'react'
import { useI18n } from './i18n/index.tsx'

interface SheetHandleProps {
  /** The map fills the screen and the panel is lowered to its top edge. */
  mapOpen: boolean
  onChange: (mapOpen: boolean) => void
}

/** How far a finger must move on the handle to count as a swipe rather than a tap. */
const SWIPE_PX = 24

/**
 * The bar at the top of the panel on a phone. It looks like something you can pull, so it is:
 * swipe down (or tap) to lower the panel and see the whole map, swipe up (or tap) to raise it.
 * A real button, so it also works with a keyboard and a screen reader. Hidden on desktop.
 */
export function SheetHandle({ mapOpen, onChange }: SheetHandleProps) {
  const { t } = useI18n()
  const startY = useRef<number | null>(null)
  // A swipe ends with a click too; this stops that click from undoing the swipe.
  const swiped = useRef(false)

  return (
    <button
      type="button"
      className="sheet__handle"
      aria-expanded={!mapOpen}
      onPointerDown={(e) => {
        startY.current = e.clientY
        swiped.current = false
      }}
      onPointerUp={(e) => {
        if (startY.current === null) return
        const dy = e.clientY - startY.current
        startY.current = null
        if (Math.abs(dy) < SWIPE_PX) return
        swiped.current = true
        onChange(dy > 0)
      }}
      onClick={() => {
        if (swiped.current) {
          swiped.current = false
          return
        }
        onChange(!mapOpen)
      }}
    >
      <span className="sheet__grip" aria-hidden="true" />
      <span className="visually-hidden">
        {mapOpen ? t('map.showPanel') : t('map.showWholeMap')}
      </span>
    </button>
  )
}
