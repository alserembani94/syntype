import { playwright } from '@vitest/browser-playwright'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import vite from './vite.config.ts'

/** Behaviour tests that need a real browser (focus, keyboard, overlays): *.browser.test.tsx. */
const BROWSER = 'src/**/*.browser.test.tsx'

export default mergeConfig(
  vite,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          // .visual/ holds worktrees of older commits (scripts/visual): their tests aren't this checkout's.
          test: { name: 'node', exclude: [...configDefaults.exclude, '.visual/**', BROWSER] },
        },
        {
          extends: true,
          test: {
            name: 'browser',
            include: [BROWSER],
            // Real Chromium through the Playwright already installed for scripts/visual.
            browser: { enabled: true, provider: playwright(), headless: true, instances: [{ browser: 'chromium' }], screenshotFailures: false },
          },
        },
      ],
    },
  }),
)
