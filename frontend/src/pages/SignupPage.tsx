import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mail, Lock, MailCheck, UserPlus } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { Spinner } from '../components/ui'
import { authRedirectUrl, supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

interface LocationState {
  from?: { pathname: string }
}

export default function SignupPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState<string | null>(null)

  const target = (location.state as LocationState | null)?.from?.pathname ?? '/'

  useEffect(() => {
    if (!loading && user) {
      navigate(target, { replace: true })
    }
  }, [user, loading, navigate, target])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError(t('errors.missingFields'))
      return
    }
    if (password.length < 8) {
      setError(t('errors.passwordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('errors.passwordMismatch'))
      return
    }
    setSubmitting(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: authRedirectUrl() },
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      // When "Confirm email" is enabled (which is the case for Prompt
      // Hub), `data.session` is null and Supabase has just sent the
      // confirmation email. Show the "check your inbox" screen.
      if (!data.session) {
        setEmailSent(email.trim())
        return
      }
      navigate(target, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <AuthLayout
        title={t('signup.checkInboxTitle')}
        subtitle={t('signup.checkInboxSubtitle', { email: emailSent })}
        footer={
          <Link
            to="/login"
            className="font-semibold text-[var(--color-accent)] hover:underline"
          >
            {t('signup.backToLogin')}
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-glow)] ring-1 ring-[var(--color-accent)]/30">
            <MailCheck className="h-7 w-7 text-[var(--color-accent)]" />
          </span>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {t('signup.checkInboxBody')}
          </p>
          <p className="text-xs text-[var(--color-text-tertiary)]">
            {t('signup.checkInboxSpamHint')}
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('signup.title')}
      subtitle={t('signup.subtitle')}
      footer={
        <>
          {t('signup.haveAccount')}{' '}
          <Link
            to="/login"
            state={location.state}
            className="font-semibold text-[var(--color-accent)] hover:underline"
          >
            {t('signup.loginLink')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label={t('fields.email')}
          icon={<Mail className="h-4 w-4" />}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="vous@exemple.com"
          required
        />
        <Field
          label={t('fields.password')}
          icon={<Lock className="h-4 w-4" />}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          placeholder={t('signup.passwordPlaceholder')}
          required
          hint={t('signup.passwordHint')}
        />
        <Field
          label={t('fields.confirmPassword')}
          icon={<Lock className="h-4 w-4" />}
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          placeholder="••••••••"
          required
        />

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
          {submitting ? <Spinner label={t('signup.submitting')} /> : (
            <>
              <UserPlus className="h-4 w-4" />
              {t('signup.submit')}
            </>
          )}
        </button>

        <p className="pt-1 text-center text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
          {t('signup.legalNotice')}
        </p>
      </form>
    </AuthLayout>
  )
}

interface FieldProps {
  label: string
  icon?: React.ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
  hint?: string
}

function Field({
  label,
  icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  hint,
}: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </span>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={`input-field ${icon ? 'pl-9' : ''}`}
        />
      </div>
      {hint && (
        <p className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">{hint}</p>
      )}
    </label>
  )
}
