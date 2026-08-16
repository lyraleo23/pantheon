import { useSyncExternalStore } from 'react'

/**
 * Preferências de exibição. Mesma mecânica de `progress.ts`, em chave própria:
 * progresso é o que você conquistou, isto é só como você gosta de ver.
 */

const KEY = 'pantheon-prefs-v1'

export type StatusFilter = 'all' | 'pending' | 'earned'

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'earned', label: 'Obtidos' },
]

export interface Prefs {
  version: 1
  /** Com qual filtro a página de um jogo abre. */
  defaultStatus: StatusFilter
}

export const DEFAULT_PREFS: Prefs = Object.freeze({ version: 1, defaultStatus: 'all' })

function isStatus(value: unknown): value is StatusFilter {
  return value === 'all' || value === 'pending' || value === 'earned'
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS

    const parsed = JSON.parse(raw) as Partial<Prefs>
    if (!isStatus(parsed?.defaultStatus)) return DEFAULT_PREFS
    return { version: 1, defaultStatus: parsed.defaultStatus }
  } catch {
    // Storage corrompido ou bloqueado não pode impedir o app de abrir.
    return DEFAULT_PREFS
  }
}

let state = read()
const listeners = new Set<() => void>()

function commit(next: Prefs) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Modo privado do Safari e afins: o app segue funcionando na sessão.
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function snapshot(): Prefs {
  return state
}

// Outra aba do mesmo navegador escreveu: adota o que está no disco.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    state = read()
    for (const listener of listeners) listener()
  })
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export function getPrefs(): Prefs {
  return state
}

export function setDefaultStatus(defaultStatus: StatusFilter) {
  commit({ ...state, defaultStatus })
}

/** Usado pela importação de backup. Ignora o que não reconhece. */
export function replacePrefs(next: Partial<Prefs> | undefined) {
  if (!isStatus(next?.defaultStatus)) return
  commit({ version: 1, defaultStatus: next.defaultStatus })
}
