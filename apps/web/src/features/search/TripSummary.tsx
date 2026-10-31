import { useI18n } from '../../shared/i18n/index.tsx'

interface TripSummaryProps {
  from: string
  to: string
  onEdit: () => void
  /** Clears the result and the places, back to an empty search. */
  onReset: () => void
}

/**
 * The search, folded into one line once there's a result, so the route sits right under the map
 * instead of below the whole form. "Change" opens the form again with the same places.
 */
export function TripSummary({ from, to, onEdit, onReset }: TripSummaryProps) {
  const { t } = useI18n()
  return (
    <section className="trip-summary" aria-label={t('search.summary')}>
      <span className="trip__rail" aria-hidden="true">
        <span className="trip__dot trip__dot--from" />
        <span className="trip__line" />
        <span className="trip__dot trip__dot--to" />
      </span>
      <p className="trip-summary__places">
        <span className="trip-summary__place">{from}</span>
        <span className="visually-hidden"> → </span>
        <span className="trip-summary__place">{to}</span>
      </p>
      <span className="trip-summary__actions">
        <button type="button" className="chip" onClick={onEdit}>
          {t('search.edit')}
        </button>
        <button type="button" className="chip" onClick={onReset}>
          {t('search.reset')}
        </button>
      </span>
    </section>
  )
}
