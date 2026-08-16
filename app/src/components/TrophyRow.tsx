import { useState } from 'react'
import type { Trophy } from '../data/types'
import { ORIGIN_LABEL, TIER_ICON, TIER_LABEL, TYPE_LABEL } from '../lib/labels'
import { formatDate } from '../lib/format'
import { CheckIcon } from './icons'

interface Props {
  trophy: Trophy
  earnedAt?: number
  /**
   * A Platina não é marcável: ela acende sozinha quando o resto da lista base
   * está completo, então a caixa dela fica travada.
   */
  derived?: boolean
  /** "Revelar secretos" ligado no jogo inteiro. */
  reveal: boolean
  /** De onde o troféu veio, quando a linha aparece fora da página do jogo. */
  subtitle?: string
  onToggle: () => void
}

export function TrophyRow({ trophy, earnedAt, derived, reveal, subtitle, onToggle }: Props) {
  // `null` = segue o padrão; o toque no corpo é que grava uma escolha manual.
  const [override, setOverride] = useState<boolean | null>(null)
  const [revealedHere, setRevealedHere] = useState(false)

  // Troféu obtido não tem mais spoiler para proteger.
  const hidden = trophy.secret && !reveal && !revealedHere && earnedAt === undefined
  const earned = earnedAt !== undefined

  // O que falta fica legível de cara; o que já foi conquistado se cala.
  const open = override ?? !earned

  function handleToggle() {
    // Zerar o override devolve a linha ao padrão: marcar fecha, desmarcar reabre.
    setOverride(null)
    onToggle()
  }

  return (
    <div
      className={earned ? 'trophy is-earned' : 'trophy'}
      style={{ ['--tier-color' as string]: `var(--${trophy.tier})` }}
    >
      <div className="trophy__head">
        <button
          type="button"
          className="trophy__toggle"
          onClick={handleToggle}
          disabled={derived}
          aria-pressed={earned}
          aria-label={
            derived
              ? 'A Platina acende sozinha ao completar a lista'
              : `Marcar ${hidden ? 'troféu oculto' : trophy.name} como obtido`
          }
          title={derived ? 'Acende sozinha quando todos os outros forem obtidos' : undefined}
        >
          <CheckIcon />
        </button>

        <button
          type="button"
          className="trophy__body"
          onClick={() => setOverride(!open)}
          aria-expanded={open}
        >
          <span aria-hidden="true">{TIER_ICON[trophy.tier]}</span>
          <span className="trophy__label">
            <span className={hidden ? 'trophy__name is-hidden' : 'trophy__name'}>
              {hidden ? 'Troféu oculto' : trophy.name}
            </span>
            {subtitle && <span className="trophy__sub">{subtitle}</span>}
          </span>
          <span className="trophy__flags">
            {trophy.missable && <span title="Perdível">⚠️</span>}
            {trophy.secret && <span title="Secreto">🔒</span>}
          </span>
        </button>
      </div>

      {open && (
        <div className="trophy__detail">
          {hidden ? (
            <>
              <p className="hint" style={{ margin: 0 }}>
                Este troféu é secreto. Ver a descrição entrega parte do jogo.
              </p>
              <div>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => setRevealedHere(true)}
                >
                  Revelar mesmo assim
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="trophy__desc" style={{ margin: 0 }}>
                {trophy.description}
              </p>
              <p className="trophy__field" style={{ margin: 0 }}>
                <b>Como verificar:</b> {trophy.verification}
              </p>
              <p className="trophy__field" style={{ margin: 0 }}>
                <b>{trophy.id}</b> · {TIER_LABEL[trophy.tier]} · {TYPE_LABEL[trophy.type]}
                {trophy.origin !== 'original' &&
                  ` · ${ORIGIN_LABEL[trophy.origin]}${trophy.originId ? `: ${trophy.originId}` : ''}`}
              </p>
              {trophy.notes && <p className="trophy__note">{trophy.notes}</p>}
            </>
          )}

          {earned && <p className="trophy__earned-at">Obtido em {formatDate(earnedAt)}</p>}
        </div>
      )}
    </div>
  )
}
