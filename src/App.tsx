import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getLanguage, LANGUAGES, pickSnippet, type LengthFilter, type Snippet } from './languages'
import { useTypingTest, type TestOptions } from './hooks/useTypingTest'
import { isTouch, usePageFocus } from './hooks/usePageFocus'
import { MIN_ACCURACY_FOR_BEST, summarize } from './lib/stats'
import { atPending, caretPosition } from './lib/engine'
import { buildSuggestConfig } from './lib/suggest'
import { computePairs } from './lib/pairs'
import { load, save } from './lib/storage'
import { CHORD_TIMEOUT_MS, keyLabels, shortcut, shortcutText } from './lib/shortcuts'
import { CodeView } from './components/CodeView'
import { ConfigBar } from './components/ConfigBar'
import { AdSlot } from './components/AdSlot'
import { LanguagePicker } from './components/LanguagePicker'
import { ThemePicker } from './components/ThemePicker'
import { applyTheme, getTheme, loadTheme, saveTheme } from './themes'
import { Results } from './components/Results'

interface Settings {
  languageId: string
  length: LengthFilter
  autoIndent: boolean
  autoClose: boolean
  autocomplete: boolean
}

/** Personal bests keyed by "languageId:length", plus a suffix for each assist that was on. */
type Bests = Record<string, number>

/** Bests saved before the rename used ":intellisense" in their keys. */
const migrateBests = (bests: Bests): Bests =>
  Object.fromEntries(Object.entries(bests).map(([k, v]) => [k.replace(/:intellisense$/, ':autocomplete'), v]))
const bestKey = (s: Settings) =>
  `${s.languageId}:${s.length}${s.autoClose ? ':autoclose' : ''}${s.autocomplete ? ':autocomplete' : ''}`

const runOptions = (snippet: Snippet, s: Settings): TestOptions => {
  const lang = getLanguage(s.languageId)
  return {
    autoIndent: s.autoIndent,
    autoClose: s.autoClose,
    pairs: s.autoClose ? computePairs(snippet.code, lang) : undefined,
    suggest: s.autocomplete ? buildSuggestConfig(snippet.code, lang) : null,
  }
}

const NAV_KEYS: Record<string, 'right' | 'end' | 'down'> = { ArrowRight: 'right', End: 'end', ArrowDown: 'down' }

export default function App() {
  const [languageId, setLanguageId] = useState(() => getLanguage(load('language', '')).id)
  const language = getLanguage(languageId)
  const [length, setLength] = useState<LengthFilter>(() => load('length', 'medium'))
  const [autoIndent, setAutoIndent] = useState(() => load('autoIndent', true))
  const [autoClose, setAutoClose] = useState(() => load('autoClose', true))
  // Saved as "intellisense" before the feature was renamed; carried over once.
  const [autocomplete, setAutocomplete] = useState(() => load('autocomplete', load('intellisense', true)))
  const settings: Settings = { languageId, length, autoIndent, autoClose, autocomplete }
  const [bests, setBests] = useState<Bests>(() => migrateBests(load('bests', {})))
  const [firstSnippet] = useState(() => pickSnippet(language.snippets, length))
  const {
    state,
    elapsed,
    load: loadSnippet,
    type,
    back,
    move,
    suggestNav,
    accept,
    dismiss,
    pause,
    resume,
  } = useTypingTest(firstSnippet, runOptions(firstSnippet, settings))
  const [bestAtStart, setBestAtStart] = useState(() => bests[bestKey(settings)] ?? 0)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { run, phase, snippet } = state
  const currentKey = bestKey(settings)

  const result = useMemo(
    () => (phase === 'done' ? summarize(run, elapsed, state.samples, state.pausedMs / 1000) : null),
    [phase, run, elapsed, state.samples, state.pausedMs],
  )
  const isBest = !!result && result.wpm > bestAtStart && result.accuracy >= MIN_ACCURACY_FOR_BEST
  // Bests including the run that just finished.
  const currentBests = useMemo<Bests>(
    () => (isBest && result ? { ...bests, [currentKey]: result.wpm } : bests),
    [isBest, result, bests, currentKey],
  )

  useEffect(() => {
    if (isBest) save('bests', currentBests)
  }, [isBest, currentBests])

  const start = useCallback(
    (s: Snippet, changes: Partial<Settings> = {}) => {
      const upcoming: Settings = { languageId, length, autoIndent, autoClose, autocomplete, ...changes }
      setBests(currentBests)
      setBestAtStart(currentBests[bestKey(upcoming)] ?? 0)
      loadSnippet(s, runOptions(s, upcoming))
      inputRef.current?.focus({ preventScroll: true })
    },
    [languageId, length, autoIndent, autoClose, autocomplete, currentBests, loadSnippet, setBests],
  )
  const next = useCallback(
    () => start(pickSnippet(language.snippets, length, snippet.name)),
    [start, language, length, snippet.name],
  )
  const retry = useCallback(() => start(snippet), [start, snippet])

  // Ctrl/⌘+K was pressed: the next key completes the two-step shortcut (or cancels it).
  // The ref is what the key handler reads; the state shows the hint.
  const [chord, setChordShown] = useState(false)
  const chordRef = useRef(false)
  const chordTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const setChord = useCallback((on: boolean) => {
    chordRef.current = on
    setChordShown(on)
    clearTimeout(chordTimer.current)
    if (on)
      chordTimer.current = setTimeout(() => {
        chordRef.current = false
        setChordShown(false)
      }, CHORD_TIMEOUT_MS)
  }, [])
  useEffect(() => () => clearTimeout(chordTimer.current), [])

  // Keyboard: the whole page listens, so typing works without clicking first.
  const suggestOpen = !!state.suggest
  const keyState = { openLanguage: () => setPickerOpen(true), openTheme: () => setThemeOpen(true), setChord, phase, autoIndent, indentSize: language.indentSize ?? 2, indentWithTabs: !!language.indentWithTabs, suggestOpen, next, retry, type, back, move, suggestNav, accept, dismiss }
  const latest = useRef(keyState)
  useLayoutEffect(() => {
    latest.current = keyState
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current
      // The pickers handle their own keys.
      if (e.target instanceof Element && e.target.closest('[role="dialog"]')) return

      // Shortcuts (src/lib/shortcuts.ts) work everywhere outside the pickers.
      const command = shortcut(e, chordRef.current)
      if (command) {
        e.preventDefault()
        if (command === 'chordStart') return s.setChord(true)
        s.setChord(false)
        if (command === 'newSnippet') s.next()
        else if (command === 'language') s.openLanguage()
        else if (command === 'theme') s.openTheme()
        // 'chordCancel': the key that cancelled is swallowed, as VS Code does.
        return
      }
      if (chordRef.current) return // a modifier, pressed on the way to the second key

      const onButton = e.target instanceof Element && e.target.closest('button')
      if (onButton && (e.key === 'Enter' || e.key === ' ')) return

      if (s.phase === 'done') {
        if (e.key === 'Enter') {
          e.preventDefault()
          s.next()
        } else if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault()
          s.retry()
        }
        return
      }

      // While the suggestion list is open it gets the keys VS Code gives it.
      if (s.suggestOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const handled: Record<string, () => void> = {
          ArrowDown: () => s.suggestNav(1),
          ArrowUp: () => s.suggestNav(-1),
          Tab: () => s.accept(),
          Enter: () => s.accept(),
          Escape: () => s.dismiss(),
        }
        if (handled[e.key]) {
          e.preventDefault()
          handled[e.key]()
          return
        }
      }

      // Esc only closes things; with nothing open it does nothing, so it can't cost a run.
      if (e.key === 'Escape') return
      if (e.key === 'Backspace') {
        e.preventDefault()
        s.back(e.ctrlKey || e.altKey || e.metaKey)
      } else if ((e.ctrlKey && !e.altKey) || e.metaKey) {
        return // leave browser shortcuts alone
      } else if (NAV_KEYS[e.key] && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        s.move(NAV_KEYS[e.key])
      } else if (e.key === 'Enter') {
        e.preventDefault()
        s.type('\n')
      } else if (e.key === 'Tab') {
        e.preventDefault()
        if (!s.autoIndent) {
          if (s.indentWithTabs) s.type('\t')
          else for (let i = 0; i < s.indentSize; i++) s.type(' ')
        }
      } else if (e.key.length === 1) {
        e.preventDefault()
        s.type(e.key)
      } else return
      inputRef.current?.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => inputRef.current?.focus({ preventScroll: true }), [])

  // The clock only counts while keys can reach the game; time away isn't typing time.
  const focused = usePageFocus()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  useEffect(() => {
    // The clock also stops while the language or theme picker is open.
    if (focused && !pickerOpen && !themeOpen) resume()
    else pause()
  }, [focused, pickerOpen, themeOpen, pause, resume])
  const overlay = phase === 'done' || focused ? null : phase === 'running' ? 'paused' : 'start'

  // Language service status, shown in the status bar like VS Code's.
  const service = state.suggestConfig?.service ?? null
  const serviceStatus = useSyncExternalStore(
    useCallback((cb: () => void) => (service ? service.onStatus(cb) : () => {}), [service]),
    () => service?.status() ?? null,
  )
  const serviceLabel =
    serviceStatus === 'starting'
      ? `${language.name} autocomplete starting…`
      : serviceStatus === 'failed'
        ? `${language.name} autocomplete unavailable, using basic suggestions`
        : serviceStatus === 'ready'
          ? `${language.name} autocomplete`
          : null

  const onMobileInput = (text: string, deleted: boolean) => {
    if (deleted) back(false)
    for (const ch of text) type(ch)
  }

  // The theme: index.html shows the saved one before the first paint; the picker previews others.
  const [themeId, setThemeId] = useState(loadTheme)
  useEffect(() => applyTheme(themeId), [themeId])
  const closeTheme = () => {
    applyTheme(themeId)
    setThemeOpen(false)
    inputRef.current?.focus({ preventScroll: true })
  }
  const pickTheme = (id: string) => {
    setThemeId(id)
    saveTheme(id)
    applyTheme(id)
    setThemeOpen(false)
    inputRef.current?.focus({ preventScroll: true })
  }

  const closePicker = () => {
    setPickerOpen(false)
    inputRef.current?.focus({ preventScroll: true })
  }
  const pickLanguage = (id: string) => {
    closePicker()
    if (id !== languageId) changeLanguage(id)
  }
  const changeLanguage = (id: string) => {
    const lang = getLanguage(id)
    setLanguageId(lang.id)
    save('language', lang.id)
    start(pickSnippet(lang.snippets, length), { languageId: lang.id })
  }
  const changeLength = (l: LengthFilter) => {
    setLength(l)
    save('length', l)
    start(pickSnippet(language.snippets, l), { length: l })
  }
  const toggleIndent = () => {
    const v = !autoIndent
    setAutoIndent(v)
    save('autoIndent', v)
    start(snippet, { autoIndent: v })
  }
  const toggleClose = () => {
    const v = !autoClose
    setAutoClose(v)
    save('autoClose', v)
    start(snippet, { autoClose: v })
  }
  const toggleAutocomplete = () => {
    const v = !autocomplete
    setAutocomplete(v)
    save('autocomplete', v)
    start(snippet, { autocomplete: v })
  }

  const keys = keyLabels()
  const { line, col } = caretPosition(run)
  const best = currentBests[currentKey]

  return (
    <div className="wrap" style={{ '--tab-size': language.indentSize ?? 2 } as React.CSSProperties}>
      {/* Side ads on wide screens; they fade back while a snippet is being typed. */}
      <AdSlot slot="rail" className={`ad-rail left${phase === 'running' ? ' dim' : ''}`} />
      <AdSlot slot="rail" className={`ad-rail right${phase === 'running' ? ' dim' : ''}`} />
      {pickerOpen && (
        <LanguagePicker languages={LANGUAGES} currentId={languageId} onSelect={pickLanguage} onClose={closePicker} />
      )}
      {themeOpen && <ThemePicker currentId={themeId} onPreview={applyTheme} onSelect={pickTheme} onClose={closeTheme} />}
      <header>
        <div className="brand">
          <h1>
            Syn<span>type</span>
          </h1>
          <small>typing speed, measured in code</small>
        </div>
        <ConfigBar
          length={length}
          autoIndent={autoIndent}
          autoClose={autoClose}
          onLength={changeLength}
          onToggleIndent={toggleIndent}
          onToggleClose={toggleClose}
          autocomplete={autocomplete}
          onToggleAutocomplete={toggleAutocomplete}
        />
      </header>

      {/* No clock or score while typing: results appear only when the snippet is done. */}
      <div className="live">
        <button
          type="button"
          id="language-button"
          className="lang-button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          title={`Change language (${shortcutText('language')})`}
        >
          <span className="lang-icon" aria-hidden="true">
            {'</>'}
          </span>
          {language.name}
        </button>
        <button
          type="button"
          className="new-snippet"
          onClick={() => {
            next()
            inputRef.current?.focus({ preventScroll: true })
          }}
          title={`New snippet (${shortcutText('newSnippet')})`}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          new snippet
        </button>
        <span
          className={`hint${chord || atPending(run) || suggestOpen ? ' attention' : ''}`}
          style={{ visibility: phase === 'done' && !chord ? 'hidden' : undefined }}
        >
          {chord ? (
            <>
              <kbd>{keys.mod}</kbd>+
              <kbd>K</kbd> pressed · <kbd>T</kbd> theme · any other key cancels
            </>
          ) : suggestOpen ? (
            <>
              <kbd>tab</kbd> <kbd>enter</kbd> accept · <kbd>↑</kbd> <kbd>↓</kbd> choose · <kbd>esc</kbd> close
            </>
          ) : !atPending(run) ? (
            phase === 'ready' ? (
              <>
                start typing when you're ready · <kbd>{keys.mod}</kbd>+
                <kbd>enter</kbd> new snippet · <kbd>{keys.mod}</kbd>+
                <kbd>{keys.shift}</kbd>+
                <kbd>L</kbd> language
              </>
            ) : (
              <>
                <kbd>{keys.mod}</kbd>+
                <kbd>enter</kbd> new snippet · results appear when you finish
              </>
            )
          ) : run.chars[run.pos] === '\n' ? (
            <>
              auto-closed below · <kbd>↓</kbd> to move past it
            </>
          ) : (
            <>
              auto-closed · type it, or <kbd>→</kbd> <kbd>end</kbd> to move past
            </>
          )}
        </span>
      </div>

      <section className="pane">
        <div className="tabbar">
          <div className="tab">
            <span className="dot" />
            <span>{snippet.name}</span>
          </div>
          <span className="lang">{language.name}</span>
        </div>

        {result ? (
          <Results
            key={state.runId}
            result={result}
            isBest={isBest}
            info={{
              language: language.name,
              length,
              snippet: snippet.name,
              assists: [autoIndent && 'auto-indent', autoClose && 'auto-close', autocomplete && 'autocomplete'].filter(
                (a): a is string => !!a,
              ),
            }}
            run={run}
            highlight={language.highlight}
            onNext={next}
            onRetry={retry}
          />
        ) : (
          <CodeView
            code={snippet.code}
            highlight={language.highlight}
            run={run}
            typing={phase === 'running'}
            inputRef={inputRef}
            onMobileInput={onMobileInput}
            suggest={state.suggest}
            onAccept={accept}
            overlay={overlay}
            touch={isTouch()}
          />
        )}

        <div className="statusbar">
          <span>
            Ln {line}, Col {col}
          </span>
          <span>
            {run.pos} / {run.chars.length} chars
          </span>
          {/* Personal best is a score too, so it waits for the results screen. */}
          <span className="push">
            {phase === 'done' &&
              `best (${[language.name, length, autoClose && 'auto-close', autocomplete && 'autocomplete'].filter(Boolean).join(', ')}): ${best ? `${Math.round(best)} wpm` : '—'}`}
          </span>
          {serviceLabel && (
            <span
              className={`service ${serviceStatus}`}
              title={
                serviceStatus === 'failed'
                  ? `Couldn't start: ${service?.failure?.() ?? 'unknown reason'}`
                  : "Type-aware suggestions from the language's own service"
              }
            >
              {serviceLabel}
            </span>
          )}
          <span>{language.indentWithTabs ? 'Tab Size' : 'Spaces'}: {language.indentSize ?? 2}</span>
          <span>UTF-8</span>
        </div>
      </section>

      <footer>
        <span>WPM counts only correct characters you typed, ÷ 5 per minute. Code speed also counts suggested and auto-inserted text.</span>
        <span>
          <kbd>ctrl</kbd>+<kbd>⌫</kbd> deletes a word
        </span>
        <button
          type="button"
          className="theme-button"
          onClick={() => setThemeOpen(true)}
          aria-haspopup="dialog"
          title={`Change theme (${shortcutText('theme')})`}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
          </svg>
          {getTheme(themeId).name}
        </button>
      </footer>
    </div>
  )
}
