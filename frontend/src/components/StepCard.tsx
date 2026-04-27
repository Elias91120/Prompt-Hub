import type { Step } from '../types'

const STATUS_CONFIG: Record<Step['status'], { dot: string; label: string; bg: string }> = {
  not_started: { dot: 'bg-neutral-500', label: 'Todo', bg: 'bg-neutral-500/10 text-neutral-400' },
  in_progress: {
    dot: 'bg-[var(--color-accent)]',
    label: 'In Progress',
    bg: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
  },
  completed: { dot: 'bg-emerald-400', label: 'Done', bg: 'bg-emerald-400/10 text-emerald-400' },
  replanned: { dot: 'bg-amber-400', label: 'Replanned', bg: 'bg-amber-400/10 text-amber-400' },
}

const TYPE_CONFIG: Record<Step['step_type'], { label: string; color: string }> = {
  frontend: { label: 'Frontend', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' },
  backend: { label: 'Backend', color: 'text-violet-400 bg-violet-400/10 border-violet-400/20' },
  infra: { label: 'Infra', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  other: { label: 'Other', color: 'text-neutral-400 bg-neutral-400/10 border-neutral-400/20' },
}

interface Props {
  step: Step
  selected: boolean
  onSelect: (step: Step) => void
}

export default function StepCard({ step, selected, onSelect }: Props) {
  const status = STATUS_CONFIG[step.status]
  const type = TYPE_CONFIG[step.step_type]

  return (
    <button
      type="button"
      onClick={() => onSelect(step)}
      className={`group w-full rounded-xl border p-4 text-left transition-all duration-150 ${
        selected
          ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 shadow-[0_0_0_1px_var(--color-accent)20]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)]'
      }`}
    >
      {/* Status dot + title */}
      <div className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${status.dot}`}
          title={status.label}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-[var(--color-text-primary)]">
            {step.name}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
            {step.objective}
          </p>
        </div>
      </div>

      {/* Footer: badges */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${type.color}`}
        >
          {type.label}
        </span>
        {step.status !== 'not_started' && (
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${status.bg}`}>
            {status.label}
          </span>
        )}
        {step.sub_steps.length > 0 && (
          <span className="ml-auto text-xs tabular-nums text-[var(--color-text-tertiary)]">
            {step.sub_steps.filter((s) => s.status === 'completed').length}/{step.sub_steps.length}{' '}
            sub-steps
          </span>
        )}
      </div>
    </button>
  )
}
