import { Link } from 'react-router-dom'
import { loadCatalog, loadChallenges, loadGame } from '../data/catalog'
import type { Challenge, ChallengeLevel, TrophyList } from '../data/types'
import { useAsync } from '../hooks/useAsync'
import { EMPTY_GAME, toggleTrophy, useProgress, type ProgressState } from '../store/progress'
import { TrophyRow } from '../components/TrophyRow'

const LEVELS: { key: ChallengeLevel; label: string; icon: string }[] = [
  { key: 'mortal', label: 'Mortal', icon: '🗿' },
  { key: 'heroi', label: 'Herói', icon: '🛡️' },
  { key: 'divino', label: 'Divino', icon: '⚡' },
]

/** Datas AAAA-MM-DD no fuso do aparelho: o mês do desafio é o mês do jogador. */
function windowOf(c: Challenge): [number, number] {
  const from = new Date(`${c.start}T00:00:00`).getTime()
  const to = new Date(`${c.end}T00:00:00`).getTime() + 86_400_000
  return [from, to]
}

/** Quantos troféus do pool foram obtidos dentro da janela. Antes dela não vale. */
function countDone(c: Challenge, progress: ProgressState): number {
  const [from, to] = windowOf(c)
  return c.pool.filter(({ slug, trophyId }) => {
    const at = progress.games[slug]?.earned[trophyId]
    return at !== undefined && at >= from && at < to
  }).length
}

function levelReached(c: Challenge, done: number) {
  return [...LEVELS].reverse().find((l) => done >= c.levels[l.key])
}

function LevelTrack({ challenge, done }: { challenge: Challenge; done: number }) {
  const goal = challenge.levels.divino
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="bar__label">
        <span>{done} obtidos no período</span>
        <span>
          {done}/{goal}
        </span>
      </div>
      <div className={done >= goal ? 'bar bar--complete' : 'bar'}>
        <div className="bar__fill" style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
      </div>
      <div className="chip-grid">
        {LEVELS.map(({ key, label, icon }) => (
          <span
            key={key}
            className={done >= challenge.levels[key] ? 'chip-option is-active' : 'chip-option'}
          >
            {icon} {label} · {challenge.levels[key]}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ChallengesPage() {
  const progress = useProgress()
  const { data, error, loading } = useAsync(
    () =>
      Promise.all([
        loadChallenges(),
        loadCatalog().then((c) => Promise.all(c.games.map((g) => loadGame(g.slug)))),
      ]),
    [],
  )

  const [challenges = [], lists = []] = data ?? []
  const now = Date.now()
  const current = challenges.filter((c) => {
    const [from, to] = windowOf(c)
    return now >= from && now < to
  })
  const upcoming = challenges.filter((c) => windowOf(c)[0] > now)
  const past = challenges.filter((c) => windowOf(c)[1] <= now)

  return (
    <>
      <header className="header">
        <div className="header__titles">
          <h1>Desafios</h1>
          <p className="header__sub">
            {loading ? 'Carregando…' : current.length ? 'Desafio do mês em andamento' : 'Nenhum desafio ativo'}
          </p>
        </div>
      </header>

      <div className="page">
        {error && (
          <div className="empty">
            <div className="empty__icon">⚠️</div>
            <p className="empty__title">Não deu para carregar os desafios</p>
            <p className="hint">{error.message}</p>
          </div>
        )}

        {!loading && !error && challenges.length === 0 && (
          <div className="empty">
            <div className="empty__icon">🎯</div>
            <p className="empty__title">Nenhum desafio ainda</p>
            <p className="hint">Crie um com /challenge no Claude Code.</p>
          </div>
        )}

        {current.map((c) => (
          <CurrentChallenge key={c.id} challenge={c} lists={lists} progress={progress} />
        ))}

        {upcoming.length > 0 && <h2 className="section-title">Em breve</h2>}
        {upcoming.map((c) => (
          <div key={c.id} className="card" style={{ marginBottom: 8 }}>
            <b>{c.title}</b>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {c.condition} · começa em {c.start}
            </p>
          </div>
        ))}

        {past.length > 0 && <h2 className="section-title">Anteriores</h2>}
        {past.map((c) => {
          const done = countDone(c, progress)
          const level = levelReached(c, done)
          return (
            <div key={c.id} className="card" style={{ marginBottom: 8 }}>
              <b>
                {c.id} · {c.title}
              </b>
              <p className="hint" style={{ margin: '4px 0 0' }}>
                {done}/{c.levels.divino} · {level ? `${level.icon} ${level.label}` : 'Nenhum nível'}
              </p>
            </div>
          )
        })}
      </div>
    </>
  )
}

function CurrentChallenge({
  challenge,
  lists,
  progress,
}: {
  challenge: Challenge
  lists: TrophyList[]
  progress: ProgressState
}) {
  const done = countDone(challenge, progress)
  const [from, to] = windowOf(challenge)
  const daysLeft = Math.ceil((to - Date.now()) / 86_400_000)

  // Agrupa o pool por jogo, na ordem do catálogo, para dar cara de "volte a este jogo".
  const groups = lists
    .map((list) => {
      const all = [...list.trophies, ...(list.dlc ?? []).flatMap((p) => p.trophies)]
      const ids = new Set(challenge.pool.filter((p) => p.slug === list.game.slug).map((p) => p.trophyId))
      return { list, trophies: all.filter((t) => ids.has(t.id)) }
    })
    .filter((g) => g.trophies.length > 0)

  return (
    <section className="stack" style={{ marginBottom: 24 }}>
      <div className="card stack">
        <div>
          <h2 style={{ margin: 0 }}>{challenge.title}</h2>
          <p style={{ margin: '4px 0 0' }}>{challenge.condition}</p>
          {challenge.rationale && (
            <p className="hint" style={{ margin: '4px 0 0' }}>
              {challenge.rationale}
            </p>
          )}
          <p className="hint" style={{ margin: '4px 0 0' }}>
            {challenge.pool.length} troféus em {groups.length} jogos · {daysLeft}{' '}
            {daysLeft === 1 ? 'dia restante' : 'dias restantes'}
          </p>
        </div>
        <LevelTrack challenge={challenge} done={done} />
      </div>

      {groups.map(({ list, trophies }) => {
        const game = progress.games[list.game.slug] ?? EMPTY_GAME
        return (
          <div key={list.game.slug} className="trophy-list">
            <h3 className="section-title">
              <Link to={`/jogo/${list.game.slug}`}>{list.game.title}</Link>
            </h3>
            {trophies.map((t) => {
              const at = game.earned[t.id]
              const before = at !== undefined && at < from
              return (
                <TrophyRow
                  key={t.id}
                  trophy={t}
                  earnedAt={at}
                  reveal={game.revealSecrets ?? false}
                  subtitle={before ? 'Obtido antes do desafio, não conta' : undefined}
                  onToggle={() => toggleTrophy(list.game.slug, t.id)}
                />
              )
            })}
          </div>
        )
      })}
    </section>
  )
}
