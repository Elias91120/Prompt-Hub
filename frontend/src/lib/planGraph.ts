/**
 * Manual column-based layout for the plan graph.
 *
 * Hierarchy:
 *  - PHASE  : large container, stacked vertically with a big gap between phases.
 *  - STEP   : laid out left-to-right inside its phase as columns. Each column
 *             centers horizontally on its step and reserves enough vertical
 *             room for the sub-steps below.
 *  - SUB-STEP: smaller card stacked vertically directly below its parent step,
 *              connected with a clear short edge. They are NEVER mixed in the
 *              same row as the steps — they always sit below.
 *
 * Goal: lots of breathing room, clear visual hierarchy, obvious parent→child
 *        relationships.
 */

import type { Edge, Node } from '@xyflow/react'

import type { Phase, Project, Step } from '../types'

/* ------------------------------------------------------------------ */
/* Sizing constants                                                    */
/* ------------------------------------------------------------------ */

export const STEP_W = 320
export const STEP_H = 140
export const SUB_W = 260
export const SUB_H = 86

const PHASE_PAD_X = 80
const PHASE_PAD_TOP = 130 // generous phase title bar
const PHASE_PAD_BOTTOM = 80
const PHASE_GAP_Y = 300 // breathing room between phases

const COLUMN_GAP = 140 // horizontal gutter between step columns
const STEP_TO_SUB_GAP = 80 // vertical gap between a step and its first sub-step
const SUB_GAP_Y = 44 // vertical gap between sub-steps

const MIN_PHASE_W = 640
const PHASE_STAGGER_X = 240 // odd phases offset right for visual map feel
const MIN_SUB_ZONE_H = 200 // minimum reserved height for sub-step zone

/* ------------------------------------------------------------------ */
/* Node data types                                                     */
/* ------------------------------------------------------------------ */

export interface PhaseNodeData extends Record<string, unknown> {
  phase: Phase
  completed: number
  total: number
  colorIndex: number
  phaseIndex: number
  totalPhases: number
}

export interface StepNodeData extends Record<string, unknown> {
  step: Step
  phase: Phase
  isFirst: boolean
  isLast: boolean
  colorIndex: number
  phaseIndex: number
  indexInPhase: number
}

export interface SubStepNodeData extends Record<string, unknown> {
  step: Step
  parentStep: Step
  phase: Phase
  colorIndex: number
  phaseIndex: number
  indexInParent: number
}

export type PlanNode =
  | Node<PhaseNodeData, 'phase'>
  | Node<StepNodeData, 'step'>
  | Node<SubStepNodeData, 'subStep'>

export interface BuildGraphResult {
  nodes: PlanNode[]
  edges: Edge[]
}

export interface BuildGraphOptions {
  /** When provided, only the steps whose IDs are in this set show their
   *  sub-steps. Steps NOT in the set still get a small "+N" pill on the
   *  card via the `subCount` field but their sub-step nodes / edges are
   *  omitted from the graph (which also collapses the phase height). */
  expandedStepIds?: Set<string>
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sortByOrder<T extends { order: number }>(arr: T[]): T[] {
  return arr.slice().sort((a, b) => a.order - b.order)
}

/* ------------------------------------------------------------------ */
/* Main builder                                                        */
/* ------------------------------------------------------------------ */

export function projectToGraph(
  project: Project,
  options: BuildGraphOptions = {},
): BuildGraphResult {
  const nodes: PlanNode[] = []
  const edges: Edge[] = []
  const expanded = options.expandedStepIds
  const isExpanded = (step: Step): boolean =>
    expanded === undefined || expanded.has(step.id)

  const phases = sortByOrder(project.phases)
  const totalPhases = phases.length

  let phaseY = 0

  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex++) {
    const phase = phases[phaseIndex]
    const colorIndex = phaseIndex % 5
    const steps = sortByOrder(phase.steps)
    // Count top-level steps + their sub-steps so progress reflects fine-grained
    // completion (a parent step with 3/3 sub-steps done shows real progress).
    const total =
      steps.reduce((n, s) => n + 1 + s.sub_steps.length, 0)
    const completed = steps.reduce(
      (n, s) =>
        n +
        (s.status === 'completed' ? 1 : 0) +
        s.sub_steps.filter((sub) => sub.status === 'completed').length,
      0,
    )

    // Column width is the max of STEP_W and SUB_W (sub-steps are narrower so
    // STEP_W usually wins). Each step lives in its own column.
    const colW = Math.max(STEP_W, SUB_W)

    // Compute the tallest sub-step stack across all steps of this phase so the
    // phase has a uniform height (steps in the same row → consistent layout).
    // Collapsed steps contribute 0 so the phase shrinks down when nothing is
    // expanded.
    let maxSubStackH = 0
    for (const step of steps) {
      if (!isExpanded(step)) continue
      const n = step.sub_steps.length
      if (n > 0) {
        const h = STEP_TO_SUB_GAP + n * SUB_H + (n - 1) * SUB_GAP_Y
        if (h > maxSubStackH) maxSubStackH = h
      }
    }
    // Reserve a minimum sub-step zone only when at least one expanded step
    // actually has sub-steps (avoids a fat empty band when everything is
    // collapsed).
    if (maxSubStackH > 0 && maxSubStackH < MIN_SUB_ZONE_H) {
      maxSubStackH = MIN_SUB_ZONE_H
    }

    // Phase layout dims
    const innerH = STEP_H + maxSubStackH
    const phaseH = PHASE_PAD_TOP + innerH + PHASE_PAD_BOTTOM
    const innerContentW = steps.length * colW + Math.max(steps.length - 1, 0) * COLUMN_GAP
    const phaseW = Math.max(MIN_PHASE_W, PHASE_PAD_X * 2 + innerContentW)
    const phaseX = phaseIndex % 2 === 0 ? 0 : PHASE_STAGGER_X

    // Push phase node
    nodes.push({
      id: `phase:${phase.id}`,
      type: 'phase',
      position: { x: phaseX, y: phaseY },
      data: {
        phase,
        completed,
        total,
        colorIndex,
        phaseIndex,
        totalPhases,
      },
      style: { width: phaseW, height: phaseH },
      selectable: false,
      draggable: false,
      zIndex: 0,
    })

    // Steps row + sub-step columns
    const rowY = phaseY + PHASE_PAD_TOP
    // Center the row of steps inside the phase if there's leftover space
    const rowStartX =
      phaseX + PHASE_PAD_X + Math.max(0, (phaseW - PHASE_PAD_X * 2 - innerContentW) / 2)

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const colCenterX = rowStartX + i * (colW + COLUMN_GAP) + colW / 2
      const stepX = colCenterX - STEP_W / 2

      nodes.push({
        id: step.id,
        type: 'step',
        position: { x: stepX, y: rowY },
        style: { width: STEP_W, height: STEP_H },
        data: {
          step,
          phase,
          isFirst: i === 0,
          isLast: i === steps.length - 1,
          colorIndex,
          phaseIndex,
          indexInPhase: i,
        },
        zIndex: 10,
      })

      // Sub-steps stacked below the step, centered horizontally on the column
      // — only emitted when the step is expanded.
      if (!isExpanded(step)) continue
      const subs = sortByOrder(step.sub_steps)
      let subY = rowY + STEP_H + STEP_TO_SUB_GAP
      for (let j = 0; j < subs.length; j++) {
        const sub = subs[j]
        const subX = colCenterX - SUB_W / 2
        nodes.push({
          id: sub.id,
          type: 'subStep',
          position: { x: subX, y: subY },
          style: { width: SUB_W, height: SUB_H },
          data: {
            step: sub,
            parentStep: step,
            phase,
            colorIndex,
            phaseIndex,
            indexInParent: j,
          },
          zIndex: 10,
        })

        // Edge: step ↘ sub-step (and sub→sub for the rest of the chain)
        if (j === 0) {
          edges.push({
            id: `e:${step.id}->${sub.id}`,
            source: step.id,
            sourceHandle: 'bottom',
            target: sub.id,
            targetHandle: 'top',
            type: 'planEdge',
            data: { sourceStatus: step.status, kind: 'sub', colorIndex },
          })
        } else {
          edges.push({
            id: `e:${subs[j - 1].id}->${sub.id}`,
            source: subs[j - 1].id,
            sourceHandle: 'bottom',
            target: sub.id,
            targetHandle: 'top',
            type: 'planEdge',
            data: { sourceStatus: subs[j - 1].status, kind: 'sub', colorIndex },
          })
        }

        subY += SUB_H + SUB_GAP_Y
      }
    }

    // Sequential step → step edges (left → right inside the phase)
    for (let i = 0; i < steps.length - 1; i++) {
      const src = steps[i]
      const tgt = steps[i + 1]
      edges.push({
        id: `e:${src.id}->${tgt.id}`,
        source: src.id,
        sourceHandle: 'right',
        target: tgt.id,
        targetHandle: 'left',
        type: 'planEdge',
        data: { sourceStatus: src.status, kind: 'step', colorIndex },
      })
    }

    phaseY += phaseH + PHASE_GAP_Y
  }

  // Cross-phase bridges: last step of phase N → first step of phase N+1
  for (let i = 0; i < phases.length - 1; i++) {
    const aSteps = sortByOrder(phases[i].steps)
    const bSteps = sortByOrder(phases[i + 1].steps)
    if (aSteps.length === 0 || bSteps.length === 0) continue
    const src = aSteps[aSteps.length - 1]
    const tgt = bSteps[0]
    edges.push({
      id: `e:phase:${phases[i].id}->${phases[i + 1].id}`,
      source: src.id,
      sourceHandle: 'bottom',
      target: tgt.id,
      targetHandle: 'top',
      type: 'planEdge',
      data: { sourceStatus: src.status, kind: 'phase', colorIndex: i % 5 },
    })
  }

  return { nodes, edges }
}
