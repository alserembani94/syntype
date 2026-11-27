import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/admin.css'
import { Toaster } from '@/components/composites/toast'
import { Admin } from './Admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toaster>
      <Admin />
    </Toaster>
  </StrictMode>,
)
