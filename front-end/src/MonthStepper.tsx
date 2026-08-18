import { currentPeriod, formatPeriod, isSamePeriod, shiftPeriod, type Period } from './period'

type Props = {
  period: Period
  onChange: (period: Period) => void
}

function MonthStepper({ period, onChange }: Props) {
  const atCurrentMonth = isSamePeriod(period, currentPeriod())

  return (
    <nav aria-label="Month">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shiftPeriod(period, -1))}
      >
        ‹
      </button>

      <span>{formatPeriod(period)}</span>

      <button
        type="button"
        aria-label="Next month"
        disabled={atCurrentMonth}
        onClick={() => onChange(shiftPeriod(period, 1))}
      >
        ›
      </button>
    </nav>
  )
}

export default MonthStepper
