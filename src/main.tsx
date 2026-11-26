import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './themes/themes.css'
import './index.css'
import App from './App.tsx'
import { RenderMark } from './lib/renderMark'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RenderMark id="app">
      <App />
    </RenderMark>
  </StrictMode>,
)
