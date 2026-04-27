import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type {
  FeedbackAnalysis,
  Project,
  PromptHistoryEntry,
  Step,
  StepRiskReport,
  StepStatus,
} from '../types'
import {
  analyseStepRisks,
  applyFeedback,
  generatePrompt,
  generateSubSteps,
  listStepPrompts,
  LLMUnreachableError,
  previewPromptContext,
  updateStepStatus,
} from '../api'

function describeError(e: unknown): string {
  if (e instanceof LLMUnreachableError) {
    return 'Le service IA ne répond pas. Vérifiez votre connexion ou réessayez plus tard.'
  }
  return String(e)
}

interface Props {
  projectId: string
  step: Step
  onClose: () => void
  /** Called whenever the step status changes (feedback applied or manual update) */
  onProjectUpdated?: (project: Project) => void
  /** Optional breadcrumb info: phase + parent step name */
  phaseName?: string
  parentStepName?: string | null
  /** When provided, allow centering on a sub-step from the drawer */
  onJumpToStep?: (step: Step) => void
  /** When provided, the "Discuter de ce step" button is shown and calls this. */
  onDiscussInChat?: (step: Step) => void
}

const STATUS_LABEL: Record<Step['status'], string> = {
  not_started: 'Todo',
  in_progress: 'In Progress',
  completed: 'Done',
  replanned: 'Replanned',
}

const STATUS_STYLE: Record<Step['status'], string> = {
  not_started: 'bg-neutral-800 text-neutral-400 border-neutral-700',
  in_progress: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  replanned: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
}

export default function StepDetail({
  projectId,
  step,
  onClose,
  onProjectUpdated,
  phaseName,
  parentStepName,
  onJumpToStep,
  onDiscussInChat,
}: Props) {
  const { t } = useTranslation('plan')
  const [prompt, setPrompt] = useState<string | null>(null)
  const [contextPreview, setContextPreview] = useState<string | null>(null)
  const [history, setHistory] = useState<PromptHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [risks, setRisks] = useState<StepRiskReport | null>(null)
  const [feedback, setFeedback] = useState('')
  const [analysis, setAnalysis] = useState<FeedbackAnalysis | null>(null)
  const [appliedStatus, setAppliedStatus] = useState<StepStatus | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ✨ Reset all transient state whenever the selected step changes — fixes
  //    the "stale prompt fantome" bug where switching steps showed the
  //    previous step's prompt / feedback / analysis.
  useEffect(() => {
    setPrompt(null)
    setContextPreview(null)
    setHistory([])
    setShowHistory(false)
    setRisks(null)
    setFeedback('')
    setAnalysis(null)
    setAppliedStatus(null)
    setError(null)
    setLoading(null)
  }, [step.id])

  // Lazy-load prompt history when the user opens the section.
  useEffect(() => {
    if (!showHistory) return
    let active = true
    listStepPrompts(projectId, step.id)
      .then((rows) => {
        if (active) setHistory(rows)
      })
      .catch((e) => {
        if (active) setError(describeError(e))
      })
    return () => {
      active = false
    }
  }, [showHistory, projectId, step.id, prompt])

  async function handleGeneratePrompt() {
    setLoading('prompt')
    setError(null)
    try {
      const res = await generatePrompt(projectId, step.id)
      setPrompt(res.prompt)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(null)
    }
  }

  async function handlePreviewContext() {
    setLoading('context')
    setError(null)
    try {
      const res = await previewPromptContext(projectId, step.id)
      setContextPreview(res.context)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(null)
    }
  }

  async function handleAnalyseRisks() {
    setLoading('risks')
    setError(null)
    try {
      setRisks(await analyseStepRisks(projectId, step.id))
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(null)
    }
  }

  async function handleApplyFeedback() {
    if (!feedback.trim()) return
    setLoading('feedback')
    setError(null)
    try {
      const res = await applyFeedback(projectId, step.id, feedback)
      setAnalysis(res.analysis)
      setAppliedStatus(res.new_status)
      onProjectUpdated?.(res.project)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(null)
    }
  }

  async function handleManualStatus(status: StepStatus) {
    setLoading('status')
    setError(null)
    try {
      const updated = await updateStepStatus(projectId, step.id, status)
      onProjectUpdated?.(updated)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(null)
    }
  }

  async function handleGenerateSubSteps() {
    setLoading('substeps')
    setError(null)
    try {
      const updated = await generateSubSteps(projectId, step.id)
      onProjectUpdated?.(updated)
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(null)
    }
  }

  function handleCopy() {
    if (prompt) void navigator.clipboard.writeText(prompt)
  }

  // Effective status: prefer the freshly applied one if present
  const effectiveStatus: StepStatus = appliedStatus ?? step.status

  return (
    <>
      {/* Overlay (click to close) */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="step-detail-title"
        className="fixed inset-x-0 bottom-0 top-0 z-50 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-surface-raised)] shadow-[-12px_0_40px_-10px_rgba(0,0,0,0.7)] animate-[plan-node-enter_0.25s_ease-out] sm:left-auto sm:right-0 sm:w-[480px]">
      {/* ── Header ── */}
      <div className="border-b border-[var(--color-border)] px-6 py-5">
        {/* Breadcrumb */}
        {(phaseName || parentStepName) && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)]">
            {phaseName && (
              <>
                <span className="rounded-md bg-[var(--color-surface)] px-2 py-0.5">
                  {phaseName}
                </span>
                <span>/</span>
              </>
            )}
            {parentStepName && (
              <>
                <span className="rounded-md bg-[var(--color-surface)] px-2 py-0.5">
                  {parentStepName}
                </span>
                <span>/</span>
              </>
            )}
            <span className="text-[var(--color-text-secondary)]">{t('step.thisStep')}</span>
          </div>
        )}

        <div className="mb-4 flex items-start justify-between">
          <span
            className={`inline-flex items-center rounded-lg border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[effectiveStatus]}`}
          >
            {STATUS_LABEL[effectiveStatus]}
          </span>
          <button
            onClick={onClose}
            aria-label={t('drawers.closeStepDetail')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <h3 id="step-detail-title" className="text-base font-bold leading-snug text-[var(--color-text-primary)]">
          {step.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {step.objective}
        </p>

        {/* Manual status quick-actions */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(['not_started', 'in_progress', 'completed', 'replanned'] as StepStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => handleManualStatus(s)}
              disabled={loading === 'status' || effectiveStatus === s}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-100 ${
                effectiveStatus === s
                  ? STATUS_STYLE[s] + ' cursor-default'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* "Discuter de ce step" — opens the chat panel focused on this step */}
        {onDiscussInChat && (
          <button
            onClick={() => onDiscussInChat(step)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/15"
            title="Ouvre l'assistant et lui parle spécifiquement de ce step"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 3h12v8H6l-3 3V3z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            Discuter de ce step
          </button>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── Generate prompt section ── */}
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Prompt Generation
          </h4>
          <div className="flex gap-2">
            <button
              onClick={handleGeneratePrompt}
              disabled={loading === 'prompt'}
              className="inline-flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-black shadow-sm transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-md disabled:opacity-50"
            >
              {loading === 'prompt' ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  Generating…
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 2L10.2 5.6L14 8L10.2 10.4L8 14L5.8 10.4L2 8L5.8 5.6L8 2Z"
                      fill="currentColor"
                      opacity="0.9"
                    />
                  </svg>
                  Generate Prompt
                </>
              )}
            </button>
            <button
              onClick={handlePreviewContext}
              disabled={loading === 'context'}
              title="Preview the exact context that will be sent to the LLM (no generation)"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-xs font-semibold text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
            >
              {loading === 'context' ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              ) : (
                'Preview Context'
              )}
            </button>
          </div>

          {contextPreview && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Context sent to LLM
                </span>
                <button
                  onClick={() => setContextPreview(null)}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]"
                >
                  Hide
                </button>
              </div>
              <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--color-text-secondary)]">
                {contextPreview}
              </pre>
            </div>
          )}

          {/* History toggle */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="text-[11px] font-medium text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-text-secondary)]"
            >
              {showHistory ? 'Hide' : 'Show'} prompt history
            </button>
            <span className="text-[var(--color-border)]">·</span>
            <button
              onClick={handleAnalyseRisks}
              disabled={loading === 'risks'}
              title="Read-only analysis — never modifies the step"
              className="text-[11px] font-medium text-amber-400 transition-colors hover:text-amber-300 disabled:opacity-50"
            >
              {loading === 'risks' ? 'Analysing…' : risks ? 'Re-run risk check' : 'Detect risks'}
            </button>
          </div>

          {risks && (
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Risk analysis (advisory)
                </span>
                <button
                  onClick={() => setRisks(null)}
                  className="text-[10px] font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                >
                  Dismiss
                </button>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-[var(--color-text-secondary)]">
                {risks.overall}
              </p>
              {risks.risks.length === 0 ? (
                <p className="mt-2 text-[11px] text-emerald-400">No risks identified.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {risks.risks.map((r, i) => {
                    const tone =
                      r.severity === 'critical'
                        ? 'text-red-400 bg-red-500/10'
                        : r.severity === 'warning'
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-sky-400 bg-sky-500/10'
                    return (
                      <li
                        key={i}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tone}`}
                          >
                            {r.severity}
                          </span>
                          <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                            {r.kind.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] text-[var(--color-text-primary)]">
                          {r.description}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                          <span className="font-semibold text-[var(--color-text-tertiary)]">
                            Mitigation:{' '}
                          </span>
                          {r.mitigation}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}

          {showHistory && (
            <div className="mt-2">
              {history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--color-border)] py-4 text-center text-[11px] text-[var(--color-text-tertiary)]">
                  No previous prompts for this step.
                </p>
              ) : (
                <ul className="space-y-2">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
                          {new Date(h.created_at).toLocaleString()}
                          {h.skill_ids.length > 0 && (
                            <span className="ml-2">· {h.skill_ids.length} skill(s) injected</span>
                          )}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setPrompt(h.prompt_text)}
                            className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => navigator.clipboard.writeText(h.prompt_text)}
                            className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-tertiary)]">
                        {h.prompt_text.split('\n').slice(0, 3).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {prompt && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                  Implementation Prompt
                </span>
                <button
                  onClick={handleCopy}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/10"
                >
                  Copy
                </button>
              </div>
              <pre className="mt-2 max-h-80 overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm leading-relaxed whitespace-pre-wrap text-[var(--color-text-secondary)]">
                {prompt}
              </pre>
            </div>
          )}
        </section>

        {/* ── Sub-steps section (Écran 4) ── */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              Sub-steps
              {step.sub_steps.length > 0 && (
                <span className="ml-2 text-[var(--color-text-secondary)]">
                  ({step.sub_steps.filter((s) => s.status === 'completed').length}/
                  {step.sub_steps.length})
                </span>
              )}
            </h4>
          </div>

          {step.sub_steps.length === 0 ? (
            <p className="mb-3 text-sm text-[var(--color-text-tertiary)]">
              Break this step down into 2-6 actionable sub-steps when you&apos;re ready to attack
              it.
            </p>
          ) : (
            <ul className="mb-3 space-y-2">
              {step.sub_steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((sub) => (
                  <li
                    key={sub.id}
                    onClick={() => onJumpToStep?.(sub)}
                    className={`flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-all ${
                      onJumpToStep
                        ? 'cursor-pointer hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)]'
                        : ''
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        sub.status === 'completed'
                          ? 'bg-emerald-400'
                          : sub.status === 'in_progress'
                            ? 'bg-[var(--color-accent)]'
                            : sub.status === 'replanned'
                              ? 'bg-amber-400'
                              : 'bg-neutral-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {sub.name}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {sub.objective}
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          )}

          <button
            onClick={handleGenerateSubSteps}
            disabled={loading === 'substeps'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 hover:text-[var(--color-accent)] disabled:opacity-50"
          >
            {loading === 'substeps' ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)]" />
                Generating sub-steps…
              </>
            ) : step.sub_steps.length > 0 ? (
              'Regenerate sub-steps'
            ) : (
              'Break down this step'
            )}
          </button>
        </section>

        {/* ── Feedback analysis section ── */}
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Feedback Analysis
          </h4>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Paste the response from Copilot / Cursor here…"
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] transition-colors focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 focus:outline-none"
          />
          <button
            onClick={handleApplyFeedback}
            disabled={loading === 'feedback' || !feedback.trim()}
            className="mt-3 inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-500 hover:shadow-md disabled:opacity-50"
          >
            {loading === 'feedback' ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analysing &amp; updating…
              </>
            ) : (
              'Analyse & Update Plan'
            )}
          </button>

          {analysis && (
            <AnalysisView
              analysis={analysis}
              onRegeneratePrompt={handleGeneratePrompt}
              promptLoading={loading === 'prompt'}
            />
          )}
        </section>
      </div>
      </aside>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Analysis result view                                                */
/* ------------------------------------------------------------------ */

function AnalysisView({
  analysis,
  onRegeneratePrompt,
  promptLoading,
}: {
  analysis: FeedbackAnalysis
  onRegeneratePrompt: () => void
  promptLoading: boolean
}) {
  return (
    <div className="mt-5 space-y-5 text-sm">
      {/* Completion badge */}
      <div>
        {analysis.step_complete ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Step complete
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            Work remaining
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Summary
        </h4>
        <p className="leading-relaxed text-[var(--color-text-secondary)]">{analysis.summary}</p>
      </div>

      {/* Prompt revision (Squad reviewer protocol) — only when the reviewer
          flagged the original prompt itself as the problem. */}
      {analysis.prompt_revision && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-violet-300">
              Prompt revision suggested
            </h4>
            <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-300">
              reviewer
            </span>
          </div>
          <p className="mt-2 leading-relaxed text-[var(--color-text-secondary)]">
            {analysis.prompt_revision}
          </p>
          <p className="mt-2 text-[11px] italic text-[var(--color-text-tertiary)]">
            The feedback agent (independent of the prompt agent) believes the
            original prompt itself led the coding AI astray.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onRegeneratePrompt}
              disabled={promptLoading}
              className="rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/30 disabled:opacity-50"
            >
              {promptLoading ? 'Regenerating…' : 'Regenerate prompt'}
            </button>
          </div>
        </div>
      )}

      {/* Items */}
      <div>
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
          Items
        </h4>
        <ul className="space-y-2">
          {analysis.items.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3"
            >
              <span className="mt-0.5 shrink-0">
                {item.done ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-emerald-400"
                  >
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M5 8L7 10L11 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-neutral-600"
                  >
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </span>
              <span
                className={
                  item.done
                    ? 'text-[var(--color-text-tertiary)] line-through'
                    : 'text-[var(--color-text-secondary)]'
                }
              >
                {item.description}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Recommendations
          </h4>
          <ul className="space-y-2.5">
            {analysis.recommendations.map((rec, i) => (
              <li
                key={i}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                      rec.priority === 'high'
                        ? 'bg-red-500/10 text-red-400'
                        : rec.priority === 'medium'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-neutral-800 text-neutral-500'
                    }`}
                  >
                    {rec.priority}
                  </span>
                  <span className="font-semibold text-[var(--color-text-primary)]">
                    {rec.action}
                  </span>
                </div>
                <p className="mt-2 leading-relaxed text-[var(--color-text-tertiary)]">
                  {rec.reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions */}
      {analysis.assumptions.length > 0 && (
        <div>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Assumptions
          </h4>
          <ul className="space-y-1.5">
            {analysis.assumptions.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm text-[var(--color-text-tertiary)]"
              >
                <span className="mt-0.5 text-[var(--color-text-tertiary)]">•</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
