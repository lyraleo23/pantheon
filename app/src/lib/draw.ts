import type { Tier } from '../data/types'
import type { PendingItem } from './pending'

/** Quantos troféus de cada tier o sorteio tenta reunir. */
export const DRAW_TARGETS: Record<'bronze' | 'silver' | 'gold', number> = {
  bronze: 20,
  silver: 10,
  gold: 5,
}

export interface DrawResult {
  tier: Tier
  items: PendingItem[]
  /** Quantos existiam no total antes do corte — para avisar quando faltou pool. */
  available: number
}

/**
 * FNV-1a: rápido e determinístico, não precisa ser criptográfico — só bem
 * distribuído o bastante para o sorteio não seguir a ordem alfabética.
 */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 0x100000000
}

/** Chave do dia local do jogador — o sorteio muda à meia-noite dele, não em UTC. */
export function todaySeed(): string {
  const now = new Date()
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
}

/** Uma semente nova a cada chamada — usada pelo botão de sortear de novo. */
export function randomSeed(): string {
  return Math.random().toString(36).slice(2)
}

function pickTier(pool: PendingItem[], count: number, seed: string): PendingItem[] {
  const ranked = pool
    .map((item) => ({
      item,
      rank: hash(`${seed}:${item.game.slug}:${item.trophy.id}`),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.item)

  const chosen: PendingItem[] = []
  const usedGames = new Set<string>()

  // 1ª passada: no máximo um troféu por jogo, para o sorteio não virar um só jogo.
  for (const item of ranked) {
    if (chosen.length >= count) break
    if (usedGames.has(item.game.slug)) continue
    chosen.push(item)
    usedGames.add(item.game.slug)
  }

  // Os jogos com pendente acabaram antes da meta: aí repetir jogo é esperado.
  if (chosen.length < count) {
    const chosenKeys = new Set(chosen.map((i) => `${i.game.slug}:${i.trophy.id}`))
    for (const item of ranked) {
      if (chosen.length >= count) break
      const key = `${item.game.slug}:${item.trophy.id}`
      if (chosenKeys.has(key)) continue
      chosen.push(item)
      chosenKeys.add(key)
    }
  }

  return chosen
}

/** Um sorteio por tier, a partir do que ainda está pendente. */
export function draw(pending: PendingItem[], seed: string): DrawResult[] {
  return (Object.entries(DRAW_TARGETS) as [Tier, number][]).map(([tier, count]) => {
    const pool = pending.filter((item) => item.trophy.tier === tier)
    return { tier, items: pickTier(pool, count, seed), available: pool.length }
  })
}
