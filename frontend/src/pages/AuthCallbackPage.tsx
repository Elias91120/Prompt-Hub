import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { Spinner } from '../components/ui'
import { supabase } from '../lib/supabase'

type State =
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

/**
 * Lands here when the user clicks the email-confirmation link, the
 * password-reset link, or any redirect carrying a `?code=...` PKCE
 * authorization code. We exchange the code for a session, then bounce
 * to `/`. The Supabase JS client also auto-handles legacy `#access_token`
 * URL hashes via `detectSessionInUrl: true`.
 */
export default function AuthCallbackPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let active = true

    async function exchange() {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const errorDescription =
        url.searchParams.get('error_description') ?? url.searchParams.get('error')

      try {
        if (errorDescription) {
          throw new Error(errorDescription)
        }
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          // Wait briefly for `detectSessionInUrl` to consume the URL hash.
          await new Promise((r) => setTimeout(r, 200))
        }

        const { data } = await supabase.auth.getSession()
        if (!active) return
        if (!data.session) {
          throw new Error(t('callback.noSession'))
        }
        setState({ kind: 'success' })
        setTimeout(() => navigate('/', { replace: true }), 800)
      } catch (err) {
        if (!active) return
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    void exchange()
    return () => {
      active = false
    }
  }, [navigate, t])

  if (state.kind === 'loading') {
    return (
      <AuthLayout title={t('callback.loadingTitle')} subtitle={t('callback.loadingSubtitle')}>
        <div className="flex justify-center py-4">
          <Spinner size={28} label={t('callback.loadingLabel')} />
        </div>
      </AuthLayout>
    )
  }

  if (state.kind === 'success') {
    return (
      <AuthLayout title={t('callback.successTitle')} subtitle={t('callback.successSubtitle')}>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-glow)] ring-1 ring-[var(--color-accent)]/30">
            <CheckCircle2 className="h-7 w-7 text-[var(--color-accent)]" />
          </span>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('callback.successBody')}
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('callback.errorTitle')}
      subtitle={t('callback.errorSubtitle')}
      footer={
        <button
          onClick={() => navigate('/login', { replace: true })}
          className="font-semibold text-[var(--color-accent)] hover:underline"
        >
          {t('callback.backToLogin')}
        </button>
      }
    >
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/30">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </span>
        <p
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
        >
          {state.message}
        </p>
      </div>
    </AuthLayout>
  )
}
