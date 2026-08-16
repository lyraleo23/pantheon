/**
 * Espelho de `schema/trophy_list.schema.json`. O schema continua sendo a fonte
 * da verdade — se ele mudar, estes tipos mudam junto.
 */

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum'

export type TrophyType =
  | 'story'
  | 'exploration'
  | 'challenge'
  | 'collection'
  | 'sidequest'
  | 'boss'
  | 'mechanic'
  | 'minigame'
  | 'postgame'
  | 'multiplayer'

export type Origin =
  | 'original'
  | 'native-steam'
  | 'native-playstation'
  | 'native-xbox'
  | 'native-other'

export interface Trophy {
  id: string
  name: string
  description: string
  tier: Tier
  type: TrophyType
  /** Regra 1: onde o jogador confirma, dentro do jogo, que cumpriu. */
  verification: string
  missable: boolean
  secret: boolean
  origin: Origin
  originId?: string
  notes?: string
}

/** Regra 14: pacote de DLC nunca entra na conta da Platina base. */
export interface DlcPack {
  name: string
  trophies: Trophy[]
}

export interface GameMeta {
  title: string
  slug: string
  code: string
  targetPlatform: string
  mode: 'genesis' | 'port'
  sourcePlatform?: string
  nativeCount?: number
  developer?: string
  publisher?: string
  genre?: string
  releaseYear?: number
  estimatedDifficulty?: number
  estimatedHours?: string
  listVersion: string
  rulesetVersion: string
  status?: 'draft' | 'audited' | 'approved'
  notes?: string
}

export interface TrophyList {
  game: GameMeta
  trophies: Trophy[]
  dlc?: DlcPack[]
  excluded?: { originId: string; reason: string; rule?: number }[]
}

/** Uma linha do `catalog.json`, gerado por `scripts/build-catalog.mjs`. */
export interface CatalogEntry {
  /** Só os não-platinum: a Platina é derivada e viaja em `platinumId`. */
  trophyIds: string[]
  platinumId: string | null
  slug: string
  title: string
  code: string
  targetPlatform: string
  mode: 'genesis' | 'port'
  status: 'draft' | 'audited' | 'approved'
  developer?: string
  genre?: string
  releaseYear?: number
  estimatedDifficulty?: number
  estimatedHours?: string
  listVersion: string
  total: number
  counts: Record<Tier, number>
  dlcPacks: number
  dlcTotal: number
}

export interface Catalog {
  generatedAt: string
  games: CatalogEntry[]
}
