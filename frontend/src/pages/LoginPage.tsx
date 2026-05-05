import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn, Mail, Lock } from 'lucide-react'
import AuthLayout from '../components/auth/AuthLayout'
import { Spinner, useToast } from '../components/ui'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useEffect } from 'react'

interface LocationState {
  from?: { pathname: string }
}

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()
  const toast = useToast()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    setSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        if (/email not confirmed/i.test(signInError.message)) {
          setError(t('errors.emailNotConfirmed'))
        } else if (/invalid login credentials/i.test(signInError.message)) {
          setError(t('errors.invalidCredentials'))
        } else {
          setError(signInError.message)
        }
        return
      }
      toast.success(t('login.toastSuccess'))
      navigate(target, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      footer={
        <>
          {t('login.noAccount')}{' '}
          <Link
            to="/signup"
            state={location.state}
            className="font-semibold text-[var(--color-accent)] hover:underline"
          >
            {t('login.signupLink')}
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
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          required
          rightLink={
            <Link
              to="/forgot-password"
              className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)]"
            >
              {t('login.forgot')}
            </Link>
          }
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
          {submitting ? <Spinner label={t('login.submitting')} /> : (
            <>
              <LogIn className="h-4 w-4" />
              {t('login.submit')}
            </>
          )}
        </button>
      </form>
    </AuthLayout>
  )
}

interface FieldProps {
  label: string
  icon?: React.ReactNode
  rightLink?: React.ReactNode
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
}

function Field({
  label,
  icon,
  rightLink,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: FieldProps) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          {label}
        </span>
        {rightLink}
      </div>
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
    </label>
  )
}
