import type { GameMeta, Trophy, TrophyList } from '../data/types'
import { EMPTY_GAME, type GameProgress } from '../store/progress'

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
