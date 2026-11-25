import { useEffect, useState } from 'react'
import { LANGUAGES } from '../languages'
import type { Player } from '../lib/account'
import { LeaderboardView } from '../components/LeaderboardView'
import { ME } from './sample'

const player: Player = { id: ME.id, provider: 'github', name: ME.name, suggestedName: 'you', hidden: false, hiddenByModerator: false, nameChangedAt: null, renameAfter: null }

/** The leaderboard as it appears on the site, with a header and a note that the data is made up. */
export function Preview() {
  const [signedIn, setSignedIn] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 3000)
    return () => clearTimeout(t)
  }, [notice])
  return (
    <div className="wrap">
      <p className="preview-banner">
        <b>Leaderboard preview with sample data.</b> The players, scores and replays are made up; reports go nowhere.
        <label>
          <input type="checkbox" checked={signedIn} onChange={(e) => setSignedIn(e.target.checked)} /> signed in as “{ME.name}”
        </label>
      </p>
      <header className="top">
        <div className="brand">
          <h1>
            Syn<span>type</span>
          </h1>
        </div>
        <nav className="tabs" aria-label="Sections">
          <button type="button" onClick={() => setNotice('In the preview, only the Leaderboard tab works.')}>
            <span>Type</span>
          </button>
          <button type="button" onClick={() => setNotice('In the preview, only the Leaderboard tab works.')}>
            <span>My runs</span>
          </button>
          <button type="button" aria-current="page">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Leaderboard</span>
          </button>
        </nav>
        {signedIn && (
          <div className="top-actions">
            <span className="account-button" aria-label={`Signed in as ${ME.name}`}>
              <span className="avatar" aria-hidden="true">
                Y
              </span>
              <span className="account-label">{ME.name}</span>
            </span>
          </div>
        )}
      </header>
      <LeaderboardView
        key={signedIn ? 'in' : 'out'}
        languages={LANGUAGES}
        language="python"
        length="short"
        player={signedIn ? player : null}
        inAddress={false}
        onType={(_, name) => setNotice(`On the site, this opens ${name} to type.`)}
      />
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  )
}

