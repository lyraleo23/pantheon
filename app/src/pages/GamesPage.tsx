import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadCatalog } from '../data/catalog'
import type { CatalogEntry } from '../data/types'
import { useAsync } from '../hooks/useAsync'
import { useProgress, shelfOf, EMPTY_GAME, type Shelf } from '../store/progress'
import { catalogProgress, platinumEarnedAt, type Progress } from '../lib/stats'
import { PLATFORMS, matchesPlatforms } from '../lib/platforms'
import { ProgressBar } from '../components/ProgressBar'

/**
 * Concluídos não é uma lista que se escolhe: o jogo platinado aparece lá sozinho
 * e, se perder a Platina, volta para a principal ou o backlog, onde estava.
 */
type Tab = Shelf | 'done'

type SortKey = 'progress' | 'title'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'progress', label: 'Progresso' },
  { value: 'title', label: 'A–Z' },
]

const TAB_OPTIONS: { value: Tab; label: string }[] = [
  { value: 'main', label: '⭐ Principal' },
  { value: 'backlog', label: '📚 Backlog' },
  { value: 'done', label: '💎 Concluídos' },
]

interface View {
  shelf: Tab
  sort: SortKey
  /** IDs de `PLATFORMS`. Vazio = todos. */
  platforms: string[]
}

const DEFAULT_VIEW: View = { shelf: 'main', sort: 'progress', platforms: [] }

/**
 * Abrir um jogo desmonta esta página: sem guardar a vista, voltar dele zeraria
 * aba, ordenação e filtros. É só como você gosta de ver, então fica fora do backup.
 */
const VIEW_KEY = 'pantheon-games-view-v1'

function loadView(): View {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null') as Partial<View> | null
    if (!parsed || typeof parsed !== 'object') return DEFAULT_VIEW
    // Campo por campo: um valor que não reconhecemos volta ao padrão sozinho.
    return {
      shelf: parsed.shelf === 'backlog' || parsed.shelf === 'done' ? parsed.shelf : 'main',
      sort: parsed.sort === 'title' ? 'title' : 'progress',
      platforms: Array.isArray(parsed.platforms)
        ? parsed.platforms.filter((id) => PLATFORMS.some((p) => p.id === id))
        : [],
    }
  } catch {
    // Storage corrompido ou bloqueado não pode impedir a página de abrir.
    return DEFAULT_VIEW
  }
}

interface Item {
  entry: CatalogEntry
  progress: Progress
  tab: Tab
  /** Quando a Platina acendeu. Só existe nos concluídos. */
  completedAt?: number
}

function byTitle(a: Item, b: Item): number {
  return a.entry.title.localeCompare(b.entry.title, 'pt-BR')
}

/**
 * O mais perto da Platina vem antes. `earned` desempata o arredondamento: 1 de
 * 300 dá 0%, e mesmo assim é um jogo em andamento, não um que nem começou.
 */
function byProgress(a: Item, b: Item): number {
  return (
    b.progress.percent - a.progress.percent ||
    b.progress.earned - a.progress.earned ||
    byTitle(a, b)
  )
}

/** Nos concluídos todo mundo está em 100%: o progresso vira "a Platina mais recente". */
function byCompletion(a: Item, b: Item): number {
  return (b.completedAt ?? 0) - (a.completedAt ?? 0) || byTitle(a, b)
}

export function GamesPage() {
  const { data, error, loading } = useAsync(() => loadCatalog(), [])
  const state = useProgress()

  const [view, setView] = useState<View>(loadView)
  const patch = (change: Partial<View>) => setView((current) => ({ ...current, ...change }))

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch {
      // Modo privado do Safari e afins: a vista vale só nesta sessão.
    }
  }, [view])

  const games: Item[] = (data?.games ?? []).map((entry) => {
    const game = state.games[entry.slug] ?? EMPTY_GAME
    const progress = catalogProgress(entry, game)
    if (!progress.complete) return { entry, progress, tab: shelfOf(game) }
    return {
      entry,
      progress,
      tab: 'done',
      completedAt: platinumEarnedAt(entry.trophyIds, game.earned),
    }
  })

  const platinums = games.filter((g) => g.progress.complete).length
  const earned = games.reduce((sum, g) => sum + g.progress.earned, 0)
  const total = games.reduce((sum, g) => sum + g.progress.total, 0)

  const onTab = games.filter((g) => g.tab === view.shelf)
  const visible = onTab
    .filter((g) => matchesPlatforms(g.entry.targetPlatform, view.platforms))
    .sort(view.sort === 'title' ? byTitle : view.shelf === 'done' ? byCompletion : byProgress)

  // Só os consoles que algum jogo do catálogo tem viram chip.
  const platformsPresentes = PLATFORMS.filter((p) =>
    games.some((g) => matchesPlatforms(g.entry.targetPlatform, [p.id])),
  )

  return (
    <>
      <header className="header">
        <div className="header__titles">
          <h1>🏛️ Pantheon</h1>
          <p className="header__sub">
            {loading
              ? 'Carregando…'
              : `${games.length} jogos · ${earned}/${total} troféus · ${platinums} platinas`}
          </p>
        </div>
      </header>

      <div className="page">
        {error && (
          <div className="empty">
            <div className="empty__icon">⚠️</div>
            <p className="empty__title">Não deu para carregar o catálogo</p>
            <p className="hint">{error.message}</p>
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="empty">
            <div className="empty__icon">🏛️</div>
            <p className="empty__title">Nenhuma lista ainda</p>
            <p className="hint">
              Gere uma com <code>/pantheon</code> e rode o build de novo.
            </p>
          </div>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="stack">
            <div className="segmented">
              {TAB_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={view.shelf === value ? 'segmented__option is-active' : 'segmented__option'}
                  onClick={() => patch({ shelf: value })}
                  aria-pressed={view.shelf === value}
                >
                  <span>{label}</span>
                  <span className="segmented__count">
                    {games.filter((g) => g.tab === value).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="chip-grid">
              {SORT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={view.sort === value ? 'chip-option is-active' : 'chip-option'}
                  onClick={() => patch({ sort: value })}
                  aria-pressed={view.sort === value}
                >
                  {value === 'progress' && view.shelf === 'done' ? 'Recentes' : label}
                </button>
              ))}
            </div>

            <div className="chip-grid">
              {platformsPresentes.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={view.platforms.includes(id) ? 'chip-option is-active' : 'chip-option'}
                  onClick={() =>
                    patch({
                      platforms: view.platforms.includes(id)
                        ? view.platforms.filter((v) => v !== id)
                        : [...view.platforms, id],
                    })
                  }
                  aria-pressed={view.platforms.includes(id)}
                >
                  🕹️ {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && games.length > 0 && visible.length === 0 && (
          <div className="empty">
            {onTab.length > 0 ? (
              <>
                <div className="empty__icon">🔍</div>
                <p className="empty__title">Nenhum jogo com esses filtros</p>
              </>
            ) : view.shelf === 'done' ? (
              <>
                <div className="empty__icon">💎</div>
                <p className="empty__title">Nenhum jogo concluído ainda</p>
                <p className="hint">Jogo platinado vem para cá sozinho.</p>
              </>
            ) : view.shelf === 'main' ? (
              <>
                <div className="empty__icon">📚</div>
                <p className="empty__title">Lista principal vazia</p>
                <p className="hint">
                  Jogo não iniciado fica no backlog. Abra um e toque em “Adicionar à lista principal”.
                </p>
              </>
            ) : (
              <>
                <div className="empty__icon">⭐</div>
                <p className="empty__title">Backlog vazio</p>
                <p className="hint">Nenhum jogo esperando a vez.</p>
              </>
            )}
          </div>
        )}

        <div className="stack" style={{ marginTop: 16 }}>
          {visible.map(({ entry, progress }) => (
            <Link
              key={entry.slug}
              to={`/jogo/${entry.slug}`}
              className={progress.complete ? 'game-card is-platinum' : 'game-card'}
            >
              <div className="row row--between">
                <span className="game-card__title">{entry.title}</span>
                {progress.complete && (
                  <span className="chip chip--platinum" title="Platina conquistada">
                    💎
                  </span>
                )}
              </div>

              <p className="game-card__meta">{entry.targetPlatform}</p>

              {(entry.status === 'draft' || entry.dlcPacks > 0) && (
                <div className="chip-grid" style={{ marginTop: 8 }}>
                  {entry.status === 'draft' && <span className="chip chip--warn">rascunho</span>}
                  {entry.dlcPacks > 0 && (
                    <span className="chip">
                      +{entry.dlcTotal} de DLC
                    </span>
                  )}
                </div>
              )}

              <div className="game-card__bar">
                <ProgressBar progress={progress} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}
