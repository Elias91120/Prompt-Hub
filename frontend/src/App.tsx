import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { ToastProvider } from './components/ui'

/**
 * Application root. Wraps the router with global providers (toasts).
 * Per-page logic and routing live in `router.tsx`.
 */
export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  )
}
