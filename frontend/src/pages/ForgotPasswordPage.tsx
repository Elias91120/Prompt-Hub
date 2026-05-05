import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, MailCheck, Send } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { Spinner } from '../components/ui'
import { authRedirectUrl, supabase } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email) return
    setSubmitting(true)
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: authRedirectUrl() },
      )
      if (resetError) {
        setError(resetError.message)
        return
      }
      setSentTo(email.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (sentTo) {
    return (
      <AuthLayout
        title={t('forgot.sentTitle')}
        subtitle={t('forgot.sentSubtitle', { email: sentTo })}
        footer={
          <Link
            to="/login"
            className="font-semibold text-[var(--color-accent)] hover:underline"
          >
            {t('forgot.backToLogin')}
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-glow)] ring-1 ring-[var(--color-accent)]/30">
            <MailCheck className="h-7 w-7 text-[var(--color-accent)]" />
          </span>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('forgot.sentBody')}
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}
      footer={
        <Link
          to="/login"
          className="font-semibold text-[var(--color-accent)] hover:underline"
        >
          {t('forgot.backToLogin')}
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            {t('fields.email')}
          </span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="vous@exemple.com"
              className="input-field pl-9"
            />
          </div>
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full justify-center"
        >
          {submitting ? <Spinner label={t('forgot.submitting')} /> : (
            <>
              <Send className="h-4 w-4" />
              {t('forgot.submit')}
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  )
}
