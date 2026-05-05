import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Singleton Supabase client used for everything auth-related on the
 * frontend (sign-up, sign-in, password reset, session retrieval).
 *
 * Reads the project URL and the publishable (anon) key from Vite's
 * env vars (`frontend/.env.local`).  We deliberately do NOT use the
 * Supabase client to read application data — the FastAPI backend
 * remains the authority and is called with a Bearer JWT header.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing — auth will not work. ' +
      'Add them to frontend/.env.local and restart Vite.',
  )
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'https://invalid.supabase.co',
  supabaseAnonKey ?? 'invalid-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'prompt-hub.auth',
    },
  },
)

/** Where Supabase should redirect after the email confirmation link. */
export function authRedirectUrl(): string {
  if (typeof window === 'undefined') return '/auth/callback'
  return `${window.location.origin}/auth/callback`
}
