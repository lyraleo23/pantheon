import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  children?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

/** Confirmação para o que não dá para desfazer: importar backup e limpar dados. */
export function Modal({ title, children, confirmLabel, onConfirm, onCancel, danger }: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // Só o fundo fecha; um clique dentro do cartão não pode cancelar.
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div className="modal">
        <h2 className="modal__title">{title}</h2>
        {children}
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
