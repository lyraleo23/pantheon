import { getState, type GameProgress, type ProgressState } from './progress'
import { getPrefs, type Prefs } from './prefs'

/**
 * O progresso mora no aparelho, então o backup é a única ponte entre o celular
 * e o navegador do PC. Formato próprio e versionado para dar erro claro quando
 * alguém escolher o arquivo errado.
 */

const FORMAT = 'pantheon-progress-backup'
const VERSION = 1

export interface Backup {
  format: typeof FORMAT
  version: number
  exportedAt: string
  progress: ProgressState
  /** Opcional: backup gerado antes das preferências existirem não tem. */
  prefs?: Prefs
}

export function buildBackup(): Backup {
  return {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    progress: getState(),
    prefs: getPrefs(),
  }
}

export function downloadBackup() {
  const blob = new Blob([JSON.stringify(buildBackup(), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `pantheon-progresso-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function isEarnedMap(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object') return false
  return Object.values(value).every((at) => typeof at === 'number')
}

export interface ParsedBackup {
  progress: ProgressState
  prefs?: Prefs
}

/** Lança com mensagem legível: é o que a tela mostra quando o arquivo não serve. */
export function parseBackup(text: string): ParsedBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('O arquivo não é um JSON válido.')
  }

  const backup = parsed as Partial<Backup>
  if (backup.format !== FORMAT) {
    throw new Error('Este arquivo não é um backup do Pantheon.')
  }
  if (typeof backup.version !== 'number' || backup.version > VERSION) {
    throw new Error('Backup gerado por uma versão mais nova do app.')
  }

  const games = backup.progress?.games
  if (!games || typeof games !== 'object') {
    throw new Error('O backup não tem progresso dentro.')
  }

  const clean: Record<string, GameProgress> = {}
  for (const [slug, game] of Object.entries(games)) {
    if (!game || !isEarnedMap(game.earned)) {
      throw new Error(`Progresso inválido para "${slug}".`)
    }
    clean[slug] = {
      earned: game.earned,
      startedAt: typeof game.startedAt === 'number' ? game.startedAt : undefined,
      revealSecrets: game.revealSecrets === true ? true : undefined,
    }
  }

  // As preferências são acessório: `replacePrefs` descarta o que não reconhece,
  // então um arquivo sem elas — ou com lixo — importa o progresso do mesmo jeito.
  return { progress: { version: 1, games: clean }, prefs: backup.prefs }
}

/** Resumo mostrado na confirmação, antes de sobrescrever o que já existe. */
export function summarise(state: ProgressState): { games: number; trophies: number } {
  const entries = Object.values(state.games)
  return {
    games: entries.length,
    trophies: entries.reduce((sum, game) => sum + Object.keys(game.earned).length, 0),
  }
}
