import type { GameMeta, Trophy, TrophyList, TrophyType } from '../data/types'
import { EMPTY_GAME, type GameProgress } from '../store/progress'
import { normalize } from './format'

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
  startedOnly: boolean
  missable: boolean
  types: TrophyType[]
  /** IDs de `PLATFORMS`. */
  platforms: string[]
}

export const DEFAULT_FILTERS: DrawFilters = {
  dlc: true,
  startedOnly: false,
  missable: false,
  types: [],
  platforms: [],
}

/**
 * `targetPlatform` é texto livre ("Nintendo Switch / Nintendo Switch 2", e uma
 * string de duas linhas no Hyrule Warriors), então o console sai de um casamento
 * por padrão, não de igualdade. O lookahead do Switch é o que importa: sem ele,
 * "switch" casaria com "Nintendo Switch 2", que não roda no Switch 1.
 *
 * Um jogo pode casar com mais de um console — e deve: Breath of the Wild é
 * Switch e Switch 2, Hyrule Warriors é Wii U e Switch.
 */
export const PLATFORMS: { id: string; label: string; match: RegExp }[] = [
  { id: 'switch', label: 'Switch', match: /switch(?! 2)/ },
  { id: 'switch2', label: 'Switch 2', match: /switch 2/ },
  { id: 'wiiu', label: 'Wii U', match: /wii u/ },
]

/** Recorta o pool de pendentes conforme os filtros escolhidos no sorteio. */
export function filterPending(
  items: PendingItem[],
  filters: DrawFilters,
  games: Record<string, GameProgress>,
): PendingItem[] {
  return items.filter((item) => {
    if (!filters.dlc && item.pack) return false
    if (filters.missable && !item.trophy.missable) return false
    if (filters.startedOnly && !games[item.game.slug]?.startedAt) return false
    if (filters.types.length > 0 && !filters.types.includes(item.trophy.type)) return false

    if (filters.platforms.length > 0) {
      const target = normalize(item.game.targetPlatform)
      const casa = PLATFORMS.some((p) => filters.platforms.includes(p.id) && p.match.test(target))
      if (!casa) return false
    }

    return true
  })
}
