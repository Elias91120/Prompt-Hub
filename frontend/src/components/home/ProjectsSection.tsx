import { motion } from 'framer-motion'
import { Sparkles, Trash2, FolderPlus, FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../../types'
import { ErrorBanner, Skeleton } from '../ui'

interface Props {
  projects: Project[]
  loading: boolean
  error: string | null
  onSelectProject: (project: Project) => void
  onCreate: () => void
  onDelete: (projectId: string) => void
  /** Optional retry handler shown on the error banner. */
  onRetry?: () => void
  /** Optional dismiss handler so the user can hide the error. */
  onDismissError?: () => void
  /** Pre-confirmed delete handler (skip the in-card confirm() dialog). */
  onRequestDelete?: (project: Project) => void
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const sec = Math.round(diff / 1000)
  if (sec < 60) return "à l'instant"
  const min = Math.round(sec / 60)
  if (min < 60) return `il y a ${min}m`
  const hr = Math.round(min / 60)
  if (hr < 24) return `il y a ${hr}h`
  const day = Math.round(hr / 24)
  if (day < 7) return `il y a ${day}j`
  const wk = Math.round(day / 7)
  if (wk < 5) return `il y a ${wk}sem`
  const mo = Math.round(day / 30)
  if (mo < 12) return `il y a ${mo}mois`
  return `il y a ${Math.round(day / 365)}an`
}

export default function ProjectsSection({
  projects,
  loading,
  error,
  onSelectProject,
  onCreate,
  onDelete,
  onRetry,
  onDismissError,
  onRequestDelete,
}: Props) {
  const { t } = useTranslation('home')
  return (
    <section id="projects" className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="eyebrow mb-3">{t('projects.sectionTitle')}</span>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {t('projects.sectionTitle')}
            </h2>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              {t('projects.sectionSubtitle')}
            </p>
          </div>
          <button onClick={onCreate} className="btn-primary self-start sm:self-auto">
            <FolderPlus className="h-4 w-4" />
            {t('common:actions.newProject')}
          </button>
        </div>

        <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-[var(--color-text-secondary)] shadow-sm">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Sparkles className="h-3 w-3" />
            </div>
            <div>
              <strong className="text-emerald-400">Mode Beta - Compte partagé</strong>
              <p className="mt-1">
                Afin de faciliter les tests et de recueillir vos avis, Prompt Hub est actuellement en accès libre sans création de compte. 
                <strong className="text-[var(--color-text-primary)]"> Tous les projets créés ici sont visibles par l'ensemble des testeurs.</strong> Merci de ne pas inclure de données confidentielles ou sensibles.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <ErrorBanner
            className="mb-6"
            error={error}
            title={t('errors:loadProjectsFailed')}
            onRetry={onRetry}
            onDismiss={onDismissError}
          />
        )}

        {loading ? (
          <div
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label={t('common:loading.default')}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[180px] w-full rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, idx) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={idx}
                onSelect={() => onSelectProject(p)}
                onDelete={() =>
                  onRequestDelete ? onRequestDelete(p) : onDelete(p.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function ProjectCard({
  project,
  index,
  onSelect,
  onDelete,
}: {
  project: Project
  index: number
  onSelect: () => void
  onDelete: () => void
}) {
  const totalSteps = project.phases.reduce(
    (n, ph) => n + ph.steps.reduce((m, s) => m + 1 + s.sub_steps.length, 0),
    0,
  )
  const completedSteps = project.phases.reduce(
    (n, ph) =>
      n +
      ph.steps.reduce(
        (m, s) =>
          m +
          (s.status === 'completed' ? 1 : 0) +
          s.sub_steps.filter((sub) => sub.status === 'completed').length,
        0,
      ),
    0,
  )
  const hasPlan = project.phases.length > 0
  const pct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.4) }}
      className="group glass-card-hover relative flex flex-col p-5 text-left"
    >
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Ouvrir ${project.name}`}
      />
      <div className="relative flex items-start justify-between">
        <span className="kpi-icon">
          <Sparkles className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            // Parent owns the confirmation flow (ConfirmDialog).
            onDelete()
          }}
          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100 focus-visible:opacity-100"
          aria-label={`Supprimer ${project.name}`}
          title="Supprimer le projet"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <h3 className="relative mt-4 text-sm font-semibold text-[var(--color-text-primary)]">
        {project.name}
      </h3>
      <p className="relative mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {project.objective}
      </p>

      {project.stack && (
        <div className="relative mt-3">
          <span className="chip">
            <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" />
            {project.stack}
          </span>
        </div>
      )}

      <div className="relative mt-auto flex items-center gap-3 pt-5">
        {hasPlan ? (
          <>
            <span className="badge badge-success">
              {project.phases.length} phase{project.phases.length !== 1 && 's'}
            </span>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {completedSteps}/{totalSteps} étapes
            </span>
            {totalSteps > 0 && (
              <div className="ml-auto h-1 w-14 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-1 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-emerald-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </>
        ) : (
          <span className="badge badge-warning">Aucun plan</span>
        )}
      </div>

      <div className="relative mt-2 text-[10px] text-[var(--color-text-tertiary)]">
        modifié {formatRelativeTime(project.updated_at)}
      </div>
    </motion.div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation('home')
  return (
    <div className="glass-card flex flex-col items-center justify-center overflow-hidden px-6 py-16 text-center relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--color-surface)]/50 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center">
        <span className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-accent)]/20 to-emerald-500/10 shadow-inner ring-1 ring-inset ring-[var(--color-accent)]/20">
          <FolderOpen className="h-8 w-8 text-[var(--color-accent)]" />
        </span>
        <h3 className="text-xl font-bold text-[var(--color-text-primary)]">
          {t('projects.empty.title')}
        </h3>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {t('projects.empty.description')}
        </p>
        
        <div className="mt-8 grid max-w-lg gap-4 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
            <h4 className="text-sm font-semibold text-emerald-400">1. Décrivez</h4>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Donnez le contexte et l'objectif de votre projet.</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/50 p-4">
            <h4 className="text-sm font-semibold text-emerald-400">2. L'IA structure</h4>
            <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">Génération d'un plan détaillé en phases et étapes.</p>
          </div>
        </div>

        <button onClick={onCreate} className="btn-primary mt-8 px-8 py-3 text-base shadow-xl shadow-[var(--color-accent)]/10 hover:shadow-[var(--color-accent)]/20">
          <Sparkles className="h-5 w-5" />
          {t('projects.empty.cta')}
        </button>
      </div>
    </div>
  )
}
