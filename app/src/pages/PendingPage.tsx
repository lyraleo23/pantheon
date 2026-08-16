import { useState } from 'react'
import { loadCatalog, loadGame } from '../data/catalog'
import type { GameMeta, Tier, Trophy, TrophyList } from '../data/types'
import { useAsync } from '../hooks/useAsync'
import { toggleTrophy, useProgress, EMPTY_GAME, type GameProgress } from '../store/progress'
import { TIERS, TIER_ICON, TIER_LABEL } from '../lib/labels'
import { normalize } from '../lib/format'
import { TrophyRow } from '../components/TrophyRow'

type SortKey = 'game' | 'tier' | 'name' | 'platform'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'game', label: 'Jogo' },
  { value: 'tier', label: 'Tier' },
  { value: 'name', label: 'Nome' },
  { value: 'platform', label: 'Console' },
]

/** Um troféu pendente já carregando o jogo de onde veio. */
interface Item {
  trophy: Trophy
  game: GameMeta
  /** Nome do pacote, quando o troféu é de DLC. */
  pack?: string
  reveal: boolean
}

function collect(lists: TrophyList[], games: Record<string, GameProgress>): Item[] {
  const items: Item[] = []

  for (const list of lists) {
    const progress = games[list.game.slug] ?? EMPTY_GAME
    const earned = progress.earned
    const reveal = progress.revealSecrets ?? false

    for (const trophy of list.trophies) {
      // A Platina é derivada: não dá para marcar aqui, e as oito ficariam
      // encalhadas no topo até cada jogo acabar.
      if (trophy.tier === 'platinum' || trophy.id in earned) continue
      items.push({ trophy, game: list.game, reveal })
    }

    for (const pack of list.dlc ?? []) {
      for (const trophy of pack.trophies) {
        if (trophy.tier === 'platinum' || trophy.id in earned) continue
        items.push({ trophy, game: list.game, pack: pack.name, reveal })
      }
    }
  }

  return items
}

/** Em qual bloco o item cai, conforme a ordenação escolhida. */
function groupOf(item: Item, sort: SortKey): string {
  switch (sort) {
    case 'game':
      return item.game.title
    case 'tier':
      return `${TIER_ICON[item.trophy.tier]} ${TIER_LABEL[item.trophy.tier]}`
    case 'platform':
      return item.game.targetPlatform
    case 'name':
      // Ordem alfabética pura não pede cabeçalho.
      return ''
  }
}

function compare(a: Item, b: Item, sort: SortKey): number {
  if (sort === 'tier') {
    const byTier = TIERS.indexOf(a.trophy.tier) - TIERS.indexOf(b.trophy.tier)
    if (byTier !== 0) return byTier
  } else if (sort === 'name') {
    return a.trophy.name.localeCompare(b.trophy.name, 'pt-BR')
  } else {
    const byGroup = groupOf(a, sort).localeCompare(groupOf(b, sort), 'pt-BR')
    if (byGroup !== 0) return byGroup
  }

  // Dentro do bloco, o ID preserva a ordem original da lista do jogo.
  return a.trophy.id.localeCompare(b.trophy.id)
}

export function PendingPage() {
  const state = useProgress()
  const { data, error, loading } = useAsync(
    () => loadCatalog().then((c) => Promise.all(c.games.map((g) => loadGame(g.slug)))),
    [],
  )

  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<Tier | 'all'>('all')
  const [missable, setMissable] = useState(false)
  const [withDlc, setWithDlc] = useState(true)
  const [sort, setSort] = useState<SortKey>('game')

  const items = collect(data ?? [], state.games)

  const visible = items
    .filter((item) => {
      if (!withDlc && item.pack) return false
      if (tier !== 'all' && item.trophy.tier !== tier) return false
      if (missable && !item.trophy.missable) return false

      if (query) {
        // Secreto ainda oculto só casa por ID: buscar pelo nome devolveria o
        // spoiler que o modo oculto existe para evitar.
        const hidden = item.trophy.secret && !item.reveal
        const haystack = hidden
          ? item.trophy.id
          : `${item.trophy.name} ${item.trophy.description} ${item.trophy.id}`
        if (!normalize(haystack).includes(normalize(query))) return false
      }

      return true
    })
    .sort((a, b) => compare(a, b, sort))

  // Só os tiers que existem entre os pendentes viram chip.
  const tiersPresentes = TIERS.filter((t) => t !== 'platinum' && items.some((i) => i.trophy.tier === t))

  let lastGroup: string | null = null

  return (
    <>
      <header className="header">
        <div className="header__titles">
          <h1>Pendentes</h1>
          <p className="header__sub">
            {loading ? 'Carregando…' : `${visible.length} de ${items.length} troféus a conquistar`}
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

        <div className="stack">
          <input
            className="input"
            type="search"
            placeholder="Buscar troféu…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <div className="chip-grid">
            {SORT_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={sort === value ? 'chip-option is-active' : 'chip-option'}
                onClick={() => setSort(value)}
                aria-pressed={sort === value}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="chip-grid">
            {tiersPresentes.map((value) => (
              <button
                key={value}
                type="button"
                className={tier === value ? 'chip-option is-active' : 'chip-option'}
                onClick={() => setTier(tier === value ? 'all' : value)}
                title={TIER_LABEL[value]}
                aria-label={`Filtrar por ${TIER_LABEL[value]}`}
                aria-pressed={tier === value}
              >
                {TIER_ICON[value]}
              </button>
            ))}
            <button
              type="button"
              className={missable ? 'chip-option is-active' : 'chip-option'}
              onClick={() => setMissable(!missable)}
              aria-pressed={missable}
            >
              ⚠️ Perdíveis
            </button>
            <button
              type="button"
              className={withDlc ? 'chip-option is-active' : 'chip-option'}
              onClick={() => setWithDlc(!withDlc)}
              aria-pressed={withDlc}
            >
              📦 DLC
            </button>
          </div>
        </div>

        {!loading && !error && visible.length === 0 && (
          <div className="empty">
            <div className="empty__icon">{items.length === 0 ? '💎' : '🔍'}</div>
            <p className="empty__title">
              {items.length === 0 ? 'Nada pendente' : 'Nenhum troféu com esses filtros'}
            </p>
            {items.length === 0 && <p className="hint">Você conquistou tudo que há para conquistar.</p>}
          </div>
        )}

        <div className="trophy-list" style={{ marginTop: 16 }}>
          {visible.map((item) => {
            const group = groupOf(item, sort)
            const header = group && group !== lastGroup ? group : null
            lastGroup = group

            // Na ordenação por jogo o cabeçalho já diz de onde veio.
            const origem = [sort === 'game' ? null : item.game.title, item.pack]
              .filter(Boolean)
              .join(' · ')

            return (
              <div key={`${item.game.slug}-${item.trophy.id}`}>
                {header && <h2 className="section-title">{header}</h2>}
                <TrophyRow
                  trophy={item.trophy}
                  reveal={item.reveal}
                  subtitle={origem || undefined}
                  onToggle={() => toggleTrophy(item.game.slug, item.trophy.id)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
