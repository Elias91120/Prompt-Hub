import type {
  AgentCharter,
  ChatHistoryItem,
  ChatMessage,
  ChatResponse,
  FeedbackAnalysis,
  NextStepRecommendation,
  PlanConsistencyReport,
  Project,
  ProjectCreate,
  ProjectEvent,
  ProjectRecap,
  ProjectSkill,
  ProjectSkillCreate,
  PromptHistoryEntry,
  StepRiskReport,
  StepStatus,
} from './types'

const BASE = import.meta.env.VITE_API_URL || '/api'

/** Default deadline for LLM-bound endpoints (ms).  Plan generation can
 * take over a minute; anything beyond this is treated as unreachable. */
const LLM_TIMEOUT_MS = 180_000

/** Thrown when the AI service cannot be reached or takes longer than
 * {@link LLM_TIMEOUT_MS}. The UI uses this to show a friendly recovery
 * message instead of a generic error. */
export class LLMUnreachableError extends Error {
  constructor(message = 'AI service unreachable') {
    super(message)
    this.name = 'LLMUnreachableError'
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

/** Wrapper for endpoints that hit an LLM agent. Adds an abortable
 * timeout and converts network / 502-504 / abort failures into
 * {@link LLMUnreachableError} so the UI can degrade gracefully. */
async function llmRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...init,
    })
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new LLMUnreachableError(`AI service responded with ${res.status}`)
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`${res.status}: ${body}`)
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof LLMUnreachableError) throw err
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new LLMUnreachableError('AI service timed out')
    }
    // fetch() rejects with TypeError when the server is down (DNS / connect)
    if (err instanceof TypeError) {
      throw new LLMUnreachableError('Could not reach AI service')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export function listProjects(): Promise<Project[]> {
  return request<Project[]>('/projects/')
}

export function getProject(id: string): Promise<Project> {
  return request<Project>(`/projects/${id}`)
}

export function createProject(data: ProjectCreate): Promise<Project> {
  return request<Project>('/projects/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${BASE}/projects/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
}

export function generatePlan(projectId: string, instructions?: string): Promise<Project> {
  return llmRequest<Project>(`/projects/${projectId}/generate-plan`, {
    method: 'POST',
    body: JSON.stringify({ instructions: instructions ?? '' }),
  })
}

export function generatePrompt(projectId: string, stepId: string): Promise<{ prompt: string }> {
  return llmRequest<{ prompt: string }>(`/projects/${projectId}/steps/${stepId}/generate-prompt`, {
    method: 'POST',
  })
}

export function previewPromptContext(
  projectId: string,
  stepId: string,
): Promise<{ context: string }> {
  return request<{ context: string }>(
    `/projects/${projectId}/steps/${stepId}/preview-prompt-context`,
  )
}

export function updateProject(projectId: string, data: ProjectCreate): Promise<Project> {
  return request<Project>(`/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function analyseFeedback(
  projectId: string,
  stepId: string,
  feedbackText: string,
): Promise<FeedbackAnalysis> {
  return llmRequest<FeedbackAnalysis>(`/projects/${projectId}/steps/${stepId}/analyse-feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback_text: feedbackText }),
  })
}

export interface ApplyFeedbackResponse {
  analysis: FeedbackAnalysis
  new_status: StepStatus
  project: Project
}

export function applyFeedback(
  projectId: string,
  stepId: string,
  feedbackText: string,
): Promise<ApplyFeedbackResponse> {
  return llmRequest<ApplyFeedbackResponse>(`/projects/${projectId}/steps/${stepId}/apply-feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback_text: feedbackText }),
  })
}

export function updateStepStatus(
  projectId: string,
  stepId: string,
  status: StepStatus,
): Promise<Project> {
  return request<Project>(`/projects/${projectId}/steps/${stepId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function generateSubSteps(
  projectId: string,
  stepId: string,
  instructions = '',
): Promise<Project> {
  return llmRequest<Project>(`/projects/${projectId}/steps/${stepId}/generate-sub-steps`, {
    method: 'POST',
    body: JSON.stringify({ instructions }),
  })
}

export function listProjectEvents(
  projectId: string,
  opts: { stepId?: string; limit?: number } = {},
): Promise<ProjectEvent[]> {
  const params = new URLSearchParams()
  if (opts.stepId) params.set('step_id', opts.stepId)
  if (opts.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  return request<ProjectEvent[]>(
    `/projects/${projectId}/events${qs ? `?${qs}` : ''}`,
  )
}

/** Undo a previous plan adaptation by restoring its pre-mutation snapshot. */
export function revertProjectEvent(
  projectId: string,
  eventId: string,
): Promise<Project> {
  return request<Project>(
    `/projects/${projectId}/events/${eventId}/revert`,
    { method: 'POST' },
  )
}

export function listSkills(projectId: string): Promise<ProjectSkill[]> {
  return request<ProjectSkill[]>(`/projects/${projectId}/skills`)
}

export function createSkill(
  projectId: string,
  data: ProjectSkillCreate,
): Promise<ProjectSkill> {
  return request<ProjectSkill>(`/projects/${projectId}/skills`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateSkill(
  projectId: string,
  skillId: string,
  data: ProjectSkillCreate,
): Promise<ProjectSkill> {
  return request<ProjectSkill>(`/projects/${projectId}/skills/${skillId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSkill(projectId: string, skillId: string): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/skills/${skillId}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
}

export function listStepPrompts(
  projectId: string,
  stepId: string,
  limit = 20,
): Promise<PromptHistoryEntry[]> {
  return request<PromptHistoryEntry[]>(
    `/projects/${projectId}/steps/${stepId}/prompts?limit=${limit}`,
  )
}

export function analysePlanConsistency(
  projectId: string,
): Promise<PlanConsistencyReport> {
  return llmRequest<PlanConsistencyReport>(
    `/projects/${projectId}/analyse/plan-consistency`,
    { method: 'POST' },
  )
}

export function recommendNextStep(
  projectId: string,
): Promise<NextStepRecommendation> {
  return llmRequest<NextStepRecommendation>(
    `/projects/${projectId}/analyse/next-step`,
    { method: 'POST' },
  )
}

export function analyseStepRisks(
  projectId: string,
  stepId: string,
): Promise<StepRiskReport> {
  return llmRequest<StepRiskReport>(
    `/projects/${projectId}/steps/${stepId}/analyse/risks`,
    { method: 'POST' },
  )
}

export function getProjectRecap(projectId: string): Promise<ProjectRecap> {
  return llmRequest<ProjectRecap>(`/projects/${projectId}/recap`, { method: 'POST' })
}

export function chatMessage(
  projectId: string,
  message: string,
  history: ChatMessage[],
  focusStepId?: string,
): Promise<ChatResponse> {
  return llmRequest<ChatResponse>(`/projects/${projectId}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      history,
      focus_step_id: focusStepId ?? null,
    }),
  })
}

/** Stream a chat reply via Server-Sent Events.  The LLM emits tokens
 *  as they are produced; perceived latency drops dramatically even
 *  though total time is unchanged.
 *
 *  Resolves with the final structured payload (same shape as
 *  {@link chatMessage}) once the stream closes. The `onToken` callback
 *  fires for each text chunk so the UI can render in real time. */
export async function chatMessageStream(
  projectId: string,
  message: string,
  history: ChatMessage[],
  options: {
    focusStepId?: string
    onToken: (chunk: string) => void
    signal?: AbortSignal
  },
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/projects/${projectId}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      focus_step_id: options.focusStepId ?? null,
    }),
    signal: options.signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`${res.status}: chat stream failed`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let done: ChatResponse | null = null
  let errorMessage: string | null = null

  // Each SSE frame is separated by a blank line ("\n\n"). We accumulate
  // bytes into `buffer`, then process complete frames.
  while (true) {
    const { value, done: streamDone } = await reader.read()
    if (streamDone) break
    buffer += decoder.decode(value, { stream: true })
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trimStart()
      }
      if (!data) continue
      if (event === 'token') {
        try {
          options.onToken(JSON.parse(data) as string)
        } catch {
          options.onToken(data)
        }
      } else if (event === 'done') {
        try {
          done = JSON.parse(data) as ChatResponse
        } catch {
          done = null
        }
      } else if (event === 'error') {
        try {
          errorMessage = JSON.parse(data) as string
        } catch {
          errorMessage = data
        }
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage)
  if (done === null) throw new Error('Chat stream ended without a `done` event')
  return done
}

export function listChatHistory(
  projectId: string,
  limit = 200,
): Promise<ChatHistoryItem[]> {
  return request<ChatHistoryItem[]>(
    `/projects/${projectId}/chat/history?limit=${limit}`,
  )
}

export async function clearChatHistory(projectId: string): Promise<void> {
  const res = await fetch(`${BASE}/projects/${projectId}/chat/history`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
}

export function listAgents(): Promise<AgentCharter[]> {
  return request<AgentCharter[]>('/agents/')
}
