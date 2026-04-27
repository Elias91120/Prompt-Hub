import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  chatMessageStream,
  listChatHistory,
  LLMUnreachableError,
  revertProjectEvent,
} from '../api'
import type { ChatMessage, Project } from '../types'

/* ------------------------------------------------------------------ */
/* Local message shape                                                  */
/* ------------------------------------------------------------------ */

/**
 * Metadata attached to an agent message produced by an `adapt_plan`
 * action. Drives the inline "Annuler" button + status line.
 */
interface AdaptMeta {
  eventId: string
  summaries: string[]
  reverted?: boolean
}

interface UIMessage extends ChatMessage {
  /** When set, render an "Annuler la dernière adaptation" button. */
  adapt?: AdaptMeta
}

/**
 * Extract step names from `adapt_summaries`. Operations always quote
 * the affected step name in single quotes, e.g.
 *   "added 'Database migrations' to phase 'Backend'"
 *   "updated 'Auth UI' (name, objective)"
 *   "removed 'Email notifications'"
 *   "added 3 sub-step(s) under 'JWT auth'"
 * We collect the FIRST quoted token of each non-skipped line.
 */
function extractChangedStepNames(summaries: string[] | undefined): string[] {
  if (!summaries) return []
  const names = new Set<string>()
  for (const s of summaries) {
    if (s.startsWith('skipped:')) continue
    const m = s.match(/'([^']+)'/)
    if (m) names.add(m[1])
  }
  return [...names]
}

/**
 * Best-effort extraction of the streamed `"message"` field from a
 * partial JSON document. The agent's full reply is a JSON object like
 *   {"message": "...", "ready_to_plan": false, "action": null}
 * so we look for the first ``"message"`` key and return whatever has
 * been streamed so far. We deliberately do NOT try to fully decode
 * escape sequences -- this is purely for the typing indicator.
 */
function extractLiveMessage(raw: string): string {
  // Strip a leading markdown code fence if present.
  let body = raw
  const fence = body.match(/```(?:json)?\s*/)
  if (fence && fence.index !== undefined) body = body.slice(fence.index + fence[0].length)

  const m = body.match(/"message"\s*:\s*"/)
  if (!m || m.index === undefined) return ''
  let i = m.index + m[0].length
  let out = ''
  while (i < body.length) {
    const c = body[i]
    if (c === '\\' && i + 1 < body.length) {
      const n = body[i + 1]
      if (n === 'n') out += '\n'
      else if (n === 't') out += '\t'
      else if (n === '"') out += '"'
      else if (n === '\\') out += '\\'
      else out += n
      i += 2
      continue
    }
    if (c === '"') break
    out += c
    i += 1
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  projectId: string
  /** Called when the user clicks "Generate Plan" — receives consolidated chat context */
  onReadyToPlan: (instructions: string) => void
  /** When true, renders in compact side-panel mode */
  compact?: boolean
  /** When true, the plan is generating (disables Generate Plan button) */
  generating?: boolean
  /** Called when the agent dispatched an action that mutated the project. */
  onProjectUpdated?: (project: Project) => void
  /** Called when the agent applied an `adapt_plan` action so the parent
   *  can flash the affected step cards in the PlanGraph. */
  onPlanAdapted?: (info: { stepNames: string[]; eventId: string }) => void
  /** Optional: focus the next message on a specific step ("Discuter de ce step"). */
  focusStepId?: string | null
  /** Optional: pre-fill the input box (paired with `focusStepId`). */
  pendingPrompt?: string
  /** Called once the pending prompt has been consumed so the parent can clear it. */
  onPendingPromptConsumed?: () => void
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function ChatPanel({
  projectId,
  onReadyToPlan,
  compact = false,
  generating = false,
  onProjectUpdated,
  onPlanAdapted,
  focusStepId = null,
  pendingPrompt = '',
  onPendingPromptConsumed,
}: Props) {
  const { t } = useTranslation('plan')
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(true)
  const [readyToPlan, setReadyToPlan] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load persisted history first; only fall back to a synthetic "Start"
  // greeting when the project has no chat history yet.
  useEffect(() => {
    let cancelled = false
    setSending(true)
    listChatHistory(projectId)
      .then(async (history) => {
        if (cancelled) return
        if (history.length > 0) {
          setMessages(
            history.map((h) => ({ role: h.role, content: h.content })),
          )
          setReadyToPlan(true)
          setSending(false)
          return
        }
        try {
          // Stream the initial greeting so first paint feels snappy.
          setMessages([{ role: 'agent', content: '' }])
          let raw = ''
          const res = await chatMessageStream(projectId, 'Start', [], {
            onToken: (chunk) => {
              raw += chunk
              const live = extractLiveMessage(raw)
              if (live) {
                setMessages([{ role: 'agent', content: live }])
              }
            },
          })
          if (cancelled) return
          setMessages([{ role: 'agent', content: res.reply }])
          setReadyToPlan(res.ready_to_plan)
        } finally {
          if (!cancelled) setSending(false)
        }
      })
      .catch(() => {
        if (!cancelled) setSending(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  // Pre-fill the input when the user clicked "Discuter de ce step".
  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt)
      onPendingPromptConsumed?.()
      // Defer focus so the textarea is mounted and visible.
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: UIMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    // Insert an empty agent placeholder we will fill as tokens arrive.
    // The ChatResponse JSON streams character-by-character; we only
    // surface the final `message` field after parsing, but progressive
    // raw text is still useful as a "typing" indicator. We wait until
    // the response opens its `"message":` field, then extract that
    // running value.
    const agentIndex = messages.length + 1
    setMessages((prev) => [...prev, { role: 'agent', content: '' }])

    let rawAccum = ''
    try {
      const res = await chatMessageStream(
        projectId,
        text,
        messages,
        {
          focusStepId: focusStepId ?? undefined,
          onToken: (chunk) => {
            rawAccum += chunk
            // Best-effort live extraction of the partially-streamed
            // `"message"` field. Falls back to showing nothing when the
            // model has not opened the field yet.
            const live = extractLiveMessage(rawAccum)
            if (live) {
              setMessages((prev) =>
                prev.map((m, idx) =>
                  idx === agentIndex ? { ...m, content: live } : m,
                ),
              )
            }
          },
        },
      )
      let actionLine = ''
      let adapt: AdaptMeta | undefined
      if (res.action === 'regenerate_plan') {
        actionLine = 'Plan regenerated.'
      } else if (res.action === 'append_constraints') {
        actionLine = 'Constraints updated.'
      } else if (res.action === 'adapt_plan' && res.adapt_summaries?.length) {
        const applied = res.adapt_summaries.filter((s) => !s.startsWith('skipped:'))
        const skipped = res.adapt_summaries.filter((s) => s.startsWith('skipped:'))
        const parts: string[] = []
        if (applied.length) parts.push(`Plan adapted: ${applied.join('; ')}.`)
        if (skipped.length) parts.push(`(${skipped.length} change(s) skipped)`)
        actionLine = parts.join(' ')
        if (res.event_id && applied.length) {
          adapt = { eventId: res.event_id, summaries: res.adapt_summaries }
          onPlanAdapted?.({
            eventId: res.event_id,
            stepNames: extractChangedStepNames(res.adapt_summaries),
          })
        }
      }
      const agentContent = actionLine ? `${res.reply}\n\n— ${actionLine}` : res.reply
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === agentIndex ? { role: 'agent', content: agentContent, adapt } : m,
        ),
      )
      setReadyToPlan(res.ready_to_plan)
      if (res.action && res.project) {
        onProjectUpdated?.(res.project)
      }
    } catch (err) {
      const message =
        err instanceof LLMUnreachableError
          ? "⚠️ Le service IA ne répond pas.\n\nVérifiez votre connexion internet, puis réessayez votre message."
          : 'Une erreur est survenue. Réessayez votre message dans un instant.'
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === agentIndex ? { role: 'agent', content: message } : m,
        ),
      )
    } finally {
      setSending(false)
    }
  }

  function handleGeneratePlan() {
    const consolidated = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`)
      .join('\n')
    onReadyToPlan(consolidated)
  }

  async function handleUndoAdapt(messageIndex: number, meta: AdaptMeta) {
    if (meta.reverted) return
    try {
      const project = await revertProjectEvent(projectId, meta.eventId)
      onProjectUpdated?.(project)
      setMessages((prev) =>
        prev.map((m, idx) =>
          idx === messageIndex ? { ...m, adapt: { ...meta, reverted: true } } : m,
        ),
      )
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: `Impossible d'annuler l'adaptation : ${
            err instanceof Error ? err.message : 'erreur inconnue'
          }`,
        },
      ])
    }
  }

  const textSize = compact ? 'text-sm' : 'text-base'
  const msgPadding = compact ? 'px-4 py-3' : 'px-5 py-3.5'

  return (
    <div className="flex h-full flex-col">
      {/* ── Messages ── */}
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {messages.length === 0 && (
          <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]/40 p-5 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent-glow)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                  fill="var(--color-accent)"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t('chat.empty.title')}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {t('chat.empty.description')}
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'agent' && (
              <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                    fill="#22c55e"
                  />
                </svg>
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl ${msgPadding} leading-relaxed ${textSize} ${
                msg.role === 'user'
                  ? 'bg-[var(--color-accent)] text-black font-medium'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
              }`}
            >
              {msg.role === 'agent' && msg.content === '' ? (
                <span
                  className="inline-flex items-center gap-1 text-[var(--color-text-tertiary)]"
                  aria-label="L'agent réfléchit"
                  role="status"
                >
                  <span className="chat-thinking-dot" />
                  <span className="chat-thinking-dot chat-thinking-dot-2" />
                  <span className="chat-thinking-dot chat-thinking-dot-3" />
                </span>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
              {msg.adapt && (
                <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border)] pt-2">
                  {msg.adapt.reverted ? (
                    <span className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
                      ↩ Adaptation annulée
                    </span>
                  ) : (
                    <button
                      onClick={() => handleUndoAdapt(i, msg.adapt!)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-amber-500/40 hover:text-amber-300"
                      title="Restaure le plan dans son état d'avant cette adaptation"
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 8a5 5 0 1 1 1.5 3.5M3 4v4h4"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Annuler cette adaptation
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/15">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                  fill="#22c55e"
                />
              </svg>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-hover)] px-5 py-3.5 text-base text-[var(--color-text-tertiary)]">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>
                  ·
                </span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>
                  ·
                </span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>
                  ·
                </span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Generate Plan CTA ── */}
      {readyToPlan && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-active)] px-6 py-4">
          <button
            type="button"
            onClick={handleGeneratePlan}
            disabled={generating}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-base font-semibold text-black shadow-md transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-lg disabled:opacity-50"
          >
            {generating ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Generating…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                    fill="currentColor"
                    opacity="0.9"
                  />
                </svg>
                Generate Plan
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-3"
        >
          <input
            ref={textareaRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your project…"
            disabled={sending}
            className={`flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 ${textSize} text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] transition-colors focus:border-[var(--color-accent)]/40 focus:ring-2 focus:ring-[var(--color-accent)]/10 focus:outline-none disabled:opacity-50`}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="shrink-0 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-black transition-all hover:bg-[var(--color-accent-hover)] hover:shadow disabled:opacity-40"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L14 2L10 14L8 9L2 8Z" fill="currentColor" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
