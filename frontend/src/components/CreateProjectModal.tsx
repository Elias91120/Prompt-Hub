import { useEffect, useState } from 'react'
import { X, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { ProjectCreate } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSubmit: (data: ProjectCreate) => Promise<void> | void
}

export default function CreateProjectModal({ open, onClose, onSubmit }: Props) {
  const { t } = useTranslation('editor')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [objective, setObjective] = useState('')
  const [stack, setStack] = useState('')
  const [constraints, setConstraints] = useState('')
  const [decisionsLog, setDecisionsLog] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name,
        description,
        objective,
        constraints: constraints || null,
        stack: stack || null,
        decisions_log: decisionsLog || null,
      })
      // Reset on success
      setName('')
      setDescription('')
      setObjective('')
      setStack('')
      setConstraints('')
      setDecisionsLog('')
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="surface-card relative w-full max-w-xl p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="kpi-icon">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    {t('createProject.title')}
                  </h2>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t('createProject.subtitle')}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="icon-btn" title={t('createProject.close')}>
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label={t('createProject.fields.name')} required>
                <input
                  required
                  className="input-field"
                  placeholder={t('createProject.fields.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t('createProject.fields.description')} required>
                <textarea
                  required
                  rows={2}
                  className="textarea-field"
                  placeholder={t('createProject.fields.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field label={t('createProject.fields.objective')} required>
                <input
                  required
                  className="input-field"
                  placeholder={t('createProject.fields.objectivePlaceholder')}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('createProject.fields.stack')} hint={t('createProject.fields.optional')}>
                  <input
                    className="input-field"
                    placeholder={t('createProject.fields.stackPlaceholder')}
                    value={stack}
                    onChange={(e) => setStack(e.target.value)}
                  />
                </Field>
                <Field label={t('createProject.fields.constraints')} hint={t('createProject.fields.optional')}>
                  <input
                    className="input-field"
                    placeholder={t('createProject.fields.constraintsPlaceholder')}
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                  />
                </Field>
              </div>
              <Field label={t('createProject.fields.decisions')} hint={t('createProject.fields.optionalMarkdown')}>
                <textarea
                  rows={3}
                  className="textarea-field"
                  placeholder={t('createProject.fields.decisionsPlaceholder')}
                  value={decisionsLog}
                  onChange={(e) => setDecisionsLog(e.target.value)}
                />
              </Field>

              {error && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-ghost"
                  disabled={submitting}
                >
                  {t('createProject.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('createProject.submitting')}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t('createProject.submit')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-2 text-[11px] font-medium text-[var(--color-text-secondary)]">
        {label}
        {required && <span className="text-[var(--color-accent)]">*</span>}
        {hint && (
          <span className="text-[var(--color-text-tertiary)]">· {hint}</span>
        )}
      </span>
      {children}
    </label>
  )
}
