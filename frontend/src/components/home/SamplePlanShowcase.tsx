import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  Check,
  Code2,
  Copy,
  FileCode,
  FolderKanban,
  Layers,
  Lock,
  Rocket,
  Sparkles,
  Target,
  UserPlus,
} from 'lucide-react'

interface Props {
  isAuthed: boolean
  onCreate: () => void
}

interface Step {
  name: string
  type: 'frontend' | 'backend' | 'infra' | 'other'
  status: 'completed' | 'in_progress' | 'not_started'
  objective: string
}

interface Phase {
  id: string
  name: string
  goal: string
  steps: Step[]
}

const TYPE_LABEL: Record<Step['type'], string> = {
  frontend: 'Front',
  backend: 'API',
  infra: 'Infra',
  other: 'Autre',
}

const TYPE_TONE: Record<Step['type'], string> = {
  frontend: 'text-sky-300 bg-sky-500/10 ring-sky-500/20',
  backend: 'text-emerald-300 bg-emerald-500/10 ring-emerald-500/20',
  infra: 'text-amber-300 bg-amber-500/10 ring-amber-500/20',
  other: 'text-indigo-300 bg-indigo-500/10 ring-indigo-500/20',
}

const STATUS_DOT: Record<Step['status'], string> = {
  completed: 'bg-emerald-400 ring-emerald-400/40',
  in_progress: 'bg-amber-400 ring-amber-400/40 animate-pulse',
  not_started: 'bg-[var(--color-border-strong)] ring-white/5',
}

/** Plan d'exemple : "TaskFlow", un SaaS de gestion de tâches en équipe.
 *
 *  Les données sont volontairement statiques — c'est un teaser visuel,
 *  pas un appel API. Elles illustrent ce qu'une vraie génération produit.
 */
const SAMPLE_PROJECT = {
  name: 'TaskFlow',
  pitch:
    "SaaS de gestion de tâches en équipe : tableaux Kanban, assignation, échéances, et notifications temps réel. Stack React + FastAPI + Postgres déployé sur Vercel + Render.",
  objective:
    "Lancer un MVP payant en 6 semaines avec auth, paiements Stripe et 2 personas validées (PM, dev).",
}

const SAMPLE_PHASES: Phase[] = [
  {
    id: 'cadrage',
    name: 'Cadrage produit',
    goal: 'Aligner sur la valeur, le périmètre MVP et la stack.',
    steps: [
      {
        name: 'Définir les 2 personas et leurs jobs',
        type: 'other',
        status: 'completed',
        objective:
          "Décrire PM (suit l'avancement) + Dev (capture ses tickets) avec un job-to-be-done par persona.",
      },
      {
        name: 'Lister les hypothèses risquées',
        type: 'other',
        status: 'completed',
        objective:
          "Identifier les 5 risques majeurs (acquisition, monétisation, rétention, perf, sécurité) et la façon de les tester.",
      },
      {
        name: 'Choisir la stack et l\u2019hébergement',
        type: 'infra',
        status: 'completed',
        objective:
          'Trancher React + Vite, FastAPI + Postgres, déploiement Vercel + Render. Documenter les arbitrages.',
      },
    ],
  },
  {
    id: 'mvp',
    name: 'MVP technique',
    goal: 'Construire le squelette utilisable de bout en bout.',
    steps: [
      {
        name: 'Authentification email + vérification',
        type: 'backend',
        status: 'in_progress',
        objective:
          'Inscription, login, vérification de mail et reset password via Supabase Auth. Sessions persistées côté client.',
      },
      {
        name: 'Modèle de données Kanban',
        type: 'backend',
        status: 'not_started',
        objective:
          'Schéma Postgres : workspaces, boards, columns, tasks (avec ordre), assignees. Index pour requêtes board.',
      },
      {
        name: 'API CRUD tâches',
        type: 'backend',
        status: 'not_started',
        objective:
          'Endpoints REST FastAPI : créer, lister, déplacer, assigner. Pagination + filtres par assignee/échéance.',
      },
      {
        name: 'UI Kanban avec drag & drop',
        type: 'frontend',
        status: 'not_started',
        objective:
          "Vue 3 colonnes (À faire / En cours / Fait), drag & drop fluide, mise à jour optimiste de l'ordre.",
      },
      {
        name: 'Notifications temps réel',
        type: 'frontend',
        status: 'not_started',
        objective:
          "Souscription aux changements via Supabase Realtime (postgres_changes) sur la table tasks du board ouvert.",
      },
    ],
  },
  {
    id: 'lancement',
    name: 'Lancement payant',
    goal: 'Encaisser les premiers euros et instrumenter.',
    steps: [
      {
        name: 'Intégration Stripe Checkout',
        type: 'backend',
        status: 'not_started',
        objective:
          'Plans Free / Pro, webhooks d\u2019abonnement, gestion des statuts (active / past_due / canceled).',
      },
      {
        name: 'Page de pricing & upgrade',
        type: 'frontend',
        status: 'not_started',
        objective:
          "Page publique avec 2 plans, CTA upgrade depuis l'app, écran post-checkout de confirmation.",
      },
      {
        name: 'Analytics produit (PostHog)',
        type: 'infra',
        status: 'not_started',
        objective:
          "Événements clés : signup, board_created, task_completed, plan_upgraded. Funnel d'activation.",
      },
    ],
  },
]

const PROMPT_PREVIEW = `# Contexte du projet
Nom: TaskFlow — SaaS de gestion de tâches en équipe
Objectif: Lancer un MVP payant en 6 semaines (auth, Stripe, 2 personas validées)
Stack: React + Vite (front), FastAPI + Postgres (back), Vercel + Render (infra)

# Step ciblé
"Authentification email + vérification" (backend, in_progress)
Objectif: Inscription, login, vérification mail, reset via Supabase Auth.

# Décisions déjà prises (extrait)
- Postgres managé chez Supabase (eu-west-1), connexion via DB_HOST/DB_PASSWORD côté API
- Sessions PKCE persistées côté client (storageKey "taskflow.auth")
- Backend valide les JWT HS256 avec SUPABASE_JWT_SECRET, dépendance get_current_user

# Tâche pour Cursor / Claude
Implémente:
1. Page /signup (email + mdp) appelant supabase.auth.signUp avec emailRedirectTo
2. Écran "Vérifie ta boîte mail" si data.session est null
3. /auth/callback qui appelle exchangeCodeForSession et redirige vers /
4. Helper authHeader() injectant "Authorization: Bearer <jwt>" dans api.ts
5. Endpoint FastAPI POST /me qui renvoie l'utilisateur courant via get_current_user

Contraintes:
- Aucune donnée auth.users dupliquée côté API. Utiliser uniquement le JWT.
- Tous les writes sur /tasks/* doivent exiger get_current_user.
- Tester signup → email reçu → confirm → session valide → POST /me 200.`

export default function SamplePlanShowcase({ isAuthed, onCreate }: Props) {
  const { t } = useTranslation('marketing')
  const [activePhase, setActivePhase] = useState<string>(SAMPLE_PHASES[1].id)
  const [openStep, setOpenStep] = useState<string>(SAMPLE_PHASES[1].steps[0].name)
  const [copied, setCopied] = useState(false)

  const phase = useMemo(
    () => SAMPLE_PHASES.find((p) => p.id === activePhase) ?? SAMPLE_PHASES[0],
    [activePhase],
  )

  function handleCopy() {
    void navigator.clipboard.writeText(PROMPT_PREVIEW).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <section id="sample" className="relative px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="eyebrow mb-3 justify-center">{t('sample.eyebrow')}</span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t('sample.title')}{' '}
            <span className="gradient-text">{t('sample.titleHighlight')}</span>
          </h2>
          <p className="mt-3 text-[var(--color-text-secondary)]">
            {t('sample.subtitle')}
          </p>
        </div>

        {/* Project header card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.4 }}
          className="glass-card relative mb-6 overflow-hidden p-6 sm:p-8"
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span className="kpi-icon">
                  <FolderKanban className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {SAMPLE_PROJECT.name}
                  </h3>
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t('sample.demoLabel')}
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {SAMPLE_PROJECT.pitch}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="chip">
                  <Target className="h-3 w-3" />
                  {SAMPLE_PROJECT.objective}
                </span>
              </div>
            </div>
            <div className="hidden sm:flex sm:flex-col sm:items-end sm:gap-2">
              <span className="badge badge-success">
                <Sparkles className="h-3 w-3" />
                {t('sample.generated')}
              </span>
              <span className="text-[10px] text-[var(--color-text-tertiary)]">
                {t('sample.generatedHint')}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Phase tabs */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {SAMPLE_PHASES.map((p, idx) => {
            const isActive = p.id === activePhase
            const Icon = idx === 0 ? Layers : idx === 1 ? Code2 : Rocket
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActivePhase(p.id)
                  setOpenStep(p.steps[0].name)
                }}
                className={`group flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                  isActive
                    ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-text-primary)] shadow-[var(--shadow-glow-sm)]'
                    : 'border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    isActive
                      ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]'
                      : 'bg-white/5 text-[var(--color-text-tertiary)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-tertiary)]">
                    Phase {String(idx + 1).padStart(2, '0')}
                  </div>
                  <div className="text-sm font-semibold">{p.name}</div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Steps list */}
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-card p-5 lg:col-span-3"
          >
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {phase.name}
                </h4>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  {phase.goal}
                </p>
              </div>
              <span className="chip text-[10px]">
                {phase.steps.length} {t('sample.stepsCount')}
              </span>
            </div>

            <ul className="space-y-2">
              {phase.steps.map((step, idx) => {
                const isOpen = openStep === step.name
                return (
                  <motion.li
                    key={step.name}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25, delay: idx * 0.04 }}
                    className={`rounded-xl border transition-all ${
                      isOpen
                        ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.06]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenStep(isOpen ? '' : step.name)}
                      className="flex w-full items-start gap-3 p-3.5 text-left"
                    >
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ring-2 ${STATUS_DOT[step.status]}`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">
                            {step.name}
                          </span>
                          <span
                            className={`inline-flex h-5 items-center rounded-md px-1.5 text-[10px] font-semibold ring-1 ring-inset ${TYPE_TONE[step.type]}`}
                          >
                            {TYPE_LABEL[step.type]}
                          </span>
                          {step.status === 'completed' && (
                            <span className="badge badge-success text-[10px]">
                              <Check className="h-2.5 w-2.5" />
                              {t('sample.statusDone')}
                            </span>
                          )}
                          {step.status === 'in_progress' && (
                            <span className="badge badge-warning text-[10px]">
                              {t('sample.statusInProgress')}
                            </span>
                          )}
                        </div>
                        {isOpen && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            transition={{ duration: 0.2 }}
                            className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]"
                          >
                            {step.objective}
                          </motion.p>
                        )}
                      </div>
                      <span className="mt-1 text-[var(--color-text-tertiary)]">
                        <ArrowRight
                          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                      </span>
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          </motion.div>

          {/* Prompt preview */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-2"
          >
            <div className="glass-card flex h-full flex-col overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="kpi-icon" style={{ width: '1.75rem', height: '1.75rem' }}>
                    <FileCode className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {t('sample.promptTitle')}
                    </div>
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">
                      {t('sample.promptSubtitle')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-ghost text-[11px]"
                  aria-label={t('sample.copy')}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      {t('sample.copied')}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {t('sample.copy')}
                    </>
                  )}
                </button>
              </div>
              <pre className="max-h-[440px] flex-1 overflow-auto px-4 py-4 font-mono text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                <code>{PROMPT_PREVIEW}</code>
              </pre>
              <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-raised)]/40 px-4 py-3 text-[11px] text-[var(--color-text-tertiary)]">
                <Lock className="mr-1 inline h-3 w-3" />
                {t('sample.promptFooter')}
              </div>
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 text-center sm:flex-row"
        >
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isAuthed ? t('sample.ctaCopyAuthed') : t('sample.ctaCopyAnon')}
          </p>
          <button onClick={onCreate} className="btn-primary">
            {isAuthed ? (
              <>
                <Sparkles className="h-4 w-4" />
                {t('sample.ctaButtonAuthed')}
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                {t('sample.ctaButtonAnon')}
              </>
            )}
          </button>
        </motion.div>
      </div>
    </section>
  )
}
