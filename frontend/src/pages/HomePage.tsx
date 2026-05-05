import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project, ProjectCreate } from '../types'
import { createProject, deleteProject, listProjects } from '../api'
import AgentsPanel from '../components/AgentsPanel'
import AppShell from '../components/layout/AppShell'
import CreateProjectModal from '../components/CreateProjectModal'
import Hero from '../components/home/Hero'
import Features from '../components/home/Features'
import HowItWorks from '../components/home/HowItWorks'
import SamplePlanShowcase from '../components/home/SamplePlanShowcase'
import AgentsShowcase from '../components/home/AgentsShowcase'
import ProjectsSection from '../components/home/ProjectsSection'
import CTASection from '../components/home/CTASection'
import Footer from '../components/home/Footer'
import { Sparkles } from 'lucide-react'
import { ConfirmDialog, useToast } from '../components/ui'
import { friendlyMessage } from '../lib/errors'
import { useAuth } from '../lib/auth'

interface Props {
  onSelectProject: (project: Project) => void
  refreshKey?: number
}

export default function HomePage({ onSelectProject, refreshKey = 0 }: Props) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const isAuthed = !authLoading && !!user

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAgents, setShowAgents] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null)
  const toast = useToast()

  const loadProjects = useCallback(() => {
    let active = true
    setLoading(true)
    setError(null)
    listProjects()
      .then((data) => {
        if (active) setProjects(data)
      })
      .catch((e) => {
        if (active) setError(friendlyMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return loadProjects()
  }, [refreshKey, loadProjects, isAuthed])

  /** Single entry point for "I want to create a project". For
   *  unauthenticated visitors we redirect to /signup so they create
   *  an account first; signed-in users go straight to the modal. */
  const requestCreate = useCallback(() => {
    if (!isAuthed) {
      navigate('/signup', { state: { from: { pathname: '/' } } })
      return
    }
    setShowCreate(true)
  }, [isAuthed, navigate])

  async function handleCreate(data: ProjectCreate) {
    try {
      const created = await createProject(data)
      setShowCreate(false)
      toast.success(`Projet « ${created.name} » créé.`)
      onSelectProject(created)
    } catch (err) {
      toast.error(friendlyMessage(err))
    }
  }

  async function performDelete(project: Project) {
    setConfirmDelete(null)
    const previous = projects
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
    try {
      await deleteProject(project.id)
      toast.success(`Projet « ${project.name} » supprimé.`)
    } catch (err) {
      setProjects(previous)
      toast.error(friendlyMessage(err))
    }
  }

  function scrollToProjects() {
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <AppShell
        transparentTopBar
        rightSlot={
          <>
            <a href="#features" className="btn-ghost hidden sm:inline-flex">
              Fonctionnalités
            </a>
            <a href="#sample" className="btn-ghost hidden md:inline-flex">
              Exemple
            </a>
            {isAuthed && (
              <button onClick={() => setShowAgents(true)} className="btn-secondary">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Charters</span>
              </button>
            )}
            <button onClick={requestCreate} className="btn-primary">
              <span className="hidden sm:inline">
                {isAuthed ? 'Nouveau projet' : "S'inscrire gratuitement"}
              </span>
              <span className="sm:hidden">{isAuthed ? 'Nouveau' : 'S\u2019inscrire'}</span>
            </button>
          </>
        }
      >
        <Hero
          isAuthed={isAuthed}
          onCreate={requestCreate}
          onScrollToProjects={scrollToProjects}
        />
        <Features />
        <HowItWorks />
        <SamplePlanShowcase onCreate={requestCreate} isAuthed={isAuthed} />
        <AgentsShowcase />
        <ProjectsSection
          projects={projects}
          loading={loading}
          error={error}
          isAuthed={isAuthed}
          onSelectProject={onSelectProject}
          onCreate={requestCreate}
          onDelete={(id) => {
            const proj = projects.find((p) => p.id === id)
            if (proj) setConfirmDelete(proj)
          }}
          onRequestDelete={(p) => setConfirmDelete(p)}
          onRetry={() => loadProjects()}
          onDismissError={() => setError(null)}
        />
        <CTASection isAuthed={isAuthed} onCreate={requestCreate} />
        <Footer />
      </AppShell>

      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />
      <AgentsPanel open={showAgents} onClose={() => setShowAgents(false)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Supprimer ce projet ?"
        message={
          confirmDelete
            ? `« ${confirmDelete.name} » sera supprimé définitivement avec ses phases, étapes et historiques. Cette action est irréversible.`
            : ''
        }
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && performDelete(confirmDelete)}
      />
    </>
  )
}
