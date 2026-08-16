import type { Origin, Tier, TrophyType } from '../data/types'

export const TIERS: Tier[] = ['bronze', 'silver', 'gold', 'platinum']

export const TIER_ICON: Record<Tier, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
}

export const TIER_LABEL: Record<Tier, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  platinum: 'Platina',
}

export const TYPE_LABEL: Record<TrophyType, string> = {
  story: 'História',
  exploration: 'Exploração',
  challenge: 'Desafio',
  collection: 'Coleção',
  sidequest: 'Missão secundária',
  boss: 'Chefe',
  mechanic: 'Mecânica',
  minigame: 'Minijogo',
  postgame: 'Pós-jogo',
  multiplayer: 'Multijogador',
}

export const ORIGIN_LABEL: Record<Origin, string> = {
  original: 'Original',
  'native-steam': 'Steam',
  'native-playstation': 'PlayStation',
  'native-xbox': 'Xbox',
  'native-other': 'Nativo',
}

export const STATUS_LABEL: Record<'draft' | 'audited' | 'approved', string> = {
  draft: 'rascunho',
  audited: 'auditada',
  approved: 'aprovada',
}
