import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminApp, { isAdminPath } from './AdminApp'
import {currentAdminPath} from './lib/api-endpoint'

function RootApp() {
  const [admin, setAdmin] = useState(() => isAdminPath(currentAdminPath()))
  useEffect(() => {
    const update = () => setAdmin(isAdminPath(currentAdminPath()))
    window.addEventListener('hashchange', update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener('hashchange', update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return admin ? <AdminApp /> : <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
