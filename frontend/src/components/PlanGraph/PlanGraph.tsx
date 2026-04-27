import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
} from '@xyflow/react'
import type { Edge, Node, NodeMouseHandler } from '@xyflow/react'

import '@xyflow/react/dist/style.css'

import type { Project, Step } from '../../types'
import { projectToGraph } from '../../lib/planGraph'
import PhaseNode from './PhaseNode'
import StepNode from './StepNode'
import SubStepNode from './SubStepNode'
import PlanEdge from './PlanEdge'

interface Props {
  project: Project
  selectedStepId: string | null
  onSelectStep: (step: Step) => void
  /** Step names to flash (3 s) after a chat-driven adapt_plan. */
  flashStepNames?: string[]
}

const NODE_TYPES = {
  phase: PhaseNode,
  step: StepNode,
  subStep: SubStepNode,
}

const EDGE_TYPES = {
  planEdge: PlanEdge,
}

/* Inner component that has access to the ReactFlow instance */
function PlanGraphInner({ project, selectedStepId, onSelectStep, flashStepNames }: Props) {
  // Track which step IDs the user has explicitly toggled.
  // - Set true  -> force expanded (overrides auto rules)
  // - Set false -> force collapsed (overrides auto rules)
  // - Absent    -> follow auto rules (active phase, in_progress, zoom)
  const [manualToggles, setManualToggles] = useState<Map<string, boolean>>(
    () => new Map(),
  )

  // Live zoom value -- used to expand everything once the user is zoomed in
  // far enough that the cards have plenty of room.
  const zoom = useStore((s) => s.transform[2])
  const ZOOM_EXPAND_THRESHOLD = 0.95

  // Heuristic "active phase": the phase that contains the first in_progress
  // step, falling back to the phase containing the first not_started step.
  // Sub-steps of every step in that phase are auto-expanded.
  const activePhaseId = useMemo<string | null>(() => {
    let firstNotStartedPhase: string | null = null
    for (const phase of project.phases) {
      for (const step of phase.steps) {
        if (step.status === 'in_progress') return phase.id
        if (step.status === 'not_started' && firstNotStartedPhase === null) {
          firstNotStartedPhase = phase.id
        }
      }
    }
    return firstNotStartedPhase
  }, [project])

  // Compute the effective set of expanded step IDs.
  const expandedStepIds = useMemo<Set<string>>(() => {
    const set = new Set<string>()
    const zoomedIn = zoom >= ZOOM_EXPAND_THRESHOLD
    for (const phase of project.phases) {
      const phaseActive = phase.id === activePhaseId
      for (const step of phase.steps) {
        if (step.sub_steps.length === 0) continue
        const manual = manualToggles.get(step.id)
        if (manual === true) {
          set.add(step.id)
          continue
        }
        if (manual === false) continue
        if (zoomedIn) set.add(step.id)
        else if (phaseActive) set.add(step.id)
        else if (step.status === 'in_progress') set.add(step.id)
      }
    }
    return set
  }, [project, manualToggles, activePhaseId, zoom])

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => projectToGraph(project, { expandedStepIds }),
    [project, expandedStepIds],
  )

  const flashSet = useMemo(
    () => new Set((flashStepNames ?? []).map((n) => n.trim().toLowerCase())),
    [flashStepNames],
  )

  const handleToggleExpand = useCallback((stepId: string) => {
    setManualToggles((prev) => {
      const next = new Map(prev)
      // Three-way cycle: auto -> force expanded -> force collapsed -> auto.
      // From the user's POV this is just a chevron; the explicit "force"
      // states make sure we don't fight the auto rules silently.
      const current = next.get(stepId)
      if (current === undefined) next.set(stepId, true)
      else if (current === true) next.set(stepId, false)
      else next.delete(stepId)
      return next
    })
  }, [])

  const decorate = (node: Node): Node => {
    if (node.type !== 'step' && node.type !== 'subStep') return node
    const data = node.data as { step?: Step }
    const flashing =
      data.step !== undefined &&
      flashSet.has(data.step.name.trim().toLowerCase())
    const extras: Record<string, unknown> = { flashing }
    if (node.type === 'step' && data.step) {
      extras.expanded = expandedStepIds.has(data.step.id)
      extras.onToggleExpand = handleToggleExpand
    }
    return {
      ...node,
      data: { ...node.data, ...extras },
      selected: node.id === selectedStepId,
    }
  }

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    initialNodes.map(decorate),
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
  const { fitView, setCenter, getNode } = useReactFlow()

  // Re-build when the project changes (sub-steps added, status updated, etc.)
  useEffect(() => {
    const fresh = projectToGraph(project, { expandedStepIds })
    setNodes(fresh.nodes.map(decorate))
    setEdges(fresh.edges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedStepId, flashSet, expandedStepIds, setNodes, setEdges])

  // Center on selected step when it changes
  useEffect(() => {
    if (!selectedStepId) return
    const n = getNode(selectedStepId)
    if (!n) return
    const w = (n.width ?? 240) as number
    const h = (n.height ?? 110) as number
    setCenter(n.position.x + w / 2, n.position.y + h / 2, { duration: 600, zoom: 1 })
  }, [selectedStepId, getNode, setCenter])

  // Fit view on first mount
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.22, duration: 500 }), 80)
    return () => clearTimeout(t)
  }, [fitView])

  const handleNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.type !== 'step' && node.type !== 'subStep') return
    const data = node.data as { step?: Step }
    if (data.step) onSelectStep(data.step)
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      edgeTypes={EDGE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={1.8}
      fitView
      fitViewOptions={{ padding: 0.22 }}
      defaultEdgeOptions={{ type: 'planEdge' }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnScroll
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      selectionOnDrag={false}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.2}
        color="var(--color-border-strong)"
      />
      <Controls
        position="bottom-left"
        showInteractive={false}
        className="plan-graph-controls"
      />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        className="plan-graph-minimap"
        nodeColor={(n) => {
          if (n.type === 'phase') return 'var(--color-surface-hover)'
          const status = (n.data as { step?: { status?: string } })?.step?.status ?? 'not_started'
          if (status === 'completed') return '#10b981'
          if (status === 'in_progress') return 'var(--color-accent)'
          if (status === 'replanned') return '#f59e0b'
          return '#3a3a3a'
        }}
        maskColor="rgba(9, 9, 9, 0.78)"
      />
    </ReactFlow>
  )
}

export default function PlanGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <PlanGraphInner {...props} />
    </ReactFlowProvider>
  )
}
