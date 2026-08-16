import { useSyncExternalStore } from 'react'

/**
 * O progresso do jogador. Fica no `localStorage` do aparelho — o celular e o
 * navegador do PC são contagens independentes, e a ponte entre eles é o backup
 * em Ajustes.
 *
 * A chave é sempre `game.slug` + `trophy.id`, nunca a posição na lista: assim
 * uma revisão da lista degrada bem. ID que sumiu vira órfão ignorado, ID novo
 * nasce pendente.
 */

const KEY = 'pantheon-progress-v1'

export interface GameProgress {
  /** ID do troféu → quando foi obtido. IDs de DLC convivem aqui. */
  earned: Record<string, number>
  startedAt?: number
  /** Revelar todos os secretos deste jogo. */
  revealSecrets?: boolean
}

export interface ProgressState {
  version: 1
  games: Record<string, GameProgress>
}

/** Referência estável: jogo nunca aberto não pode gerar objeto novo a cada render. */
const EMPTY_EARNED: Record<string, number> = {}
export const EMPTY_GAME: GameProgress = Object.freeze({ earned: EMPTY_EARNED })

const EMPTY_STATE: ProgressState = { version: 1, games: {} }

function read(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_STATE

    const parsed = JSON.parse(raw) as Partial<ProgressState>
    if (!parsed || typeof parsed !== 'object' || !parsed.games) return EMPTY_STATE
    return { version: 1, games: parsed.games }
  } catch {
    // Storage corrompido ou bloqueado não pode impedir o app de abrir.
    return EMPTY_STATE
  }
}

let state = read()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function commit(next: ProgressState) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Modo privado do Safari e afins: o app segue funcionando na sessão.
  }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): ProgressState {
  return state
}

// Outra aba do mesmo navegador escreveu: adota o que está no disco.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    state = read()
    emit()
  })
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export function useGameProgress(slug: string): GameProgress {
  return useProgress().games[slug] ?? EMPTY_GAME
}

function update(slug: string, change: (game: GameProgress) => GameProgress) {
  const current = state.games[slug] ?? EMPTY_GAME
  commit({ ...state, games: { ...state.games, [slug]: change(current) } })
}

export function toggleTrophy(slug: string, id: string) {
  update(slug, (game) => {
    const earned = { ...game.earned }
    if (id in earned) {
      delete earned[id]
    } else {
      earned[id] = Date.now()
    }
    return { ...game, earned, startedAt: game.startedAt ?? Date.now() }
  })
}

export function setRevealSecrets(slug: string, reveal: boolean) {
  update(slug, (game) => ({ ...game, revealSecrets: reveal }))
}

export function clearGame(slug: string) {
  const games = { ...state.games }
  delete games[slug]
  commit({ ...state, games })
}

export function clearAll() {
  commit({ version: 1, games: {} })
}

export function getState(): ProgressState {
  return state
}

export function replaceState(next: ProgressState) {
  commit(next)
}
