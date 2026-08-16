import { Link } from 'react-router-dom'
import { loadCatalog } from '../data/catalog'
import type { CatalogEntry } from '../data/types'
import { useAsync } from '../hooks/useAsync'
import { useProgress, EMPTY_GAME } from '../store/progress'
import { catalogProgress, type Progress } from '../lib/stats'
import { ProgressBar } from '../components/ProgressBar'

/** Em andamento primeiro, depois os que nem começaram, e os platinados no fim. */
function rank(progress: Progress): number {
  if (progress.complete) return 2
  return progress.earned > 0 ? 0 : 1
}

export function GamesPage() {
  const { data, error, loading } = useAsync(() => loadCatalog(), [])
  const state = useProgress()

  const games: { entry: CatalogEntry; progress: Progress }[] = (data?.games ?? [])
    .map((entry) => ({
      entry,
      progress: catalogProgress(entry, state.games[entry.slug] ?? EMPTY_GAME),
    }))
    .sort((a, b) => rank(a.progress) - rank(b.progress))

  const platinums = games.filter((g) => g.progress.complete).length
  const earned = games.reduce((sum, g) => sum + g.progress.earned, 0)
  const total = games.reduce((sum, g) => sum + g.progress.total, 0)

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

        <div className="stack">
          {games.map(({ entry, progress }) => (
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
