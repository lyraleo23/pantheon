import type { CatalogEntry, Tier, Trophy } from '../data/types'
import type { GameProgress } from '../store/progress'

import { TIERS } from './labels'

export interface Progress {
  earned: number
  total: number
  percent: number
  complete: boolean
}

export function progress(earned: number, total: number): Progress {
  return {
    earned,
    total,
    percent: total === 0 ? 0 : Math.round((earned / total) * 100),
    complete: total > 0 && earned === total,
  }
}

/**
 * A Platina não é marcável: ela acende sozinha quando todos os outros troféus
 * da lista base foram obtidos. DLC nunca conta (Regra 14).
 */
export function platinumUnlocked(ids: string[], earned: Record<string, number>): boolean {
  return ids.length > 0 && ids.every((id) => id in earned)
}

/** Quando a Platina acendeu: o instante do último troféu que faltava. */
export function platinumEarnedAt(
  ids: string[],
  earned: Record<string, number>,
): number | undefined {
  if (!platinumUnlocked(ids, earned)) return undefined
  return Math.max(...ids.map((id) => earned[id] ?? 0))
}

/**
 * Progresso da tela inicial, calculado só com o catálogo — sem baixar a lista
 * inteira do jogo. IDs órfãos de uma revisão antiga ficam de fora sozinhos,
 * porque a contagem parte dos IDs do catálogo e não das chaves salvas.
 */
export function catalogProgress(entry: CatalogEntry, game: GameProgress): Progress {
  const base = entry.trophyIds.filter((id) => id in game.earned).length
  const platinum = entry.platinumId && platinumUnlocked(entry.trophyIds, game.earned) ? 1 : 0
  return progress(base + platinum, entry.total)
}

export interface ListStats {
  overall: Progress
  byTier: Record<Tier, Progress>
}

/** Progresso da lista base aberta, com a quebra por tier. */
export function listStats(trophies: Trophy[], earned: Record<string, number>): ListStats {
  const ids = trophies.filter((t) => t.tier !== 'platinum').map((t) => t.id)
  const unlocked = platinumUnlocked(ids, earned)

  const byTier = {} as Record<Tier, Progress>
  let total = 0
  let count = 0

  for (const tier of TIERS) {
    const group = trophies.filter((t) => t.tier === tier)
    const got =
      tier === 'platinum'
        ? group.filter(() => unlocked).length
        : group.filter((t) => t.id in earned).length

    byTier[tier] = progress(got, group.length)
    total += group.length
    count += got
  }

  return { overall: progress(count, total), byTier }
}

/** Progresso de um pacote de DLC, sempre isolado da Platina. */
export function packProgress(trophies: Trophy[], earned: Record<string, number>): Progress {
  return progress(trophies.filter((t) => t.id in earned).length, trophies.length)
}
