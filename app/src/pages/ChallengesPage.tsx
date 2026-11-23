import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadCatalog, loadChallenges, loadGame } from '../data/catalog'
import type { Challenge, ChallengeLevel, TrophyList } from '../data/types'
import { useAsync } from '../hooks/useAsync'
import {
  EMPTY_GAME,
  shelfOf,
  toggleTrophy,
  useProgress,
  type GameProgress,
  type ProgressState,
} from '../store/progress'
import { platinumUnlocked } from '../lib/stats'
import { TrophyRow } from '../components/TrophyRow'

const LEVELS: { key: ChallengeLevel; label: string; icon: string }[] = [
  { key: 'mortal', label: 'Mortal', icon: '🗿' },
  { key: 'heroi', label: 'Herói', icon: '🛡️' },
  { key: 'divino', label: 'Divino', icon: '⚡' },
]

/**
 * Qual dos desafios do mês está aberto. Abrir um jogo pelo desafio desmonta a
 * página, e voltar dele não pode cair em outro desafio. Fica fora do backup.
 */
const PICK_KEY = 'pantheon-challenge-pick-v1'

function loadPick(): string | undefined {
  try {
    return localStorage.getItem(PICK_KEY) ?? undefined
  } catch {
    return undefined
  }
}

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

/**
 * Mesmo critério do sorteio: jogo platinado mora em Concluídos, não no backlog,
 * então o DLC que sobrou dele continua sendo indicado.
 */
function onBacklog(list: TrophyList, game: GameProgress): boolean {
  if (shelfOf(game) !== 'backlog') return false
  const base = list.trophies.filter((t) => t.tier !== 'platinum').map((t) => t.id)
  return !platinumUnlocked(base, game.earned)
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

  const [pick, setPick] = useState(loadPick)

  useEffect(() => {
    if (pick === undefined) return
    try {
      localStorage.setItem(PICK_KEY, pick)
    } catch {
      // Modo privado do Safari e afins: a escolha vale só nesta sessão.
    }
  }, [pick])

  const [challenges = [], lists = []] = data ?? []
  const now = Date.now()
  const current = challenges.filter((c) => {
    const [from, to] = windowOf(c)
    return now >= from && now < to
  })
  const upcoming = challenges.filter((c) => windowOf(c)[0] > now)
  const past = challenges.filter((c) => windowOf(c)[1] <= now)

  // Escolha de um mês que já passou não vale para o seguinte: volta ao primeiro.
  const open = current.find((c) => c.id === pick) ?? current[0]

  return (
    <>
      <header className="header">
        <div className="header__titles">
          <h1>Desafios</h1>
          <p className="header__sub">
            {loading
              ? 'Carregando…'
              : current.length > 1
                ? `${current.length} desafios do mês em andamento`
                : current.length
                  ? 'Desafio do mês em andamento'
                  : 'Nenhum desafio ativo'}
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

        {current.length > 1 && (
          <div className="segmented" style={{ marginBottom: 12 }}>
            {current.map((c) => {
              const done = countDone(c, progress)
              const level = levelReached(c, done)
              return (
                <button
                  key={c.id}
                  type="button"
                  className={c === open ? 'segmented__option is-active' : 'segmented__option'}
                  onClick={() => setPick(c.id)}
                  aria-pressed={c === open}
                  title={c.title}
                >
                  <span className="segmented__label">{c.title}</span>
                  <span className="segmented__count">
                    {level ? `${level.icon} ` : ''}
                    {done}/{c.levels.divino}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {open && (
          <CurrentChallenge key={open.id} challenge={open} lists={lists} progress={progress} />
        )}

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
                {c.start.slice(0, 7)} · {c.title}
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
  // Fica o que conta (obtido na janela, de qualquer lista) e o que dá para buscar
  // (pendente de jogo ativo). Obtido antes do início não volta a valer, e
  // pendente de jogo no backlog não é indicado.
  const groups = lists
    .map((list) => {
      const game = progress.games[list.game.slug] ?? EMPTY_GAME
      const ids = new Set(challenge.pool.filter((p) => p.slug === list.game.slug).map((p) => p.trophyId))
      const benched = ids.size > 0 && onBacklog(list, game)
      const all = [...list.trophies, ...(list.dlc ?? []).flatMap((p) => p.trophies)]
      const trophies = all.filter((t) => {
        if (!ids.has(t.id)) return false
        const at = game.earned[t.id]
        return at === undefined ? !benched : at >= from && at < to
      })
      return { list, game, trophies }
    })
    .filter((g) => g.trophies.length > 0)

  const shown = groups.reduce((sum, g) => sum + g.trophies.length, 0)

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
            {shown} troféus em {groups.length} {groups.length === 1 ? 'jogo ativo' : 'jogos ativos'} ·{' '}
            {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}
          </p>
        </div>
        <LevelTrack challenge={challenge} done={done} />
      </div>

      {groups.length === 0 && (
        <div className="empty">
          <div className="empty__icon">📚</div>
          <p className="empty__title">Nenhum troféu deste desafio em jogos ativos</p>
          <p className="hint">
            O que falta está em jogos do backlog. Abra um e toque em “Adicionar à lista principal”.
          </p>
        </div>
      )}

      {groups.map(({ list, game, trophies }) => (
        <div key={list.game.slug} className="trophy-list">
          <h3 className="section-title">
            <Link to={`/jogo/${list.game.slug}`}>{list.game.title}</Link>
          </h3>
          {trophies.map((t) => (
            <TrophyRow
              key={t.id}
              trophy={t}
              earnedAt={game.earned[t.id]}
              reveal={game.revealSecrets ?? false}
              onToggle={() => toggleTrophy(list.game.slug, t.id)}
            />
          ))}
        </div>
      ))}
    </section>
  )
}
