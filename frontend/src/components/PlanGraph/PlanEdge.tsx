import { BaseEdge, getBezierPath, getSmoothStepPath } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { StepStatus } from '../../types'
import { paletteFor } from './phasePalette'

interface PlanEdgeData extends Record<string, unknown> {
  sourceStatus: StepStatus
  kind: 'step' | 'sub' | 'phase'
  colorIndex?: number
}

export default function PlanEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, id, data } = props
  const ed = (data ?? {}) as PlanEdgeData
  const status = ed.sourceStatus ?? 'not_started'
  const kind = ed.kind ?? 'step'

  // Sub edges: orthogonal step path (clearer parent→child hierarchy)
  // Step / phase edges: smooth bezier
  const [path, labelX, labelY] =
    kind === 'sub'
      ? getSmoothStepPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          borderRadius: 20,
          offset: 20,
        })
      : getBezierPath({
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
          curvature: kind === 'phase' ? 0.7 : 0.35,
        })

  // Style by status / kind
  let stroke = 'var(--color-border-strong)'
  let strokeWidth = 1.5
  let dash = ''
  let className = ''

  if (kind === 'phase') {
    // Big bridge between phases — colored with the source phase palette.
    const p = paletteFor(ed.colorIndex ?? 0)
    stroke = p.accent
    strokeWidth = 3
    if (status !== 'completed') dash = '8 6'
    if (status === 'in_progress') className = 'plan-edge-flow'
  } else if (kind === 'sub') {
    // Sub-step link: tinted with phase color so the cluster feels unified
    const p = paletteFor(ed.colorIndex ?? 0)
    stroke = p.accent
    strokeWidth = 1.4
    dash = '3 4'
  } else if (status === 'completed') {
    stroke = 'var(--color-accent)'
    strokeWidth = 2
  } else if (status === 'in_progress') {
    stroke = 'var(--color-accent)'
    strokeWidth = 2
    dash = '6 4'
    className = 'plan-edge-flow'
  } else if (status === 'replanned') {
    stroke = '#f59e0b'
    dash = '5 4'
  } else {
    stroke = 'var(--color-border-strong)'
    dash = '4 5'
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray: dash || undefined,
          fill: 'none',
        }}
        className={className}
      />
      {/* Checkmark for completed step→step / phase edges */}
      {(kind === 'step' || kind === 'phase') && status === 'completed' && (
        <g transform={`translate(${labelX - 7}, ${labelY - 7})`}>
          <circle cx="7" cy="7" r="7" fill="var(--color-surface)" stroke={stroke} strokeWidth="1" />
          <path
            d="M4 7L6 9L10 5"
            stroke={stroke}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}
    </>
  )
}
