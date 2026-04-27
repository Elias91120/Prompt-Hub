import { Handle, Position } from '@xyflow/react'
import type { JSX } from 'react'
import type { NodeProps, Node } from '@xyflow/react'
import type { StepNodeData } from '../../lib/planGraph'
import type { StepStatus, StepType } from '../../types'
import { paletteFor } from './phasePalette'

type Props = NodeProps<Node<StepNodeData, 'step'>>

const STATUS_DOT: Record<StepStatus, string> = {
  not_started: 'bg-neutral-500',
  in_progress: 'bg-[var(--color-accent)] step-dot-pulse',
  completed: 'bg-emerald-400',
  replanned: 'bg-amber-400',
}

const STATUS_LABEL: Record<StepStatus, string> = {
  not_started: 'Todo',
  in_progress: 'In Progress',
  completed: 'Done',
  replanned: 'Replanned',
}

const TYPE_META: Record<StepType, { icon: JSX.Element; tint: string; tintBg: string; label: string }> = {
  frontend: {
    label: 'FE',
    tint: '#60a5fa',
    tintBg: 'rgba(96, 165, 250, 0.10)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <path d="M5 13h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  backend: {
    label: 'BE',
    tint: '#c084fc',
    tintBg: 'rgba(192, 132, 252, 0.10)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <ellipse cx="8" cy="4" rx="5" ry="2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" stroke="currentColor" strokeWidth="1.4" />
        <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  infra: {
    label: 'INFRA',
    tint: '#fbbf24',
    tintBg: 'rgba(251, 191, 36, 0.10)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
        <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  other: {
    label: 'OTHER',
    tint: '#9ca3af',
    tintBg: 'rgba(156, 163, 175, 0.10)',
    icon: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
}

export default function StepNode({ data, selected }: Props) {
  const { step, colorIndex, indexInPhase } = data
  const flashing = (data as unknown as { flashing?: boolean }).flashing === true
  const expanded =
    (data as unknown as { expanded?: boolean }).expanded === true
  const onToggleExpand = (data as unknown as {
    onToggleExpand?: (id: string) => void
  }).onToggleExpand
  const subCount = step.sub_steps.length
  const subDone = step.sub_steps.filter((s) => s.status === 'completed').length
  const phaseColor = paletteFor(colorIndex)
  const t = TYPE_META[step.step_type]

  return (
    <div
      className={`plan-step-node group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-[var(--color-surface-raised)] px-4 py-3 transition-all ${
        flashing ? 'plan-step-flash' : ''
      }`}
      style={{
        borderColor: selected ? phaseColor.accent : 'var(--color-border-strong)',
        boxShadow: selected
          ? `0 0 0 2px ${phaseColor.glow}, 0 12px 26px -10px ${phaseColor.glow}`
          : `0 1px 0 0 rgba(255,255,255,0.02) inset`,
      }}
    >
      <Handle
        type="target"
        id="left"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-[var(--color-border-strong)]"
      />
      <Handle
        type="source"
        id="right"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-[var(--color-border-strong)]"
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-[var(--color-border-strong)]"
      />
      <Handle
        type="target"
        id="top"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-[var(--color-border-strong)]"
      />

      {/* Phase color top accent strip */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: phaseColor.accent }}
      />

      {/* Header line */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[step.status]}`} />
        <span
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
          style={{ background: t.tintBg, color: t.tint }}
        >
          {t.icon}
          {t.label}
        </span>
        <span className="ml-auto text-[9px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {STATUS_LABEL[step.status]}
        </span>
      </div>

      {/* Title with step index */}
      <div className="flex items-start gap-2">
        <span
          className="mt-[2px] inline-flex h-4 min-w-[18px] items-center justify-center rounded px-1 text-[9px] font-bold tabular-nums"
          style={{ background: phaseColor.pillBg, color: phaseColor.accent }}
        >
          {indexInPhase + 1}
        </span>
        <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--color-text-primary)]">
          {step.name}
        </div>
      </div>

      {/* Objective (1 line) */}
      <p className="mt-1 line-clamp-1 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
        {step.objective}
      </p>

      {/* Footer chip: sub-steps + collapse/expand toggle */}
      {subCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            // Don't bubble to ReactFlow's onNodeClick (which opens StepDetail)
            e.stopPropagation()
            onToggleExpand?.(step.id)
          }}
          title={
            expanded
              ? `Masquer les ${subCount} sub-steps`
              : `Afficher les ${subCount} sub-steps`
          }
          className="mt-2 inline-flex items-center gap-1.5 self-start rounded-md bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            <path
              d="M3 6l5 5 5-5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {subDone}/{subCount} sub-steps
        </button>
      )}
    </div>
  )
}
