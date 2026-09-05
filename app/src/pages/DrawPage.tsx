import { useMemo, useState } from 'react'
import type { Tier, TrophyList, TrophyType } from '../data/types'
import { loadCatalog, loadGame } from '../data/catalog'
import { useAsync } from '../hooks/useAsync'
import { toggleTrophy, useGameProgress, useProgress } from '../store/progress'
import {
  collectPending,
  filterPending,
  DEFAULT_FILTERS,
  PLATFORMS,
  type DrawFilters,
  type PendingItem,
} from '../lib/pending'
import { DRAW_TARGETS, draw, randomSeed, todaySeed, type DrawResult } from '../lib/draw'
import { TIER_ICON, TIER_LABEL, TYPE_LABEL } from '../lib/labels'
import { progress as makeProgress } from '../lib/stats'
import { ProgressBar } from '../components/ProgressBar'
import { TrophyRow } from '../components/TrophyRow'

/**
 * O sorteio do dia fica salvo por ponteiro (jogo + id), não recalculado a
 * cada carregamento. Sem isso, um troféu marcado sumiria do pool de pendentes
 * e, ao recarregar a página de verdade (não só navegar dentro do app), o
 * "12 de 35 hoje" voltaria a zero mesmo com o progresso intacto.
 */
const STORAGE_KEY = 'pantheon-draw-v1'

interface StoredPick {
  gameSlug: string
  trophyId: string
}

interface StoredResult {
  tier: Tier
  available: number
  picks: StoredPick[]
}

interface StoredDraw {
  /** Já vem com os filtros dobrados dentro — ver `effectiveSeed`. */
  seed: string
  filters: DrawFilters
  results: StoredResult[]
}

function loadStored(): StoredDraw | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraw>
    if (typeof parsed.seed !== 'string' || !Array.isArray(parsed.results)) return null
    // Registro gravado antes dos filtros existirem: descartado, não quebra.
    if (!parsed.filters || typeof parsed.filters !== 'object') return null
    return parsed as StoredDraw
  } catch {
    return null
  }
}

function saveStored(seed: string, filters: DrawFilters, results: DrawResult[]) {
  const stored: StoredDraw = {
    seed,
    filters,
    results: results.map((r) => ({
      tier: r.tier,
      available: r.available,
      picks: r.items.map((item) => ({ gameSlug: item.game.slug, trophyId: item.trophy.id })),
    })),
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // Modo privado do Safari e afins: o sorteio ainda funciona na sessão atual.
  }
}

/** Resolve um ponteiro salvo contra as listas carregadas — o troféu em si não muda. */
function resolvePick(lists: TrophyList[], pick: StoredPick): PendingItem | null {
  const list = lists.find((l) => l.game.slug === pick.gameSlug)
  if (!list) return null

  const base = list.trophies.find((t) => t.id === pick.trophyId)
  if (base) return { trophy: base, game: list.game, reveal: false }

  for (const pack of list.dlc ?? []) {
    const trophy = pack.trophies.find((t) => t.id === pick.trophyId)
    if (trophy) return { trophy, game: list.game, pack: pack.name, reveal: false }
  }

  return null
}

/** Liga/desliga um valor numa seleção múltipla de chips. */
function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** Quantos filtros saíram do padrão — vira o contador no botão. */
function countActive(f: DrawFilters): number {
  return (
    Number(f.dlc !== DEFAULT_FILTERS.dlc) +
    Number(f.startedOnly) +
    Number(f.missable) +
    Number(f.types.length > 0) +
    Number(f.platforms.length > 0)
  )
}

/** Uma linha do sorteio: o troféu em si é fixo, mas obtido/revelado é ao vivo. */
function DrawRow({ item }: { item: PendingItem }) {
  const progress = useGameProgress(item.game.slug)

  return (
    <TrophyRow
      trophy={item.trophy}
      earnedAt={progress.earned[item.trophy.id]}
      reveal={progress.revealSecrets ?? false}
      subtitle={[item.game.title, item.pack].filter(Boolean).join(' · ')}
      onToggle={() => toggleTrophy(item.game.slug, item.trophy.id)}
    />
  )
}

export function DrawPage() {
  const state = useProgress()
  const { data, error, loading } = useAsync(
    () => loadCatalog().then((c) => Promise.all(c.games.map((g) => loadGame(g.slug)))),
    [],
  )

  const [seed, setSeed] = useState<string>(() => todaySeed())
  const isDaily = seed === todaySeed()

  // Os filtros fazem parte do sorteio do dia: sem reidratar daqui, um F5
  // devolveria o sorteio salvo sob filtro como se fosse o sorteio sem filtro.
  const [filters, setFilters] = useState<DrawFilters>(() => loadStored()?.filters ?? DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const activeCount = countActive(filters)

  // Os filtros entram na semente em vez de virar mais um campo a comparar: de
  // uma vez só invalidam o sorteio salvo (mexeu no filtro, re-sorteia) e fazem
  // as escolhas variarem entre conjuntos de filtros, porque `hash` usa a semente.
  const filterKey = [
    filters.dlc ? 'd' : '',
    filters.startedOnly ? 's' : '',
    filters.missable ? 'm' : '',
    [...filters.types].sort().join(','),
    [...filters.platforms].sort().join(','),
  ].join('|')
  const effectiveSeed = `${seed}#${filterKey}`

  // Só a semente do dia é salva. Um sorteio avulso nunca grava por cima dela —
  // senão "novo sorteio" e depois "voltar pro de hoje" perderia de vista o que
  // já tinha sido marcado no sorteio original do dia.
  const { results, poolSize } = useMemo(() => {
    if (!data) return { results: [] as DrawResult[], poolSize: 0 }

    if (isDaily) {
      const stored = loadStored()
      if (stored && stored.seed === effectiveSeed) {
        const restored = stored.results.map((r) => ({
          tier: r.tier,
          available: r.available,
          items: r.picks
            .map((p) => resolvePick(data, p))
            .filter((item): item is PendingItem => item !== null),
        }))
        return {
          results: restored,
          poolSize: restored.reduce((sum, r) => sum + r.available, 0),
        }
      }
    }

    const pool = filterPending(collectPending(data, state.games), filters, state.games)
    const fresh = draw(pool, effectiveSeed)
    if (isDaily) saveStored(effectiveSeed, filters, fresh)
    return { results: fresh, poolSize: pool.length }
    // `state.games` fica de fora de propósito: marcar um troféu não pode
    // remontar o sorteio de hoje. Os filtros entram via `effectiveSeed`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, effectiveSeed])

  const total = results.reduce((sum, r) => sum + r.items.length, 0)
  const done = results.reduce(
    (sum, r) =>
      sum +
      r.items.filter((item) => item.trophy.id in (state.games[item.game.slug]?.earned ?? {})).length,
    0,
  )
  const overall = makeProgress(done, total)

  // Só os tipos que existem entre os pendentes viram chip — mesmo critério dos
  // tiers em Pendentes. O pool sem filtro é barato e não alimenta o sorteio.
  const allPending = collectPending(data ?? [], state.games)
  const typesPresentes = (Object.keys(TYPE_LABEL) as TrophyType[]).filter((t) =>
    allPending.some((i) => i.trophy.type === t),
  )

  return (
    <>
      <header className="header">
        <div className="header__titles">
          <h1>Sorteio</h1>
          <p className="header__sub">
            {loading
              ? 'Carregando…'
              : `${isDaily ? 'Sorteio de hoje' : 'Sorteio avulso'} · ${done}/${total} conquistados`}
          </p>
        </div>
      </header>

      <div className="page">
        {error && (
          <div className="empty">
            <div className="empty__icon">⚠️</div>
            <p className="empty__title">Não deu para carregar as listas</p>
            <p className="hint">{error.message}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="row row--wrap" style={{ gap: 8 }}>
              <button type="button" className="btn" onClick={() => setSeed(randomSeed())}>
                🎲 Novo sorteio
              </button>
              {!isDaily && (
                <button type="button" className="btn btn--ghost" onClick={() => setSeed(todaySeed())}>
                  ↺ Sorteio de hoje
                </button>
              )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setShowFilters(!showFilters)}
                aria-expanded={showFilters}
              >
                ⚙️ Filtros{activeCount > 0 && ` (${activeCount})`}
              </button>
            </div>

            {showFilters && (
              <div className="stack" style={{ marginTop: 12 }}>
                <div className="chip-grid">
                  <button
                    type="button"
                    className={filters.dlc ? 'chip-option is-active' : 'chip-option'}
                    onClick={() => setFilters({ ...filters, dlc: !filters.dlc })}
                    aria-pressed={filters.dlc}
                  >
                    📦 DLC
                  </button>
                  <button
                    type="button"
                    className={filters.startedOnly ? 'chip-option is-active' : 'chip-option'}
                    onClick={() => setFilters({ ...filters, startedOnly: !filters.startedOnly })}
                    aria-pressed={filters.startedOnly}
                  >
                    🎮 Iniciados
                  </button>
                  <button
                    type="button"
                    className={filters.missable ? 'chip-option is-active' : 'chip-option'}
                    onClick={() => setFilters({ ...filters, missable: !filters.missable })}
                    aria-pressed={filters.missable}
                  >
                    ⚠️ Perdíveis
                  </button>
                </div>

                <div className="chip-grid">
                  {typesPresentes.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={filters.types.includes(value) ? 'chip-option is-active' : 'chip-option'}
                      onClick={() => setFilters({ ...filters, types: toggleIn(filters.types, value) })}
                      aria-pressed={filters.types.includes(value)}
                    >
                      {TYPE_LABEL[value]}
                    </button>
                  ))}
                </div>

                <div className="chip-grid">
                  {PLATFORMS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      className={filters.platforms.includes(id) ? 'chip-option is-active' : 'chip-option'}
                      onClick={() => setFilters({ ...filters, platforms: toggleIn(filters.platforms, id) })}
                      aria-pressed={filters.platforms.includes(id)}
                    >
                      🕹️ {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {total > 0 && (
              <section className="card" style={{ marginTop: 12 }}>
                <ProgressBar
                  progress={overall}
                  label={overall.complete ? '🎉 Sorteio completo' : 'Progresso do sorteio'}
                />
                <div className="tier-stats">
                  {results.map((r) => {
                    if (r.items.length === 0) return null
                    const tierDone = r.items.filter(
                      (item) => item.trophy.id in (state.games[item.game.slug]?.earned ?? {}),
                    ).length
                    return (
                      <span
                        key={r.tier}
                        className={tierDone === r.items.length ? 'tier-stat is-complete' : 'tier-stat'}
                        style={{ ['--tier' as string]: `var(--${r.tier})` }}
                        title={TIER_LABEL[r.tier]}
                      >
                        {TIER_ICON[r.tier]} {tierDone}/{r.items.length}
                      </span>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {!loading && !error && total === 0 && (
          <div className="empty">
            <div className="empty__icon">{poolSize === 0 && activeCount > 0 ? '🔍' : '💎'}</div>
            <p className="empty__title">
              {poolSize === 0 && activeCount > 0 ? 'Nenhum troféu com esses filtros' : 'Nada pendente'}
            </p>
            {activeCount === 0 && (
              <p className="hint">Você conquistou tudo que há para conquistar.</p>
            )}
          </div>
        )}

        {results.map((r) =>
          r.items.length === 0 ? null : (
            <div key={r.tier}>
              <h2 className="section-title">
                {TIER_ICON[r.tier]} {TIER_LABEL[r.tier]}
                {r.available < DRAW_TARGETS[r.tier as 'bronze' | 'silver' | 'gold'] &&
                  ` · só ${r.available} disponíveis`}
              </h2>
              <div className="trophy-list">
                {r.items.map((item) => (
                  <DrawRow key={`${item.game.slug}-${item.trophy.id}`} item={item} />
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </>
  )
}
