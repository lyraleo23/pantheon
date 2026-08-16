import { useRef, useState } from 'react'
import { loadCatalog } from '../data/catalog'
import { useAsync } from '../hooks/useAsync'
import { clearAll, replaceState, useProgress, type ProgressState } from '../store/progress'
import { downloadBackup, parseBackup, summarise } from '../store/backup'
import { catalogProgress } from '../lib/stats'
import { EMPTY_GAME } from '../store/progress'
import { formatDate } from '../lib/format'
import { Modal } from '../components/Modal'

export function SettingsPage() {
  const { data } = useAsync(() => loadCatalog(), [])
  const state = useProgress()
  const fileInput = useRef<HTMLInputElement>(null)

  const [pending, setPending] = useState<ProgressState | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function handleFile(file: File) {
    try {
      setPending(parseBackup(await file.text()))
      setMessage(null)
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message })
    }
  }

  function applyImport() {
    if (!pending) return
    const { games, trophies } = summarise(pending)
    replaceState(pending)
    setPending(null)
    setMessage({ kind: 'ok', text: `Backup restaurado: ${games} jogos, ${trophies} troféus.` })
  }

  const mine = summarise(state)
  const platinums = (data?.games ?? []).filter(
    (entry) => catalogProgress(entry, state.games[entry.slug] ?? EMPTY_GAME).complete,
  ).length

  return (
    <>
      <header className="header">
        <div className="header__titles">
          <h1>Ajustes</h1>
        </div>
      </header>

      <div className="page">
        <h2 className="section-title">Seu progresso</h2>
        <section className="card">
          <p style={{ margin: 0 }}>
            {mine.trophies} troféus marcados em {mine.games} jogos · {platinums} platinas
          </p>
          <p className="hint" style={{ marginBottom: 0 }}>
            O progresso fica guardado neste aparelho. Para levar para outro, exporte aqui e importe lá.
          </p>
        </section>

        <h2 className="section-title">Backup</h2>
        <div className="stack">
          <button type="button" className="btn btn--block" onClick={downloadBackup}>
            Exportar backup
          </button>
          <button
            type="button"
            className="btn btn--block"
            onClick={() => fileInput.current?.click()}
          >
            Importar backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              // Zera o input: escolher o mesmo arquivo de novo precisa disparar.
              event.target.value = ''
              if (file) void handleFile(file)
            }}
          />

          {message && (
            <p
              className="hint"
              style={{ color: message.kind === 'error' ? 'var(--danger)' : 'var(--accent)' }}
            >
              {message.text}
            </p>
          )}
        </div>

        <h2 className="section-title">Zona de perigo</h2>
        <button
          type="button"
          className="btn btn--danger btn--block"
          onClick={() => setConfirmClear(true)}
          disabled={mine.games === 0}
        >
          Apagar todo o progresso
        </button>

        <h2 className="section-title">Sobre</h2>
        <section className="card">
          <p className="hint" style={{ marginTop: 0 }}>
            Listas do Pantheon geradas em{' '}
            {data ? formatDate(Date.parse(data.generatedAt)) : '—'} ·{' '}
            {data?.games.length ?? 0} jogos.
          </p>
          <p className="hint" style={{ marginBottom: 0 }}>
            As listas vêm de <code>games/</code> no repositório. Para incluir um jogo novo, gere a
            lista com <code>/pantheon</code> e publique.
          </p>
        </section>
      </div>

      {pending && (
        <Modal
          title="Substituir o progresso atual?"
          confirmLabel="Substituir"
          danger
          onCancel={() => setPending(null)}
          onConfirm={applyImport}
        >
          <p style={{ marginTop: 0 }}>
            O backup tem {summarise(pending).trophies} troféus em {summarise(pending).games} jogos.
          </p>
          <p className="hint" style={{ marginBottom: 0 }}>
            Isso descarta o que está neste aparelho hoje ({mine.trophies} troféus em {mine.games}{' '}
            jogos).
          </p>
        </Modal>
      )}

      {confirmClear && (
        <Modal
          title="Apagar todo o progresso?"
          confirmLabel="Apagar"
          danger
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearAll()
            setConfirmClear(false)
            setMessage({ kind: 'ok', text: 'Progresso apagado.' })
          }}
        >
          <p className="hint" style={{ margin: 0 }}>
            Some com {mine.trophies} troféus marcados. Não dá para desfazer — exporte um backup
            antes se tiver dúvida.
          </p>
        </Modal>
      )}
    </>
  )
}
