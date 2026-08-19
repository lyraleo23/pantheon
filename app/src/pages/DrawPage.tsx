import { useMemo, useState } from 'react'
import type { Tier, TrophyList } from '../data/types'
import { loadCatalog, loadGame } from '../data/catalog'
import { useAsync } from '../hooks/useAsync'
import { toggleTrophy, useGameProgress, useProgress } from '../store/progress'
import { collectPending, type PendingItem } from '../lib/pending'
import { DRAW_TARGETS, draw, randomSeed, todaySeed, type DrawResult } from '../lib/draw'
import { TIER_ICON, TIER_LABEL } from '../lib/labels'
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
  seed: string
  results: StoredResult[]
}

function loadStored(): StoredDraw | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredDraw>
    if (typeof parsed.seed !== 'string' || !Array.isArray(parsed.results)) return null
    return parsed as StoredDraw
  } catch {
    return null
  }
}

function saveStored(seed: string, results: DrawResult[]) {
  const stored: StoredDraw = {
    seed,
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

  // Só a semente do dia é salva. Um sorteio avulso nunca grava por cima dela —
  // senão "novo sorteio" e depois "voltar pro de hoje" perderia de vista o que
  // já tinha sido marcado no sorteio original do dia.
  const results = useMemo(() => {
    if (!data) return []

    if (isDaily) {
      const stored = loadStored()
      if (stored && stored.seed === seed) {
        return stored.results.map((r) => ({
          tier: r.tier,
          available: r.available,
          items: r.picks
            .map((p) => resolvePick(data, p))
            .filter((item): item is PendingItem => item !== null),
        }))
      }

      const pending = collectPending(data, state.games)
      const fresh = draw(pending, seed)
      saveStored(seed, fresh)
      return fresh
    }

    const pending = collectPending(data, state.games)
    return draw(pending, seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, seed])

  const total = results.reduce((sum, r) => sum + r.items.length, 0)
  const done = results.reduce(
    (sum, r) =>
      sum +
      r.items.filter((item) => item.trophy.id in (state.games[item.game.slug]?.earned ?? {})).length,
    0,
  )
  const overall = makeProgress(done, total)

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
            </div>

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
            <div className="empty__icon">💎</div>
            <p className="empty__title">Nada pendente</p>
            <p className="hint">Você conquistou tudo que há para conquistar.</p>
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
