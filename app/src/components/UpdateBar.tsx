import { useRegisterSW } from 'virtual:pwa-register/react'

/** De quanto em quanto tempo um app deixado aberto procura versão nova. */
const CHECK_INTERVAL = 60 * 60 * 1000

/**
 * Procura versão nova de hora em hora e sempre que o app volta para a frente.
 * O navegador só faz isso sozinho ao abrir uma página, e no iPhone o app
 * instalado fica dias suspenso sem nunca ser aberto do zero.
 */
function watchForUpdates(registration: ServiceWorkerRegistration) {
  const check = () => {
    if (registration.installing || !navigator.onLine) return
    registration.update().catch(() => {})
  }
  setInterval(check, CHECK_INTERVAL)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
}

/**
 * Avisa que há versão nova (lista, desafio ou app) e só troca quando a pessoa
 * pede, em vez de recarregar a página no meio do uso.
 */
export function UpdateBar() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) watchForUpdates(registration)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="update-bar" role="status">
      <span className="update-bar__text">Nova versão disponível.</span>
      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setNeedRefresh(false)}>
        Agora não
      </button>
      <button
        type="button"
        className="btn btn--sm btn--primary"
        onClick={(event) => {
          // A troca leva um instante e termina recarregando a página; o botão
          // travado evita um segundo toque nesse meio-tempo.
          event.currentTarget.disabled = true
          event.currentTarget.textContent = 'Atualizando…'
          void updateServiceWorker()
        }}
      >
        Atualizar
      </button>
    </div>
  )
}
