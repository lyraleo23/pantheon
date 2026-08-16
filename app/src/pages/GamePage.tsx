import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadGame } from '../data/catalog'
import type { Tier, Trophy } from '../data/types'
import { useAsync } from '../hooks/useAsync'
import { setRevealSecrets, toggleTrophy, useGameProgress } from '../store/progress'
import { listStats, packProgress, platinumEarnedAt, platinumUnlocked } from '../lib/stats'
import { TIERS, TIER_ICON, TIER_LABEL } from '../lib/labels'
import { normalize } from '../lib/format'
import { ProgressBar } from '../components/ProgressBar'
import { TrophyRow } from '../components/TrophyRow'
import { ChevronLeftIcon } from '../components/icons'

type StatusFilter = 'all' | 'pending' | 'earned'

interface Filters {
  query: string
  status: StatusFilter
  tier: Tier | 'all'
  missable: boolean
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'earned', label: 'Obtidos' },
]

export function GamePage() {
  const { slug = '' } = useParams()
  const { data, error, loading } = useAsync(() => loadGame(slug), [slug])
  const progress = useGameProgress(slug)

  const [filters, setFilters] = useState<Filters>({
    query: '',
    status: 'all',
    tier: 'all',
    missable: false,
  })

  const patch = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }))

  const trophies = data?.trophies ?? []
  const baseIds = trophies.filter((t) => t.tier !== 'platinum').map((t) => t.id)
  const platinumOn = platinumUnlocked(baseIds, progress.earned)
  const stats = listStats(trophies, progress.earned)
  const hasSecrets =
    trophies.some((t) => t.secret) || (data?.dlc ?? []).some((p) => p.trophies.some((t) => t.secret))

  /** A Platina não vive no mapa salvo: a data dela é a do último troféu que faltava. */
  function earnedAt(trophy: Trophy): number | undefined {
    if (trophy.tier === 'platinum') return platinumEarnedAt(baseIds, progress.earned)
    return progress.earned[trophy.id]
  }

  function matches(trophy: Trophy): boolean {
    const got = earnedAt(trophy) !== undefined
    if (filters.status === 'earned' && !got) return false
    if (filters.status === 'pending' && got) return false
    if (filters.tier !== 'all' && trophy.tier !== filters.tier) return false
    if (filters.missable && !trophy.missable) return false

    if (filters.query) {
      const needle = normalize(filters.query)
      // Troféu secreto ainda oculto só casa pelo ID: buscar pelo nome dele
      // devolveria o spoiler que o modo oculto existe para evitar.
      const hidden = trophy.secret && !progress.revealSecrets && !got
      const haystack = hidden
        ? trophy.id
        : `${trophy.name} ${trophy.description} ${trophy.id}`
      if (!normalize(haystack).includes(needle)) return false
    }

    return true
  }

  function renderList(list: Trophy[]) {
    const visible = list.filter(matches)
    if (visible.length === 0) {
      return <p className="hint">Nenhum troféu com esses filtros.</p>
    }
    return (
      <div className="trophy-list">
        {visible.map((trophy) => (
          <TrophyRow
            key={trophy.id}
            trophy={trophy}
            earnedAt={earnedAt(trophy)}
            derived={trophy.tier === 'platinum'}
            reveal={progress.revealSecrets ?? false}
            onToggle={() => toggleTrophy(slug, trophy.id)}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <>
        <Header title="Carregando…" />
        <div className="page" />
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <Header title="Jogo não encontrado" />
        <div className="page">
          <div className="empty">
            <div className="empty__icon">⚠️</div>
            <p className="empty__title">Não deu para carregar esta lista</p>
            <p className="hint">{error?.message ?? slug}</p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={data.game.title} subtitle={data.game.targetPlatform} />

      <div className="page">
        <section className="card">
          <ProgressBar progress={stats.overall} label={platinumOn ? '💎 Platinado' : 'Progresso'} />
          <div className="tier-stats">
            {TIERS.map((tier) => {
              const tierStats = stats.byTier[tier]
              if (tierStats.total === 0) return null
              return (
                <span
                  key={tier}
                  className={tierStats.complete ? 'tier-stat is-complete' : 'tier-stat'}
                  style={{ ['--tier' as string]: `var(--${tier})` }}
                  title={TIER_LABEL[tier]}
                >
                  {TIER_ICON[tier]} {tierStats.earned}/{tierStats.total}
                </span>
              )
            })}
          </div>
        </section>

        <div className="stack" style={{ marginTop: 14 }}>
          <input
            className="input"
            type="search"
            placeholder="Buscar troféu…"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
          />

          <div className="chip-grid">
            {STATUS_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={filters.status === value ? 'chip-option is-active' : 'chip-option'}
                onClick={() => patch({ status: value })}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="chip-grid">
            {TIERS.map((tier) =>
              stats.byTier[tier].total === 0 ? null : (
                <button
                  key={tier}
                  type="button"
                  className={filters.tier === tier ? 'chip-option is-active' : 'chip-option'}
                  onClick={() => patch({ tier: filters.tier === tier ? 'all' : tier })}
                  title={TIER_LABEL[tier]}
                  aria-label={`Filtrar por ${TIER_LABEL[tier]}`}
                  aria-pressed={filters.tier === tier}
                >
                  {TIER_ICON[tier]}
                </button>
              ),
            )}
            {trophies.some((t) => t.missable) && (
              <button
                type="button"
                className={filters.missable ? 'chip-option is-active' : 'chip-option'}
                onClick={() => patch({ missable: !filters.missable })}
              >
                ⚠️ Perdíveis
              </button>
            )}
            {hasSecrets && (
              <button
                type="button"
                className={progress.revealSecrets ? 'chip-option is-active' : 'chip-option'}
                onClick={() => setRevealSecrets(slug, !progress.revealSecrets)}
              >
                🔒 Revelar secretos
              </button>
            )}
          </div>
        </div>

        <h2 className="section-title">Lista base</h2>
        {renderList(trophies)}

        {(data.dlc ?? []).map((pack) => (
          <section key={pack.name}>
            {/* Regra 14: DLC tem contagem própria e não mexe na Platina. */}
            <h2 className="section-title">DLC · {pack.name}</h2>
            <div style={{ marginBottom: 10 }}>
              <ProgressBar progress={packProgress(pack.trophies, progress.earned)} />
            </div>
            {renderList(pack.trophies)}
          </section>
        ))}

        {data.game.notes && (
          <>
            <h2 className="section-title">Notas da lista</h2>
            <p className="hint">{data.game.notes}</p>
          </>
        )}
      </div>
    </>
  )
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="header header--bordered">
      <Link to="/" className="btn back-btn" aria-label="Voltar">
        <ChevronLeftIcon />
      </Link>
      <div className="header__titles">
        <h1>{title}</h1>
        {subtitle && <p className="header__sub">{subtitle}</p>}
      </div>
    </header>
  )
}
