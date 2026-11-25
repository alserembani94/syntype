import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../themes/themes.css'
import '../index.css'
import './admin.css'
import { Admin } from './Admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
