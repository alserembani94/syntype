/**
 * TypeScript's ES2022 library declarations, bundled into the worker. The DOM
 * library is left out on purpose (see stubs.ts).
 */
const raw = import.meta.glob<string>(
  [
    '/node_modules/ts-lang/lib/lib.es5.d.ts',
    '/node_modules/ts-lang/lib/lib.decorators*.d.ts',
    '/node_modules/ts-lang/lib/lib.es20{15,16,17,18,19,20,21,22}*.d.ts',
  ],
  { query: '?raw', import: 'default', eager: true, exhaustive: true },
)

/** Library files by name, e.g. "lib.es5.d.ts". */
export const LIB_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(raw).map(([path, text]) => [path.slice(path.lastIndexOf('/') + 1), text]),
)
