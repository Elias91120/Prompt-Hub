import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ToastProvider } from './components/ui'
import { AuthProvider } from './lib/auth'

/**
 * Application root. Wraps the router with global providers (auth +
 * toasts). Per-page logic and routing live in `router.tsx`.
 */
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  )
}
