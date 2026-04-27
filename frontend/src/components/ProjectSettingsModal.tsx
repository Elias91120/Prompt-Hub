import { useEffect, useState } from 'react'
import { X, Loader2, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Project, ProjectCreate } from '../types'
import { updateProject } from '../api'

interface Props {
  project: Project
  open: boolean
  onClose: () => void
  onProjectUpdated: (project: Project) => void
}

export default function ProjectSettingsModal({ project, open, onClose, onProjectUpdated }: Props) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [objective, setObjective] = useState(project.objective)
  const [stack, setStack] = useState(project.stack || '')
  const [constraints, setConstraints] = useState(project.constraints || '')
  const [decisionsLog, setDecisionsLog] = useState(project.decisions_log || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Reset form when project changes
  useEffect(() => {
    setName(project.name)
    setDescription(project.description)
    setObjective(project.objective)
    setStack(project.stack || '')
    setConstraints(project.constraints || '')
    setDecisionsLog(project.decisions_log || '')
  }, [project, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const data: ProjectCreate = {
        name,
        description,
        objective,
        constraints: constraints || null,
        stack: stack || null,
        decisions_log: decisionsLog || null,
      }
      const updated = await updateProject(project.id, data)
      onProjectUpdated(updated)
      onClose()
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
                  <Settings className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold tracking-tight">
                    Paramètres du projet
                  </h2>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    Modifiez le contexte, la stack et les règles du projet.
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="icon-btn" title="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Nom du projet" required>
                <input
                  required
                  className="input-field"
                  placeholder="Mon super projet"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label="Description" required>
                <textarea
                  required
                  rows={2}
                  className="textarea-field"
                  placeholder="Que fait ce projet ?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Field>
              <Field label="Objectif" required>
                <input
                  required
                  className="input-field"
                  placeholder="L'objectif principal"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Stack" hint="optionnel">
                  <input
                    className="input-field"
                    placeholder="React + FastAPI"
                    value={stack}
                    onChange={(e) => setStack(e.target.value)}
                  />
                </Field>
                <Field label="Contraintes" hint="optionnel">
                  <input
                    className="input-field"
                    placeholder="Budget, deadlines…"
                    value={constraints}
                    onChange={(e) => setConstraints(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Règles / Palette / Décisions techniques" hint="markdown">
                <textarea
                  rows={3}
                  className="textarea-field"
                  placeholder="Ex: Palette de couleurs: Vert émeraude. Règles: Toujours utiliser pnpm..."
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
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <Settings className="h-4 w-4" />
                      Enregistrer
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
