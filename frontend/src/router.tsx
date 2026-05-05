/* eslint-disable react-refresh/only-export-components */
import { Suspense, useCallback } from 'react'
import {
  createBrowserRouter,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { Spinner } from './components/ui'
import type { Project } from './types'

import { lazyRetry } from './lib/lazy'

/**
 * Each page is loaded on demand. This keeps the initial bundle small —
 * the home page no longer ships React Flow, the heavy chat panel,
 * etc. The Suspense boundary shows a centered spinner while a chunk
 * is being fetched.
 */
const HomePage = lazyRetry(() => import('./pages/HomePage'))
const ProjectOverviewPage = lazyRetry(() => import('./pages/ProjectOverviewPage'))
const PlanPage = lazyRetry(() => import('./pages/PlanPage'))
const LoginPage = lazyRetry(() => import('./pages/LoginPage'))
const SignupPage = lazyRetry(() => import('./pages/SignupPage'))
const AuthCallbackPage = lazyRetry(() => import('./pages/AuthCallbackPage'))
const ForgotPasswordPage = lazyRetry(() => import('./pages/ForgotPasswordPage'))

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--color-surface)]">
      <Spinner label="Chargement…" />
    </div>
  )
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>
}

/**
 * Application router. URLs are stable so users can refresh, share and use
 * the browser back/forward buttons.
 *
 *   /                         → Home (project list, marketing)
 *   /login                    → Sign in
 *   /signup                   → Create account
 *   /forgot-password          → Reset password request
 *   /auth/callback            → Email confirmation / PKCE landing
 *   /projects/:id             → Project overview (read-only for demos)
 *   /projects/:id/plan        → Plan view (read-only for demos)
 */

function HomeRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const handleSelect = useCallback(
    (p: Project) => {
      navigate(`/projects/${p.id}`, { state: { project: p } })
    },
    [navigate],
  )
  return <HomePage key={location.key} onSelectProject={handleSelect} />
}

function OverviewRoute() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const initialProject = (location.state as { project?: Project } | null)?.project

  if (!projectId) return <Navigate to="/" replace />

  return (
    <ProjectOverviewPage
      key={projectId}
      projectId={projectId}
      initialProject={initialProject}
      onBack={() => navigate('/')}
      onOpenPlan={(p) =>
        navigate(`/projects/${p.id}/plan`, { state: { project: p } })
      }
    />
  )
}

function PlanRoute() {
  const { projectId, stepId } = useParams<{ projectId: string; stepId?: string }>()
  const navigate = useNavigate()
  if (!projectId) return <Navigate to="/" replace />

  return (
    <PlanPage
      key={projectId}
      projectId={projectId}
      selectedStepId={stepId ?? null}
      onSelectStep={(id) => {
        if (id) navigate(`/projects/${projectId}/plan/steps/${id}`, { replace: true })
        else navigate(`/projects/${projectId}/plan`, { replace: true })
      }}
      onBack={() => navigate(`/projects/${projectId}`)}
    />
  )
}

export const router = createBrowserRouter([
  { path: '/', element: withSuspense(<HomeRoute />) },
  { path: '/login', element: withSuspense(<LoginPage />) },
  { path: '/signup', element: withSuspense(<SignupPage />) },
  { path: '/forgot-password', element: withSuspense(<ForgotPasswordPage />) },
  { path: '/auth/callback', element: withSuspense(<AuthCallbackPage />) },
  {
    path: '/projects/:projectId',
    element: withSuspense(<OverviewRoute />),
  },
  {
    path: '/projects/:projectId/plan',
    element: withSuspense(<PlanRoute />),
    children: [{ path: 'steps/:stepId', element: null }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
