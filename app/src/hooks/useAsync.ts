import { useEffect, useState } from 'react'

interface AsyncState<T> {
  data?: T
  error?: Error
  loading: boolean
}

/**
 * Consome uma promessa memorizada em `data/catalog.ts`. Deliberadamente sem
 * Suspense: são dois carregamentos no app inteiro e um estado de erro visível
 * poupa uma error boundary só para dizer "não carregou".
 */
export function useAsync<T>(factory: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true })

  useEffect(() => {
    let active = true
    setState({ loading: true })

    factory().then(
      (data) => active && setState({ data, loading: false }),
      (error: unknown) => {
        if (!active) return
        setState({ error: error instanceof Error ? error : new Error(String(error)), loading: false })
      },
    )

    return () => {
      active = false
    }
    // A fábrica é recriada a cada render; quem manda são as deps de quem chama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
