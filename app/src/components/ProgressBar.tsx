import type { Progress } from '../lib/stats'

interface Props {
  progress: Progress
  /** Texto à esquerda do "X/N". Sem ele a barra fica só com os números. */
  label?: string
}

export function ProgressBar({ progress, label }: Props) {
  return (
    <div>
      <div className="bar__label">
        <span>{label}</span>
        <span>
          {progress.earned}/{progress.total} · {progress.percent}%
        </span>
      </div>
      <div
        className={progress.complete ? 'bar bar--complete' : 'bar'}
        role="progressbar"
        aria-valuenow={progress.earned}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label={label}
      >
        <div className="bar__fill" style={{ width: `${progress.percent}%` }} />
      </div>
    </div>
  )
}
