import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadCatalog } from '../data/catalog'
import type { CatalogEntry } from '../data/types'
import { useAsync } from '../hooks/useAsync'
import { useProgress, shelfOf, EMPTY_GAME, type Shelf } from '../store/progress'
import { catalogProgress, type Progress } from '../lib/stats'
import { PLATFORMS, matchesPlatforms } from '../lib/platforms'
import { ProgressBar } from '../components/ProgressBar'

type SortKey = 'progress' | 'title'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'progress', label: 'Progresso' },
  { value: 'title', label: 'A–Z' },
]

const SHELF_OPTIONS: { value: Shelf; label: string }[] = [
  { value: 'main', label: '⭐ Principal' },
  { value: 'backlog', label: '📚 Backlog' },
]

interface View {
  shelf: Shelf
  sort: SortKey
  /** IDs de `PLATFORMS`. Vazio = todos. */
  platforms: string[]
  /** Esconde os platinados. */
  incompleteOnly: boolean
}

const DEFAULT_VIEW: View = { shelf: 'main', sort: 'progress', platforms: [], incompleteOnly: false }

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
      shelf: parsed.shelf === 'backlog' ? 'backlog' : 'main',
      sort: parsed.sort === 'title' ? 'title' : 'progress',
      platforms: Array.isArray(parsed.platforms)
        ? parsed.platforms.filter((id) => PLATFORMS.some((p) => p.id === id))
        : [],
      incompleteOnly: parsed.incompleteOnly === true,
    }
  } catch {
    // Storage corrompido ou bloqueado não pode impedir a página de abrir.
    return DEFAULT_VIEW
  }
}

/** Em andamento primeiro, depois os que nem começaram, e os platinados no fim. */
function rank(progress: Progress): number {
  if (progress.complete) return 2
  return progress.earned > 0 ? 0 : 1
}

interface Item {
  entry: CatalogEntry
  progress: Progress
  shelf: Shelf
}

function byTitle(a: Item, b: Item): number {
  return a.entry.title.localeCompare(b.entry.title, 'pt-BR')
}

/** Dentro de cada faixa de `rank`, o mais perto da Platina vem antes. */
function byProgress(a: Item, b: Item): number {
  return (
    rank(a.progress) - rank(b.progress) ||
    b.progress.percent - a.progress.percent ||
    byTitle(a, b)
  )
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
    return { entry, progress: catalogProgress(entry, game), shelf: shelfOf(game) }
  })

  const platinums = games.filter((g) => g.progress.complete).length
  const earned = games.reduce((sum, g) => sum + g.progress.earned, 0)
  const total = games.reduce((sum, g) => sum + g.progress.total, 0)

  const onShelf = games.filter((g) => g.shelf === view.shelf)
  const visible = onShelf
    .filter((g) => {
      if (view.incompleteOnly && g.progress.complete) return false
      return matchesPlatforms(g.entry.targetPlatform, view.platforms)
    })
    .sort(view.sort === 'title' ? byTitle : byProgress)

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
              {SHELF_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={view.shelf === value ? 'segmented__option is-active' : 'segmented__option'}
                  onClick={() => patch({ shelf: value })}
                  aria-pressed={view.shelf === value}
                >
                  {label} · {games.filter((g) => g.shelf === value).length}
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
                  {label}
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
              <button
                type="button"
                className={view.incompleteOnly ? 'chip-option is-active' : 'chip-option'}
                onClick={() => patch({ incompleteOnly: !view.incompleteOnly })}
                aria-pressed={view.incompleteOnly}
              >
                ⏳ Não concluídos
              </button>
            </div>
          </div>
        )}

        {!loading && !error && games.length > 0 && visible.length === 0 && (
          <div className="empty">
            {onShelf.length > 0 ? (
              <>
                <div className="empty__icon">🔍</div>
                <p className="empty__title">Nenhum jogo com esses filtros</p>
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
                <p className="hint">Todos os jogos estão na lista principal.</p>
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
