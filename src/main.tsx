import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.tsx'
import { Toaster } from './components/composites/toast'
import { RenderMark } from './lib/renderMark'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RenderMark id="app">
      <Toaster>
        <App />
      </Toaster>
    </RenderMark>
  </StrictMode>,
)
