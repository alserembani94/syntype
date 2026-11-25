import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { getLanguage, LANGUAGES, pickSnippet, type Snippet, type SnippetLength } from './languages'
import { useTypingTest, type TestOptions } from './hooks/useTypingTest'
import { isTouch, usePageFocus } from './hooks/usePageFocus'
import { MIN_ACCURACY_FOR_BEST, summarize } from './lib/stats'
import { atPending, caretPosition } from './lib/engine'
import { buildSuggestConfig } from './lib/suggest'
import { computePairs } from './lib/pairs'
import { load, save } from './lib/storage'
import { migrateBests, savedLength, type Bests } from './lib/settings'
import { openHistory } from './lib/history'
import { recordRun } from './lib/runlog'
import { CHORD_TIMEOUT_MS, keyLabels, shortcut, shortcutText } from './lib/shortcuts'
import { CodeView } from './components/CodeView'
import { ConfigBar } from './components/ConfigBar'
import { AdSlot } from './components/AdSlot'
import { LanguagePicker } from './components/LanguagePicker'
import { ThemePicker } from './components/ThemePicker'
import { AboutDialog } from './components/AboutDialog'
import { RunsView } from './components/RunsView'
import { applyTheme, getTheme, loadTheme, saveTheme } from './themes'
import { isRunsPath, isSitePath, languageFromPath, languagePage, RUNS_PAGE } from './seo/site'
import { Results } from './components/Results'

interface Settings {
  languageId: string
  length: SnippetLength
  autoIndent: boolean
  autoClose: boolean
  autocomplete: boolean
}

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

/**
 * On the site itself (home or a language page such as /python), the address
 * names the language: opening /python starts in Python, and choosing another
 * language moves to its page. Elsewhere (the single-file artifact) the
 * address is left alone.
 */
const onSite = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && isSitePath(location.pathname, LANGUAGES)
const languageInAddress = onSite ? languageFromPath(location.pathname, LANGUAGES) : null

/** Typing, or the personal board (My runs, at /runs). */
type View = 'type' | 'runs'
const viewInAddress = (): View => (onSite && isRunsPath(location.pathname) ? 'runs' : 'type')

function showLanguageInAddress(id: string) {
  if (!onSite || isRunsPath(location.pathname)) return
  const page = languagePage(getLanguage(id))
  document.title = page.title
  try {
    if (location.pathname !== page.path) history.replaceState(null, '', page.path + location.search + location.hash)
  } catch {
    /* some embedded pages can't change their address */
  }
}

const NAV_KEYS: Record<string, 'right' | 'end' | 'down'> = { ArrowRight: 'right', End: 'end', ArrowDown: 'down' }

export default function App() {
  // A language page (/python) wins over the language saved from last time.
  const [languageId, setLanguageId] = useState(() => getLanguage(languageInAddress ?? load('language', '')).id)
  const language = getLanguage(languageId)
  const [length, setLength] = useState<SnippetLength>(() => savedLength(load('length', 'medium')))
  const [view, setView] = useState<View>(viewInAddress)
  // A caret that glides between letters (on by default; switched in the theme dialog).
  const [smoothCaret, setSmoothCaret] = useState(() => load('smoothCaret', true))
  const changeSmoothCaret = (on: boolean) => {
    setSmoothCaret(on)
    save('smoothCaret', on)
  }
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

  // Every finished run goes into local history with its keystroke log
  // (src/lib/history.ts), once. Where the browser won't store it, nothing happens.
  const [runHistory] = useState(() => openHistory())
  const recordedRun = useRef(-1)
  useEffect(() => {
    if (phase !== 'done' || recordedRun.current === state.runId) return
    recordedRun.current = state.runId
    const aids = { autoIndent, autoClose, autocomplete }
    recordRun(language, state, aids)
      .then(async (record) => (await runHistory)?.add(record))
      .catch((err) => console.warn('This run could not be saved to local history:', err))
  }, [phase, state, language, autoIndent, autoClose, autocomplete, runHistory])

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
  const keyState = { view, toType: () => showView('type'), openLanguage: () => setPickerOpen(true), openTheme: () => setThemeOpen(true), setChord, phase, autoIndent, indentSize: language.indentSize ?? 2, indentWithTabs: !!language.indentWithTabs, suggestOpen, next, retry, type, back, move, suggestNav, accept, dismiss }
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
        // From My runs, typing shortcuts go back to typing first.
        if ((command === 'newSnippet' || command === 'language') && s.view !== 'type') s.toType()
        if (command === 'newSnippet') s.next()
        else if (command === 'language') s.openLanguage()
        else if (command === 'theme') s.openTheme()
        // 'chordCancel': the key that cancelled is swallowed, as VS Code does.
        return
      }
      if (chordRef.current) return // a modifier, pressed on the way to the second key
      // My runs has its own controls; keys don't type there.
      if (s.view !== 'type') return

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
  const [aboutOpen, setAboutOpen] = useState(false)
  useEffect(() => {
    // The clock also stops while a picker, the about dialog or My runs is open.
    if (focused && !pickerOpen && !themeOpen && !aboutOpen && view === 'type') resume()
    else pause()
  }, [focused, pickerOpen, themeOpen, aboutOpen, view, pause, resume])

  // Switching between typing and My runs; on the site it's a real address, so Back works.
  const showView = (v: View) => {
    if (v === view) return
    setView(v)
    if (onSite) {
      const page = v === 'runs' ? RUNS_PAGE : languagePage(language)
      history.pushState(null, '', page.path)
      document.title = page.title
    }
    if (v === 'type') requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }
  useEffect(() => {
    if (!onSite) return
    const onPop = () => {
      const v = viewInAddress()
      setView(v)
      document.title = v === 'runs' ? RUNS_PAGE.title : languagePage(getLanguage(languageId)).title
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [languageId])
  useEffect(() => {
    if (view === 'runs' && onSite) document.title = RUNS_PAGE.title
  }, [view])

  // The site's pages carry an about section in their HTML, for search engines
  // and link previews. Once the app runs, it opens as a dialog from the footer
  // instead of sitting below the editor. (The single-file artifact has none.)
  const [aboutSection] = useState(() => (typeof document !== 'undefined' ? document.getElementById('about') : null))
  useEffect(() => {
    document.documentElement.classList.add('app-ready')
  }, [])
  const closeAbout = () => {
    setAboutOpen(false)
    inputRef.current?.focus({ preventScroll: true })
  }
  /** A language link in the about dialog: switch here instead of loading the page again. */
  const aboutLanguage = (path: string) => {
    const id = languageFromPath(path, LANGUAGES)
    if (!id) return false
    closeAbout()
    if (id !== languageId) changeLanguage(id)
    return true
  }
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
  /** From My runs: type exactly this snippet, switching language and length to match it. */
  const typeSnippet = (id: string, name: string) => {
    const lang = getLanguage(id)
    const target = lang.snippets.find((x) => x.name === name)
    if (!target) return
    setLanguageId(lang.id)
    save('language', lang.id)
    setLength(target.length)
    save('length', target.length)
    start(target, { languageId: lang.id, length: target.length })
    setView('type')
    if (onSite) {
      const page = languagePage(lang)
      history.pushState(null, '', page.path)
      document.title = page.title
    }
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
  }
  const pickLanguage = (id: string) => {
    closePicker()
    if (id !== languageId) changeLanguage(id)
  }
  const changeLanguage = (id: string) => {
    const lang = getLanguage(id)
    setLanguageId(lang.id)
    save('language', lang.id)
    showLanguageInAddress(lang.id)
    start(pickSnippet(lang.snippets, length), { languageId: lang.id })
  }
  const changeLength = (l: SnippetLength) => {
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
      {aboutOpen && aboutSection && <AboutDialog section={aboutSection} onLanguage={aboutLanguage} onClose={closeAbout} />}
      {themeOpen && (
        <ThemePicker
          currentId={themeId}
          onPreview={applyTheme}
          onSelect={pickTheme}
          onClose={closeTheme}
          smoothCaret={smoothCaret}
          onSmoothCaret={changeSmoothCaret}
        />
      )}
      <header className="top">
        <div className="brand">
          <h1>
            Syn<span>type</span>
          </h1>
        </div>
        <nav className="tabs" aria-label="Sections">
          <button type="button" aria-current={view === 'type' ? 'page' : undefined} onClick={() => showView('type')}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Type</span>
          </button>
          <button type="button" aria-current={view === 'runs' ? 'page' : undefined} onClick={() => showView('runs')}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>My runs</span>
          </button>
        </nav>
        <div className="top-actions">
          {aboutSection && (
            <button type="button" className="icon-button" onClick={() => setAboutOpen(true)} aria-haspopup="dialog" aria-label="About Syntype" title="About Syntype">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M12 11v5.5M12 7.6v.4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="icon-button theme-button"
            onClick={() => setThemeOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Theme: ${getTheme(themeId).name}. Change theme`}
            title={`Theme: ${getTheme(themeId).name} (${shortcutText('theme')})`}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </header>

      {view === 'runs' ? (
        <RunsView languages={LANGUAGES} history={runHistory} language={languageId} length={length} inAddress={onSite} onType={typeSnippet} />
      ) : (
        <>
          {/* Everything that changes the run, next to the code it changes. No clock or score while typing. */}
          <div className="settings">
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
                smoothCaret={smoothCaret}
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

          <p
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
                  <kbd>L</kbd> language · <kbd>{keys.mod}</kbd>+<kbd>⌫</kbd> deletes a word
                </>
              ) : (
                <>
                  <kbd>{keys.mod}</kbd>+
                  <kbd>enter</kbd> new snippet · <kbd>{keys.mod}</kbd>+<kbd>⌫</kbd> deletes a word · results appear when you finish
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
          </p>
        </>
      )}
    </div>
  )
}
