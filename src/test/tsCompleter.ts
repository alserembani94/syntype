/**
 * The TypeScript completer as the worker builds it, for tests in Node: the
 * same ES2022 library files (read from disk) and the same stubs.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createCompleter } from '../lib/ts/completer'
import { EXPRESS_D_TS, HOST_D_TS, REACT_D_TS } from '../lib/ts/stubs'

const libDir = path.join(process.cwd(), 'node_modules/ts-lang/lib')
const libs: Record<string, string> = {}
const loadLib = (name: string) => {
  const file = `lib.${name}.d.ts`
  if (libs[file]) return
  libs[file] = fs.readFileSync(path.join(libDir, file), 'utf8')
  for (const m of libs[file].matchAll(/<reference lib="([^"]+)"/g)) loadLib(m[1])
}
loadLib('es2022')

export const tsCompleter = createCompleter({
  ...libs,
  'host.d.ts': HOST_D_TS,
  'react.d.ts': REACT_D_TS,
  'express.d.ts': EXPRESS_D_TS,
})
