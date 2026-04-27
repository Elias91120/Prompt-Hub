import { useState } from 'react'
import {
  MessageSquare,
  Wand2,
  Sparkles,
  Loader2,
  ArrowRight,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import ChatPanel from './ChatPanel'
import { generatePlan } from '../api'
import type { Project } from '../types'
import { ConfirmDialog, useToast } from './ui'
import { friendlyMessage } from '../lib/errors'

interface Props {
  projectId: string
  project: Project
  hasPlan: boolean
  onProjectUpdated: (project: Project) => void
  onOpenPlan: () => void
  minimal?: boolean
}

type Tab = 'chat' | 'prompt'

const SAMPLE_PROMPTS = [
  'Application web de prise de notes augmentée par IA. Capture rapide, tags auto, résumés de dossier. Stack React + FastAPI + Postgres.',
  "Bot Slack qui répond aux questions sur la doc interne via RAG (embeddings + recherche vectorielle), avec citation des sources.",
  "API de facturation B2B : génération de PDF, paiement Stripe, webhooks compta. FastAPI + Postgres, dashboard React minimal.",
  "Dashboard temps réel pour métriques produit (DAU, rétention, funnels). Ingestion webhook, ClickHouse, React + Recharts.",
]

export default function AIWorkspace({
  projectId,
  project,
  hasPlan,
  onProjectUpdated,
  onOpenPlan,
  minimal = false,
}: Props) {
  const { t } = useTranslation('editor')
  const [tab, setTab] = useState<Tab>(hasPlan ? 'chat' : 'chat')
  const [quickPrompt, setQuickPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingInstructions, setPendingInstructions] = useState<string | null>(null)
  const toast = useToast()

  async function performGenerate(instructions: string) {
    setGenerating(true)
    setError(null)
    try {
      const updated = await generatePlan(projectId, instructions)
      onProjectUpdated(updated)
      setQuickPrompt('')
      toast.success(
        hasPlan ? t('workspace.toasts.regenerated') : t('workspace.toasts.generated'),
      )
      // After generating, jump straight to the plan view so the user sees the result.
      onOpenPlan()
    } catch (e) {
      const msg = friendlyMessage(e)
      setError(msg)
      toast.error(msg, {
        action: { label: t('common:actions.retry', { defaultValue: 'Réessayer' }), onClick: () => performGenerate(instructions) },
      })
    } finally {
      setGenerating(false)
    }
  }

  function handleGenerate(instructions: string) {
    if (hasPlan) {
      // Defer the call until the user confirms in the dialog.
      setPendingInstructions(instructions)
      return
    }
    void performGenerate(instructions)
  }

  return (
    <section className={minimal ? "" : "surface-card overflow-hidden"}>
      {/* ── Header ── */}
      {!minimal && (
        <div className="border-b border-[var(--color-border)] px-6 py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="kpi-icon">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-[var(--color-text-primary)]">
                  {t('workspace.title')}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {hasPlan ? t('workspace.subtitleWithPlan') : t('workspace.subtitleNoPlan')}
                </p>
              </div>
            </div>
            {hasPlan && (
              <button onClick={onOpenPlan} className="btn-secondary self-start sm:self-auto">
                {t('workspace.viewPlan')}
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-4 inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <TabButton
              active={tab === 'chat'}
              onClick={() => setTab('chat')}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label={t('workspace.tabs.chat')}
            />
            <TabButton
              active={tab === 'prompt'}
              onClick={() => setTab('prompt')}
              icon={<Wand2 className="h-3.5 w-3.5" />}
              label={t('workspace.tabs.prompt')}
            />
          </div>
        </div>
      )}

      {/* ── Body ── */}
      {minimal && (
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)]">
           <div className="inline-flex rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            <TabButton
              active={tab === 'chat'}
              onClick={() => setTab('chat')}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label={t('workspace.tabs.chat')}
            />
            <TabButton
              active={tab === 'prompt'}
              onClick={() => setTab('prompt')}
              icon={<Wand2 className="h-3.5 w-3.5" />}
              label={t('workspace.tabs.prompt')}
            />
          </div>
        </div>
      )}
      
      {tab === 'chat' ? (
        <ChatTab
          projectId={projectId}
          project={project}
          hasPlan={hasPlan}
          generating={generating}
          onProjectUpdated={onProjectUpdated}
          onReadyToPlan={handleGenerate}
        />
      ) : (
        <PromptTab
          hasPlan={hasPlan}
          value={quickPrompt}
          onChange={setQuickPrompt}
          onSubmit={() => handleGenerate(quickPrompt)}
          generating={generating}
        />
      )}

      {error && (
        <div className="border-t border-red-500/30 bg-red-500/10 px-6 py-3 text-xs text-red-300">
          {error}
        </div>
      )}
      <ConfirmDialog
        open={pendingInstructions !== null}
        title={t('workspace.regenerateConfirm.title')}
        message={t('workspace.regenerateConfirm.message')}
        confirmLabel={t('workspace.regenerateConfirm.confirm')}
        cancelLabel={t('workspace.regenerateConfirm.cancel')}
        variant="danger"
        onCancel={() => setPendingInstructions(null)}
        onConfirm={() => {
          const instr = pendingInstructions
          setPendingInstructions(null)
          if (instr !== null) void performGenerate(instr)
        }}
      />
    </section>
  )
}

/* ------------------------------------------------------------------ */
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={
        'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ' +
        (active
          ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] shadow-[var(--shadow-glow-sm)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]')
      }
    >
      {icon}
      {label}
    </button>
  )
}

/* ------------------------------------------------------------------ */
function ChatTab({
  projectId,
  project,
  hasPlan,
  generating,
  onProjectUpdated,
  onReadyToPlan,
}: {
  projectId: string
  project: Project
  hasPlan: boolean
  generating: boolean
  onProjectUpdated: (p: Project) => void
  onReadyToPlan: (instructions: string) => void
}) {
  const { t } = useTranslation('editor')
  return (
    <div className="flex flex-col">
      <ExplainBanner
        tone={hasPlan ? 'info' : 'success'}
        icon={<Info className="h-4 w-4" />}
        title={
          hasPlan
            ? t('workspace.chat.bannerTitleWithPlan')
            : t('workspace.chat.bannerTitleNoPlan')
        }
      >
        {hasPlan ? (
          <Trans
            i18nKey="workspace.chat.bannerWithPlan"
            ns="editor"
            components={{ strong: <strong />, em: <em /> }}
          />
        ) : (
          <Trans
            i18nKey="workspace.chat.bannerNoPlan"
            ns="editor"
            components={{ strong: <strong />, em: <em />, code: <code className="rounded bg-white/5 px-1" /> }}
          />
        )}
      </ExplainBanner>

      {/* ChatPanel needs a bounded height because its inner scroller uses h-full */}
      <div className="flex flex-col" style={{ height: '480px' }}>
        <ChatPanel
          key={projectId + ':' + (hasPlan ? 'plan' : 'noplan')}
          projectId={projectId}
          generating={generating}
          onReadyToPlan={onReadyToPlan}
          onProjectUpdated={onProjectUpdated}
          onPlanAdapted={() => {
            /* parent already gets onProjectUpdated; nothing else to do here */
            void project
          }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function PromptTab({
  hasPlan,
  value,
  onChange,
  onSubmit,
  generating,
}: {
  hasPlan: boolean
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  generating: boolean
}) {
  const { t } = useTranslation('editor')
  return (
    <div className="flex flex-col gap-4 px-6 py-5">
      <ExplainBanner
        tone={hasPlan ? 'warning' : 'info'}
        icon={
          hasPlan ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )
        }
        title={
          hasPlan
            ? t('workspace.prompt.bannerTitleWithPlan')
            : t('workspace.prompt.bannerTitleNoPlan')
        }
      >
        {hasPlan ? (
          <Trans
            i18nKey="workspace.prompt.bannerWithPlan"
            ns="editor"
            components={{ strong: <strong />, em: <em /> }}
          />
        ) : (
          t('workspace.prompt.bannerNoPlan')
        )}
      </ExplainBanner>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder={t('workspace.prompt.placeholder')}
        className="textarea-field text-sm leading-relaxed"
      />

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-tertiary)]">
          {t('workspace.prompt.examplesTitle')}
        </p>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((sample, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(sample)}
              className="chip max-w-full text-left"
              title={sample}
            >
              <span className="block max-w-[260px] truncate">{sample}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-[var(--color-text-tertiary)]">
          {t('workspace.prompt.duration')}
        </p>
        <button
          onClick={onSubmit}
          disabled={generating || !value.trim()}
          className="btn-primary"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('workspace.prompt.generating')}
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              {hasPlan ? t('workspace.prompt.regenerate') : t('workspace.prompt.generate')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
function ExplainBanner({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'info' | 'success' | 'warning'
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  const toneClasses = {
    info: 'border-sky-500/25 bg-sky-500/5 text-sky-100',
    success: 'border-[var(--color-accent)]/25 bg-[var(--color-accent)]/5 text-emerald-100',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-100',
  }[tone]
  const iconColor = {
    info: 'text-sky-300',
    success: 'text-[var(--color-accent)]',
    warning: 'text-amber-300',
  }[tone]
  return (
    <div className={`mx-6 mt-5 flex gap-3 rounded-xl border ${toneClasses} px-4 py-3`}>
      <span className={`mt-0.5 shrink-0 ${iconColor}`}>{icon}</span>
      <div className="text-[12px] leading-relaxed">
        <p className="font-semibold text-[var(--color-text-primary)]">{title}</p>
        <p className="mt-1 text-[var(--color-text-secondary)]">{children}</p>
      </div>
    </div>
  )
}
