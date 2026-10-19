import type { GameMeta, Trophy, TrophyList, TrophyType } from '../data/types'
import { EMPTY_GAME, shelfOf, type GameProgress } from '../store/progress'
import { matchesPlatforms } from './platforms'

/** Um troféu pendente já carregando o jogo de onde veio. */
export interface PendingItem {
  trophy: Trophy
  game: GameMeta
  /** Nome do pacote, quando o troféu é de DLC. */
  pack?: string
  reveal: boolean
}

/**
 * Troféus que ainda não foram obtidos, com a Platina de fora — ela é derivada,
 * não dá para marcar diretamente, e ficaria encalhada até cada jogo terminar.
 */
export function collectPending(
  lists: TrophyList[],
  games: Record<string, GameProgress>,
): PendingItem[] {
  const items: PendingItem[] = []

  for (const list of lists) {
    const progress = games[list.game.slug] ?? EMPTY_GAME
    const earned = progress.earned
    const reveal = progress.revealSecrets ?? false

    for (const trophy of list.trophies) {
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

/** Filtros do sorteio. Lista vazia = sem restrição. */
export interface DrawFilters {
  dlc: boolean
  /** Desligado, os jogos do backlog ficam fora do pool. */
  backlog: boolean
  startedOnly: boolean
  missable: boolean
  types: TrophyType[]
  /** IDs de `PLATFORMS`. */
  platforms: string[]
}

export const DEFAULT_FILTERS: DrawFilters = {
  dlc: true,
  backlog: false,
  startedOnly: false,
  missable: false,
  types: [],
  platforms: [],
}

/** Recorta o pool de pendentes conforme os filtros escolhidos no sorteio. */
export function filterPending(
  items: PendingItem[],
  filters: DrawFilters,
  games: Record<string, GameProgress>,
): PendingItem[] {
  return items.filter((item) => {
    if (!filters.dlc && item.pack) return false
    if (!filters.backlog && shelfOf(games[item.game.slug] ?? EMPTY_GAME) === 'backlog') return false
    if (filters.missable && !item.trophy.missable) return false
    if (filters.startedOnly && !games[item.game.slug]?.startedAt) return false
    if (filters.types.length > 0 && !filters.types.includes(item.trophy.type)) return false
    if (!matchesPlatforms(item.game.targetPlatform, filters.platforms)) return false
    return true
  })
}
