import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import type { SubStepNodeData } from '../../lib/planGraph'
import type { StepStatus } from '../../types'
import { paletteFor } from './phasePalette'

type Props = NodeProps<Node<SubStepNodeData, 'subStep'>>

const STATUS_DOT: Record<StepStatus, string> = {
  not_started: 'bg-neutral-500',
  in_progress: 'bg-[var(--color-accent)] step-dot-pulse',
  completed: 'bg-emerald-400',
  replanned: 'bg-amber-400',
}

export default function SubStepNode({ data, selected }: Props) {
  const { step, colorIndex, indexInParent } = data
  const flashing = (data as unknown as { flashing?: boolean }).flashing === true
  const p = paletteFor(colorIndex)

  return (
    <div
      className={`plan-substep-node group relative flex h-full w-full items-start gap-2.5 overflow-hidden rounded-xl border bg-[var(--color-surface)]/85 backdrop-blur-sm px-3 py-2.5 transition-all ${
        flashing ? 'plan-step-flash' : ''
      }`}
      style={{
        borderColor: selected ? p.accent : 'var(--color-border)',
        borderStyle: selected ? 'solid' : 'dashed',
        borderWidth: selected ? '2px' : '1px',
        boxShadow: selected ? `0 0 0 2px ${p.glow}` : undefined,
      }}
    >
      <Handle
        type="target"
        id="top"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-[var(--color-border-strong)]"
      />
      <Handle
        type="source"
        id="bottom"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-[var(--color-border-strong)]"
      />

      {/* Index pill — clearly marks subordination ("↳ 1") */}
      <div
        className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold tabular-nums uppercase tracking-wider"
        style={{ background: p.pillBg, color: p.accent }}
      >
        <span className="opacity-70">↳</span>
        {indexInParent + 1}
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[step.status]}`} />
          <span className="line-clamp-1 text-[11px] font-semibold leading-tight text-[var(--color-text-primary)]">
            {step.name}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[10px] leading-snug text-[var(--color-text-tertiary)]">
          {step.objective}
        </p>
      </div>
    </div>
  )
}
