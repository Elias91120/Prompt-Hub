import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles, Settings2, Code2, Target, Zap, Activity } from 'lucide-react'
import type { Project, ProjectRecap } from '../types'
import { getProject, getProjectRecap } from '../api'
import AppShell from '../components/layout/AppShell'
import AIWorkspace from '../components/AIWorkspace'
import { ErrorBanner, Skeleton } from '../components/ui'
import ProjectSettingsModal from '../components/ProjectSettingsModal'

interface Props {
  projectId: string
  initialProject?: Project
  onBack: () => void
  onOpenPlan: (project: Project) => void
}

function computeStats(project: Project) {
  const phaseCount = project.phases.length
  let topSteps = 0
  let subSteps = 0
  let completed = 0
  let inProgress = 0
  let notStarted = 0
  for (const ph of project.phases) {
    for (const s of ph.steps) {
      topSteps += 1
      if (s.status === 'completed') completed += 1
      else if (s.status === 'in_progress') inProgress += 1
      else if (s.status === 'not_started') notStarted += 1
      for (const sub of s.sub_steps) {
        subSteps += 1
        if (sub.status === 'completed') completed += 1
        else if (sub.status === 'in_progress') inProgress += 1
        else if (sub.status === 'not_started') notStarted += 1
      }
    }
  }
  const total = topSteps + subSteps
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { phaseCount, topSteps, subSteps, completed, inProgress, notStarted, pct, total }
}

export default function ProjectOverviewPage({
  projectId,
  initialProject,
  onBack,
  onOpenPlan,
}: Props) {
  const { t } = useTranslation('common')
  const [project, setProject] = useState<Project | null>(initialProject ?? null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // AI Recap State
  const [recap, setRecap] = useState<ProjectRecap | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)

  useEffect(() => {
    let active = true
    getProject(projectId)
      .then((p) => {
        if (active) {
          setProject(p)
          setLoadError(null)
        }
      })
      .catch((err) => {
        if (active && !initialProject) setLoadError(err)
      })
    return () => { active = false }
  }, [projectId, initialProject])

  const stats = useMemo(() => (project ? computeStats(project) : null), [project])
  const hasPlan = stats ? stats.phaseCount > 0 : false

  async function handleLoadRecap() {
    setRecapLoading(true)
    try {
      const res = await getProjectRecap(projectId)
      setRecap(res)
    } catch (e) {
      console.error(e)
    } finally {
      setRecapLoading(false)
    }
  }

  if (!project || !stats) {
    return (
      <AppShell onBack={onBack} backLabel="Mes projets">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          {loadError ? (
            <ErrorBanner error={loadError} title="Impossible de charger le projet" onRetry={() => window.location.reload()} />
          ) : (
            <div className="space-y-8">
              <Skeleton className="h-32 w-full rounded-3xl" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <Skeleton className="h-96 w-full rounded-3xl" />
                <Skeleton className="h-96 w-full rounded-3xl lg:col-span-2" />
              </div>
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell
      onBack={onBack}
      backLabel={t('breadcrumbs.projects')}
      breadcrumbs={[{ label: t('breadcrumbs.projects'), to: '/' }, { label: project.name }]}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:py-12">
        {/* HEADER SECTION */}
        <header className="mb-10 flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-3 py-1 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">
                Vue d'ensemble
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              {project.name}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
              {project.objective || <em className="opacity-50">Aucun objectif défini.</em>}
            </p>
          </div>

          <div className="shrink-0">
            {hasPlan ? (
              <button
                onClick={() => onOpenPlan(project)}
                className="group relative inline-flex items-center gap-3 rounded-2xl bg-[var(--color-accent)] px-6 py-3.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all hover:scale-105 hover:bg-[var(--color-accent-hover)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)]"
              >
                Ouvrir le Plan Visuel
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <button
                onClick={() => {
                  document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="group inline-flex items-center gap-2 rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] px-6 py-3.5 text-sm font-bold text-[var(--color-text-primary)] transition-all hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-surface-hover)]"
              >
                Générer un Plan
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        </header>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          
          {/* LEFT SIDEBAR: Context & Stats */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            {/* Progress Card */}
            {hasPlan && (
              <div className="glass-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Progression
                  </h3>
                  <span className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.pct}%</span>
                </div>
                
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                  <div
                    className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-1000 ease-out"
                    style={{ width: `${stats.pct}%` }}
                  />
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <div className="rounded-lg bg-emerald-500/10 py-2 text-emerald-400">
                    <span className="block text-lg font-bold">{stats.completed}</span> Fait
                  </div>
                  <div className="rounded-lg bg-[var(--color-accent)]/10 py-2 text-[var(--color-accent)]">
                    <span className="block text-lg font-bold">{stats.inProgress}</span> En cours
                  </div>
                  <div className="rounded-lg bg-[var(--color-surface-hover)] py-2 text-[var(--color-text-tertiary)]">
                    <span className="block text-lg font-bold">{stats.notStarted}</span> À faire
                  </div>
                </div>
              </div>
            )}

            {/* Settings & Context Card */}
            <div className="glass-card relative overflow-hidden p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-2">
                  <Settings2 className="h-4 w-4" /> Paramètres & Contexte
                </h3>
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="rounded-full bg-[var(--color-surface-hover)] p-2 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-accent)]/20 hover:text-[var(--color-accent)]"
                  title="Modifier les paramètres"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    <Code2 className="h-3 w-3" /> Stack
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {project.stack || <em className="opacity-50">Non spécifiée</em>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    <Target className="h-3 w-3" /> Contraintes
                  </div>
                  <div className="text-sm text-[var(--color-text-secondary)]">
                    {project.constraints || <em className="opacity-50">Aucune contrainte</em>}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    <Zap className="h-3 w-3" /> Règles & Palette
                  </div>
                  <div className="text-sm leading-relaxed text-[var(--color-text-secondary)] line-clamp-4">
                    {project.decisions_log || <em className="opacity-50">Aucune règle définie</em>}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recap Minified */}
            {hasPlan && (
              <div className="glass-card p-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-2 mb-4">
                  <Activity className="h-4 w-4" /> Rapport IA
                </h3>
                {!recap ? (
                  <button
                    onClick={handleLoadRecap}
                    disabled={recapLoading}
                    className="w-full rounded-xl border border-dashed border-[var(--color-border)] py-4 text-xs font-medium text-[var(--color-text-tertiary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                  >
                    {recapLoading ? 'Analyse en cours...' : 'Générer un résumé du projet'}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      <strong className="text-[var(--color-accent)] block mb-1">Status actuel :</strong>
                      {recap.where_we_are}
                    </p>
                    <button
                      onClick={handleLoadRecap}
                      className="text-[10px] uppercase font-bold text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                    >
                      Actualiser
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: AI Workspace (Chat) */}
          <div className="lg:col-span-8">
            <div className="glass-card flex min-h-[600px] flex-col overflow-hidden" id="workspace" style={{ padding: 0 }}>
              <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-6 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]/20">
                  <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Atelier IA</h2>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">Discutez avec l'IA pour générer ou modifier le plan.</p>
                </div>
              </div>
              <div className="flex-1 bg-[var(--color-surface)] relative">
                <AIWorkspace
                  projectId={projectId}
                  project={project}
                  hasPlan={hasPlan}
                  onProjectUpdated={setProject}
                  onOpenPlan={() => onOpenPlan(project)}
                  minimal={true}
                />
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {project && (
        <ProjectSettingsModal
          project={project}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onProjectUpdated={setProject}
        />
      )}
    </AppShell>
  )
}
