import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles, Code2, Target, Zap, Activity, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'config'>('dashboard')
  
  const stats = useMemo(() => (project ? computeStats(project) : null), [project])
  const hasPlan = stats ? stats.phaseCount > 0 : false
  
  const [chatExpanded, setChatExpanded] = useState(false)
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)

  // Auto-expand AI workspace only if project has no plan
  useEffect(() => {
    if (project && stats && !hasAutoExpanded) {
      if (stats.phaseCount === 0) {
        setChatExpanded(true)
      }
      setHasAutoExpanded(true)
    }
  }, [project, stats, hasAutoExpanded])

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
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-12">
        {/* HEADER SECTION */}
        <header className="mb-8 flex flex-col items-stretch gap-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-3 py-1 mb-4">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-accent)]">
                Projet Actif
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              {project.name}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
              {project.objective || <em className="opacity-50">Aucun objectif défini.</em>}
            </p>
          </div>

          <div className="shrink-0 w-full sm:w-auto">
            {hasPlan ? (
              <button
                onClick={() => onOpenPlan(project)}
                className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--color-accent)] px-6 py-3.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all hover:scale-[1.02] hover:bg-[var(--color-accent-hover)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] sm:inline-flex sm:w-auto sm:hover:scale-105"
              >
                Ouvrir le Plan Visuel
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : null}
          </div>
        </header>

        {/* TABS SELECTOR */}
        <div className="mb-6 flex gap-4 overflow-x-auto border-b border-[var(--color-border)] pb-px sm:mb-8 sm:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`pb-4 text-sm font-bold transition-all ${
              activeTab === 'dashboard'
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            Tableau de bord
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-4 text-sm font-bold transition-all ${
              activeTab === 'config'
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
            }`}
          >
            Paramètres du projet
          </button>
        </div>

        {activeTab === 'dashboard' ? (
          /* DASHBOARD VIEW */
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            
            {/* LEFT SIDEBAR: Stats */}
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

              {/* AI Recap Card */}
              {hasPlan && (
                <div className="glass-card p-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4" /> Rapport d'état
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
                        <strong className="text-[var(--color-accent)] block mb-1">Résumé :</strong>
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

              {/* Small Context Reminder */}
              <div className="glass-card p-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4">
                   Contexte rapide
                </h3>
                <div className="space-y-3">
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    <span className="font-bold text-[var(--color-text-tertiary)] uppercase mr-1">Stack:</span>
                    {project.stack || 'Non spécifiée'}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-secondary)]">
                    <span className="font-bold text-[var(--color-text-tertiary)] uppercase mr-1">Rules:</span>
                    {project.decisions_log ? 'Définies' : 'Aucune'}
                  </div>
                  <button 
                    onClick={() => setActiveTab('config')}
                    className="text-[10px] font-bold text-[var(--color-accent)] hover:underline"
                  >
                    Voir tout
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: AI Workspace (Chat) - COLLAPSIBLE */}
            <div className="lg:col-span-8">
              <div
                className={`glass-card flex flex-col overflow-hidden transition-all duration-300 ${chatExpanded ? 'min-h-[min(480px,calc(100dvh-11rem))] sm:min-h-[480px]' : 'min-h-0'}`}
                id="workspace"
                style={{ padding: 0 }}
              >
                <div 
                  className="flex cursor-pointer items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 transition-colors hover:bg-[var(--color-surface-hover)] sm:px-6"
                  onClick={() => setChatExpanded(!chatExpanded)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)]/20">
                      {chatExpanded ? (
                        <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-[var(--color-text-primary)]">
                        Atelier IA
                        {!chatExpanded && (
                          <span className="ml-2 text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                            — Cliquez pour agrandir
                          </span>
                        )}
                      </h2>
                    </div>
                  </div>
                  <div className="text-[var(--color-text-tertiary)]">
                     {chatExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                
                {chatExpanded && (
                  <div className="flex-1 bg-[var(--color-surface)] relative animate-in fade-in slide-in-from-top-2 duration-300">
                    <AIWorkspace
                      projectId={projectId}
                      project={project}
                      hasPlan={hasPlan}
                      onProjectUpdated={setProject}
                      onOpenPlan={() => onOpenPlan(project)}
                      minimal={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* CONFIGURATION VIEW: The "Real Mini Page" */
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-8 lg:grid-cols-2">
              
              {/* Identity Section */}
              <div className="glass-card p-8">
                <div className="mb-6 flex items-center gap-3">
                   <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
                      <Target className="h-5 w-5" />
                   </div>
                   <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Identité du Projet</h3>
                </div>
                <div className="space-y-6">
                   <ConfigItem label="Nom du projet" value={project.name} />
                   <ConfigItem label="Objectif principal" value={project.objective} />
                   <ConfigItem label="Description détaillée" value={project.description} />
                </div>
              </div>

              {/* Technical Section */}
              <div className="glass-card p-8">
                <div className="mb-6 flex items-center gap-3">
                   <div className="rounded-xl bg-purple-500/10 p-2 text-purple-400">
                      <Code2 className="h-5 w-5" />
                   </div>
                   <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Environnement Technique</h3>
                </div>
                <div className="space-y-6">
                   <ConfigItem label="Stack Technologique" value={project.stack} placeholder="Ex: React, FastAPI, Postgres..." />
                   <ConfigItem label="Contraintes globales" value={project.constraints} placeholder="Ex: Budget, Deadlines, Accessibilité..." />
                </div>
              </div>

              {/* Rules & Style Section */}
              <div className="lg:col-span-2 glass-card p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-[var(--color-accent)]/10 p-2 text-[var(--color-accent)]">
                        <Zap className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Règles métier & Charte graphique</h3>
                  </div>
                  <button 
                    onClick={() => setSettingsOpen(true)}
                    className="btn-primary py-2 px-4 text-xs"
                  >
                    Modifier tout
                  </button>
                </div>
                <div className="rounded-xl bg-[var(--color-surface-hover)] p-6 font-mono text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap border border-[var(--color-border)]">
                   {project.decisions_log || "Aucune règle spécifique définie pour le moment."}
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-4">
               <button 
                 onClick={() => setSettingsOpen(true)}
                 className="btn-secondary px-8 py-3 text-sm font-bold"
               >
                 Ouvrir l'éditeur complet
               </button>
            </div>
          </div>
        )}
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

function ConfigItem({ label, value, placeholder }: { label: string, value: string | null | undefined, placeholder?: string }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-tertiary)]">{label}</div>
      <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {value ? value : <span className="opacity-30 italic">{placeholder || 'Non renseigné'}</span>}
      </div>
    </div>
  )
}
