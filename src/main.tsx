import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App.tsx'
import { Toaster } from './components/composites/toast'
import { RenderMark } from './lib/renderMark'
import { loadLanguage } from './languages/catalog'
import { startLanguageId } from './lib/address'

const root = document.getElementById('root')!

// The first snippet needs its language's rules and text. The page preloads that file alongside
// this one (scripts/build-pages.mjs), so this normally waits for nothing.
loadLanguage(startLanguageId()).then(
  () =>
    createRoot(root).render(
      <StrictMode>
        <RenderMark id="app">
          <Toaster>
            <App />
          </Toaster>
        </RenderMark>
      </StrictMode>,
    ),
  () => {
    root.textContent = 'Syntype couldn’t load. Check your connection, then reload the page.'
    root.setAttribute('role', 'alert')
  },
)
