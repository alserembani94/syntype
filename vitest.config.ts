import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import vite from './vite.config.ts'

export default mergeConfig(
  vite,
  defineConfig({
    // .visual/ holds worktrees of older commits (scripts/visual): their tests aren't this checkout's.
    test: { exclude: [...configDefaults.exclude, '.visual/**'] },
  }),
)
