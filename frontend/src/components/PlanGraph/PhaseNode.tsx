import type { NodeProps, Node } from '@xyflow/react'
import type { PhaseNodeData } from '../../lib/planGraph'
import { paletteFor } from './phasePalette'

type Props = NodeProps<Node<PhaseNodeData, 'phase'>>

export default function PhaseNode({ data }: Props) {
  const { phase, completed, total, colorIndex, phaseIndex, totalPhases } = data
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const p = paletteFor(colorIndex)
  const isFirst = phaseIndex === 0
  const isLast = phaseIndex === totalPhases - 1

  return (
    <div
      className="plan-phase-node group relative h-full w-full overflow-hidden rounded-[28px] border bg-[var(--color-surface-raised)]/55 backdrop-blur-md"
      style={{
        borderColor: p.ring,
        boxShadow: `0 12px 40px -16px ${p.glow}, inset 0 0 0 1px rgba(255,255,255,0.02)`,
      }}
    >
      {/* Soft gradient overlay tinted with the phase color */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(circle at 0% 0%, ${p.accentSoft} 0%, transparent 55%)`,
        }}
      />

      {/* Left side rail */}
      <div
        aria-hidden
        className="absolute inset-y-4 left-0 w-[5px] rounded-r-full"
        style={{ background: p.accent, boxShadow: `0 0 18px 0 ${p.glow}` }}
      />

      {/* Title bar */}
      <div className="relative flex items-center gap-4 px-7 py-5">
        {/* Big numbered badge with the phase icon */}
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
          style={{ background: p.pillBg, borderColor: p.ring, color: p.accent }}
        >
          <span
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
            style={{ background: p.accent, color: p.textOn }}
          >
            {phase.order + 1}
          </span>
          <span style={{ color: p.accent }}>{p.icon}</span>
        </div>

        {/* Title + meta */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.18em]"
              style={{ color: p.accent }}
            >
              {isFirst ? 'Kickoff' : isLast ? 'Final phase' : `Phase ${phase.order + 1}`}
            </span>
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">·</span>
            <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">
              {total} step{total !== 1 && 's'} · {pct}% done
            </span>
          </div>
          <h3 className="mt-0.5 truncate text-lg font-bold leading-tight text-[var(--color-text-primary)]">
            {phase.name}
          </h3>
        </div>

        {/* Progress ring */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
            <circle
              cx="24"
              cy="24"
              r="19"
              fill="none"
              stroke="var(--color-surface-hover)"
              strokeWidth="3.5"
            />
            <circle
              cx="24"
              cy="24"
              r="19"
              fill="none"
              stroke={p.accent}
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 119.38} 119.38`}
              className="transition-all duration-500"
              style={{ filter: `drop-shadow(0 0 4px ${p.glow})` }}
            />
          </svg>
          <span
            className="absolute text-[11px] font-bold tabular-nums"
            style={{ color: p.accent }}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Subtle bottom accent line */}
      <div
        aria-hidden
        className="absolute bottom-0 left-7 right-7 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${p.ring}, transparent)`,
        }}
      />
    </div>
  )
}
