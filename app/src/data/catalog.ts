import type { Catalog, TrophyList } from './types'

// BASE_URL é '/' em dev e '/pantheon/' no GitHub Pages. Caminho absoluto sem
// ele quebraria em produção; relativo quebraria nas rotas internas.
const DATA = `${import.meta.env.BASE_URL}data/`

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new Error(`${response.status} ao carregar ${path}`)
  return (await response.json()) as T
}

// Os dados são estáticos e cabem na memória: uma vez baixados, ficam. Guardar a
// promessa, e não o resultado, evita duas requisições simultâneas do mesmo jogo.
let catalogPromise: Promise<Catalog> | undefined
const listPromises = new Map<string, Promise<TrophyList>>()

export function loadCatalog(): Promise<Catalog> {
  catalogPromise ??= fetchJson<Catalog>(`${DATA}catalog.json`).catch((error) => {
    // Sem isso um erro de rede ficaria memorizado para sempre.
    catalogPromise = undefined
    throw error
  })
  return catalogPromise
}

export function loadGame(slug: string): Promise<TrophyList> {
  let promise = listPromises.get(slug)
  if (!promise) {
    promise = fetchJson<TrophyList>(`${DATA}games/${slug}.json`).catch((error) => {
      listPromises.delete(slug)
      throw error
    })
    listPromises.set(slug, promise)
  }
  return promise
}
