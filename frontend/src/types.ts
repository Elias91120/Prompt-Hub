export type StepStatus = 'not_started' | 'in_progress' | 'completed' | 'replanned'
export type StepType = 'frontend' | 'backend' | 'infra' | 'other'

export interface Step {
  id: string
  name: string
  objective: string
  status: StepStatus
  step_type: StepType
  order: number
  parent_step_id: string | null
  sub_steps: Step[]
}

export interface Phase {
  id: string
  name: string
  order: number
  steps: Step[]
}

export interface Project {
  id: string
  name: string
  description: string
  business_context: string | null
  constraints: string | null
  objective: string
  stack: string | null
  decisions_log: string | null
  /** Supabase auth.users.id of the owner (null for legacy/demo). */
  owner_id: string | null
  /** Public read-only demo project, listed for everyone. */
  is_demo: boolean
  phases: Phase[]
  created_at: string
  updated_at: string
}

export interface ProjectCreate {
  name: string
  description: string
  business_context?: string | null
  constraints?: string | null
  objective: string
  stack?: string | null
  decisions_log?: string | null
}

export interface FeedbackItem {
  description: string
  done: boolean
}

export interface Recommendation {
  action: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface FeedbackAnalysis {
  summary: string
  items: FeedbackItem[]
  recommendations: Recommendation[]
  assumptions: string[]
  step_complete: boolean
  prompt_revision: string | null
}

export interface ChatMessage {
  role: 'user' | 'agent'
  content: string
}

export interface ChatHistoryItem {
  id: string
  role: 'user' | 'agent'
  content: string
  step_id: string | null
  created_at: string
}

export interface ChatResponse {
  reply: string
  ready_to_plan: boolean
  action?: 'append_constraints' | 'regenerate_plan' | 'adapt_plan' | null
  /** Per-operation outcomes, populated for `adapt_plan` actions.
   * Strings prefixed with `skipped:` indicate the operation was rejected. */
  adapt_summaries?: string[]
  /** When `action === 'adapt_plan'`, the ID of the `plan_adapted` event
   *  the user can revert via `POST /events/{event_id}/revert`. */
  event_id?: string
  project?: Project | null
}

export type ProjectEventType =
  | 'project_created'
  | 'project_updated'
  | 'plan_generated'
  | 'plan_adapted'
  | 'plan_reverted'
  | 'prompt_generated'
  | 'sub_steps_generated'
  | 'step_status_changed'
  | 'feedback_applied'

export interface ProjectEvent {
  id: string
  project_id: string
  step_id: string | null
  event_type: ProjectEventType
  source: string
  payload: Record<string, unknown>
  created_at: string
}

export type SkillKind = 'convention' | 'glossary' | 'antipattern' | 'stack_detail' | 'other'

export interface ProjectSkill {
  id: string
  project_id: string
  name: string
  kind: SkillKind
  applies_to: StepType | null
  content: string
  version: number
  created_at: string
  updated_at: string
}

export interface ProjectSkillCreate {
  name: string
  kind: SkillKind
  applies_to?: StepType | null
  content: string
}

export interface PromptHistoryEntry {
  id: string
  project_id: string
  step_id: string
  prompt_text: string
  skill_ids: string[]
  created_at: string
}

export type IssueSeverity = 'info' | 'warning' | 'critical'

export interface PlanIssue {
  kind: 'gap' | 'duplicate' | 'ordering' | 'missing_dependency' | 'scope_mismatch' | 'other'
  severity: IssueSeverity
  title: string
  detail: string
  affected_step_names: string[]
}

export interface PlanConsistencyReport {
  issues: PlanIssue[]
  overall_assessment: string
}

export interface NextStepRecommendation {
  step_name: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

export interface StepRisk {
  kind: 'ambiguity' | 'missing_dependency' | 'scope_creep' | 'constraint_conflict' | 'other'
  severity: IssueSeverity
  description: string
  mitigation: string
}

export interface StepRiskReport {
  risks: StepRisk[]
  overall: string
}

export interface ProjectRecap {
  where_we_are: string
  what_was_done: string[]
  what_remains: string[]
  momentum: string
}

export type AgentKind = 'planner' | 'generator' | 'analyser' | 'router' | 'summariser'

export interface AgentCharter {
  name: string
  kind: AgentKind
  role: string
  purpose: string
  inputs: string[]
  outputs: string[]
  does_not: string[]
  version: number
}
