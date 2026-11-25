/**
 * TypeScript's real language service over a single in-memory file. Pure and
 * synchronous: the worker wraps it for the browser, and tests call it directly.
 * Follows VS Code's TypeScript extension for what each entry means.
 */
import * as ts from 'ts-lang'
import type { ServiceEntry, ServiceRequest, ServiceResponse } from '../service'
import type { SuggestionKind } from '../../languages/types'

/** One file per language; only the one being typed is in the program. */
const FILES: Record<string, string> = { typescript: '/main.ts', javascript: '/main.js' }

/** ScriptElementKind → our icon kinds. */
function kindOf(k: string): SuggestionKind {
  switch (k) {
    case 'property':
    case 'getter':
    case 'setter':
    case 'accessor':
      return 'property'
    case 'method':
    case 'construct':
      return 'method'
    case 'function':
    case 'local function':
      return 'function'
    case 'class':
    case 'local class':
      return 'class'
    case 'interface':
      return 'interface'
    case 'type':
      return 'type'
    case 'enum':
      return 'enum'
    case 'enum member':
      return 'enumMember'
    case 'module':
    case 'external module name':
      return 'module'
    case 'keyword':
    case 'primitive type':
      return 'keyword'
    case 'string':
      return 'string'
    case 'type parameter':
      return 'typeParameter'
    default:
      return 'variable'
  }
}

export interface Completer {
  complete(request: ServiceRequest): ServiceResponse
}

/**
 * @param files declaration files by name, e.g. "lib.es5.d.ts" or "react.d.ts".
 *   Every file is part of the program; lib files must include their references.
 */
export function createCompleter(files: Record<string, string>): Completer {
  let text = ''
  let version = 0
  let file = FILES.typescript
  const libNames = Object.keys(files).map((f) => '/' + f)
  const read = (f: string) => (f === file ? text : files[f.replace(/^\//, '')])
  const host: ts.LanguageServiceHost = {
    getScriptFileNames: () => [file, ...libNames],
    getScriptVersion: (f) => (f === file ? String(version) : '1'),
    getScriptSnapshot: (f) => {
      const t = read(f)
      return t === undefined ? undefined : ts.ScriptSnapshot.fromString(t)
    },
    getCurrentDirectory: () => '/',
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noLib: true,
      strict: true,
      // JavaScript is analysed for inference only, as VS Code does without // @ts-check.
      allowJs: true,
      checkJs: false,
      types: [],
    }),
    getDefaultLibFileName: () => '/lib.es5.d.ts',
    fileExists: (f) => read(f) !== undefined,
    readFile: read,
  }
  const service = ts.createLanguageService(host, ts.createDocumentRegistry())

  return {
    complete({ text: t, offset, trigger, mode }) {
      file = FILES[mode ?? 'typescript'] ?? FILES.typescript
      text = t
      version++
      const r = service.getCompletionsAtPosition(file, offset, {
        triggerCharacter: trigger as ts.CompletionsTriggerCharacter | undefined,
        includeCompletionsWithInsertText: true,
        includeCompletionsForModuleExports: false,
      })
      if (!r) return { entries: [] }
      // VS Code: no commit characters where a new name is being declared; '(' is
      // added because "complete function calls" is off by default.
      const defaults = r.defaultCommitCharacters ?? ['.', ',', ';']
      const entries: ServiceEntry[] = []
      for (const e of r.entries) {
        if (e.name.startsWith('__')) continue
        // In JavaScript, names TypeScript can't resolve come back as plain words
        // ("warning" entries). VS Code shows them, without commit characters.
        const plain = e.kind === 'warning'
        const kind = plain ? 'word' : kindOf(e.kind)
        const commit = kind === 'string' || plain ? undefined : [...(e.commitCharacters ?? defaults), '(']
        entries.push({
          name: e.name,
          kind,
          sortText: e.sortText,
          optional: e.kindModifiers?.split(',').includes('optional') || undefined,
          preselect: e.isRecommended || undefined,
          commit: r.isNewIdentifierLocation ? undefined : commit,
        })
      }
      return { entries }
    },
  }
}
