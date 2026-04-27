import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ProjectSkill, ProjectSkillCreate, SkillKind, StepType } from '../types'
import { createSkill, deleteSkill, listSkills, updateSkill } from '../api'
import { EmptyState } from './ui'

interface Props {
  projectId: string
  onClose: () => void
  /** Bumped when an external action might have changed the data */
  refreshKey?: number
}

const KIND_OPTIONS: { value: SkillKind; label: string; tone: string }[] = [
  { value: 'convention', label: 'Convention', tone: 'text-sky-400' },
  { value: 'glossary', label: 'Glossary', tone: 'text-violet-400' },
  { value: 'antipattern', label: 'Anti-pattern', tone: 'text-amber-400' },
  { value: 'stack_detail', label: 'Stack detail', tone: 'text-emerald-400' },
  { value: 'other', label: 'Other', tone: 'text-[var(--color-text-tertiary)]' },
]

const APPLIES_OPTIONS: { value: StepType | ''; label: string }[] = [
  { value: '', label: 'All step types' },
  { value: 'frontend', label: 'Frontend only' },
  { value: 'backend', label: 'Backend only' },
  { value: 'infra', label: 'Infra only' },
  { value: 'other', label: 'Other only' },
]

const inputCls =
  'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-accent)]/40 focus:ring-1 focus:ring-[var(--color-accent)]/10 focus:outline-none'

export default function SkillsPanel({ projectId, onClose, refreshKey = 0 }: Props) {
  const { t } = useTranslation('plan')
  const [skills, setSkills] = useState<ProjectSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProjectSkill | 'new' | null>(null)

  function reload() {
    setLoading(true)
    listSkills(projectId)
      .then(setSkills)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, refreshKey])

  async function handleSave(data: ProjectSkillCreate) {
    try {
      if (editing === 'new') {
        await createSkill(projectId, data)
      } else if (editing) {
        await updateSkill(projectId, editing.id, data)
      }
      setEditing(null)
      reload()
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this skill? It will no longer be injected into prompts.')) return
    try {
      await deleteSkill(projectId, id)
      reload()
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <aside
      role="complementary"
      aria-label="Skills du projet"
      className="fixed inset-0 z-40 flex shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] lg:static lg:z-auto lg:w-[460px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8l3 3 7-7"
                stroke="var(--color-accent)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
              Skills
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Injected into every prompt
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={() => setEditing('new')}
              className="rounded-lg bg-[var(--color-accent)] px-2.5 py-1.5 text-xs font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)]"
            >
              + New
            </button>
          )}
          <button
            onClick={onClose}
          aria-label={t('drawers.closeSkills')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {editing && (
          <SkillEditor
            initial={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSave={handleSave}
          />
        )}

        {!editing && loading && (
          <div className="flex items-center gap-3 py-10">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)]" />
            <p className="text-sm text-[var(--color-text-tertiary)]">Loading skills…</p>
          </div>
        )}

        {!editing && !loading && skills.length === 0 && (
          <EmptyState
            icon={Sparkles}
            title={t('skills.empty.title')}
            description={t('skills.empty.description')}
            action={
              <button
                onClick={() => setEditing('new')}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)]"
              >
                {t('skills.createCta')}
              </button>
            }
          />
        )}

        {!editing && !loading && skills.length > 0 && (
          <ul className="space-y-2">
            {skills.map((sk) => {
              const meta = KIND_OPTIONS.find((k) => k.value === sk.kind) ?? KIND_OPTIONS[0]
              return (
                <li
                  key={sk.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
                        >
                          {meta.label}
                        </span>
                        {sk.applies_to && (
                          <span className="rounded-md bg-[var(--color-surface-hover)] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            {sk.applies_to}
                          </span>
                        )}
                        <span className="text-[9px] tabular-nums text-[var(--color-text-tertiary)]">
                          v{sk.version}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-primary)]">
                        {sk.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-tertiary)]">
                        {sk.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        onClick={() => setEditing(sk)}
                        className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(sk.id)}
                        className="rounded-md px-2 py-0.5 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Inline editor                                                       */
/* ------------------------------------------------------------------ */

function SkillEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: ProjectSkill | null
  onCancel: () => void
  onSave: (data: ProjectSkillCreate) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<SkillKind>(initial?.kind ?? 'convention')
  const [appliesTo, setAppliesTo] = useState<StepType | ''>(initial?.applies_to ?? '')
  const [content, setContent] = useState(initial?.content ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name,
      kind,
      applies_to: appliesTo === '' ? null : (appliesTo as StepType),
      content,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 space-y-3 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-surface)] p-4"
    >
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
        {initial ? 'Edit skill' : 'New skill'}
      </h4>
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Name
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. JWT in HttpOnly cookie"
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Kind
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as SkillKind)}
            className={inputCls}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Applies to
          </label>
          <select
            value={appliesTo}
            onChange={(e) => setAppliesTo(e.target.value as StepType | '')}
            className={inputCls}
          >
            {APPLIES_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Content (markdown)
        </label>
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          placeholder="Describe the rule, convention or anti-pattern. This will be injected into every relevant prompt."
          className={inputCls}
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)]"
        >
          {initial ? 'Save changes' : 'Create skill'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
