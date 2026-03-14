// ══════════════════════════════════════════════════════
// PRIZE POOLS & CHALLENGES PAGE
// ══════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import { Button, Card, Badge } from '../components/UI'
import styles from './PrizePools.module.css'

const HOUSE_RAKE = 0.05
const API = import.meta.env.VITE_API_URL || ''

function PrizeTournamentCard({ t, user, onOpenAuth, onJoin, isJoined, isJoining, onNavigate }) {
  const [showPrizes, setShowPrizes] = useState(false)
  const playerCount = parseInt(t.player_count) || 0
  const filled = Math.round((playerCount / t.max_players) * 100)

  return (
    <div className={styles.tCard}>
      <div className={styles.tCardHeader}>
        <div className={styles.tCardLeft}>
          <span className={`${styles.statusDot} ${t.status === 'active' ? styles.dotActive : styles.dotUpcoming}`} />
          <span className={styles.tCardName}>{t.name}</span>
        </div>
        <div className={styles.tCardFormat}>{t.format} · {t.time_control}</div>
      </div>

      <div className={styles.tCardMeta}>
        <span className={styles.metaPill}>{playerCount}/{t.max_players} players</span>
        <span className={styles.metaPill}>
          {t.status === 'active' ? 'Live' : new Date(t.starts_at).toLocaleDateString('en-GB', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
        </span>
      </div>

      <div className={styles.fillBar}>
        <div className={styles.fillBarInner} style={{ width: filled + '%' }} />
      </div>
      <div className={styles.fillLabel}>{filled}% full</div>

      <div className={styles.tCardActions}>
        {t.status === 'finished' ? (
          <Button variant="secondary" size="sm"
            onClick={() => onNavigate('tournaments')}>View Results</Button>
        ) : t.status === 'active' ? (
          <Button variant="primary" size="sm"
            onClick={() => onNavigate('watch')}>Watch Live</Button>
        ) : isJoined ? (
          <Button variant="secondary" size="sm" disabled>✓ Joined</Button>
        ) : (
          <Button variant="primary" size="sm"
            onClick={() => user ? onJoin(t.id) : onOpenAuth('register')}
            disabled={isJoining || playerCount >= t.max_players}>
            {isJoining ? 'Joining…' : playerCount >= t.max_players ? 'Full' : 'Join Free'}
          </Button>
        )}
        <Button variant="ghost" size="sm">Details</Button>
      </div>
    </div>
  )
}

export function PrizePoolsPage({ user, onOpenAuth, onNavigate }) {
  const [tab, setTab] = useState('tournaments')
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [joiningId, setJoiningId] = useState(null)
  const [joinedIds, setJoinedIds] = useState(new Set())
  const [customWager, setCustomWager] = useState(25)

  useEffect(() => {
    fetch(`${API}/api/tournaments`)
      .then(r => r.json())
      .then(data => setTournaments(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('token')
    fetch(`${API}/api/tournaments/my`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setJoinedIds(new Set(data.map(t => t.id))) })
      .catch(() => {})
  }, [user])

  async function handleJoin(tournamentId) {
    const token = localStorage.getItem('token')
    setJoiningId(tournamentId)
    try {
      const res = await fetch(`${API}/api/tournaments/${tournamentId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setJoinedIds(prev => new Set([...prev, tournamentId]))
        setTournaments(prev => prev.map(t =>
          t.id === tournamentId
            ? { ...t, player_count: (parseInt(t.player_count) || 0) + 1 }
            : t
        ))
      } else {
        alert(data.error || 'Could not join')
      }
    } catch { alert('Network error') }
    finally { setJoiningId(null) }
  }

  const activeTournaments = tournaments.filter(t => t.status === 'active')
  const upcomingTournaments = tournaments.filter(t => t.status === 'upcoming')

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.pageSubtitle}>🏆 Compete · Win · Repeat</div>
            <h1 className={styles.pageTitle}>Prize Pools & Challenges</h1>
            <p className={styles.pageDesc}>
              Join free tournaments and head-to-head challenges. House takes a {(HOUSE_RAKE * 100).toFixed(0)}% rake on prize pools.
            </p>
          </div>
          <div className={styles.houseStats}>
            <div className={styles.houseStat}>
              <div className={styles.houseStatVal}>{tournaments.length}</div>
              <div className={styles.houseStatLabel}>Active tournaments</div>
            </div>
            <div className={styles.houseStat}>
              <div className={styles.houseStatVal}>5%</div>
              <div className={styles.houseStatLabel}>House rake</div>
            </div>
            <div className={styles.houseStat}>
              <div className={styles.houseStatVal}>
                {tournaments.reduce((s, t) => s + (parseInt(t.player_count) || 0), 0)}
              </div>
              <div className={styles.houseStatLabel}>Players registered</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[
            { v: 'tournaments', label: '🏆 Tournaments' },
            { v: 'challenges', label: '⚔️ H2H Challenges' },
            { v: 'create', label: '+ Create Challenge' },
          ].map(t => (
            <button key={t.v}
              className={`${styles.tab} ${tab === t.v ? styles.tabActive : ''}`}
              onClick={() => setTab(t.v)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tournaments Tab */}
        {tab === 'tournaments' && (
          <div>
            {loading ? (
              <div className={styles.stateMsg}>Loading tournaments…</div>
            ) : tournaments.length === 0 ? (
              <div className={styles.stateMsg}>No tournaments available yet.</div>
            ) : (
              <>
                {activeTournaments.length > 0 && (
                  <>
                    <div className={styles.sectionLabel}>🔴 Live Now</div>
                    <div className={styles.tournamentGrid}>
                      {activeTournaments.map(t => (
                        <PrizeTournamentCard key={t.id} t={t} user={user} onOpenAuth={onOpenAuth}
                          onJoin={handleJoin} isJoined={joinedIds.has(t.id)} isJoining={joiningId === t.id} onNavigate={onNavigate} />
                      ))}
                    </div>
                  </>
                )}
                {upcomingTournaments.length > 0 && (
                  <>
                    <div className={styles.sectionLabel}>⏰ Upcoming</div>
                    <div className={styles.tournamentGrid}>
                      {upcomingTournaments.map(t => (
                        <PrizeTournamentCard key={t.id} t={t} user={user} onOpenAuth={onOpenAuth}
                          onJoin={handleJoin} isJoined={joinedIds.has(t.id)} isJoining={joiningId === t.id} onNavigate={onNavigate} />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Challenges Tab */}
        {tab === 'challenges' && (
          <div className={styles.comingSoon}>
            <div className={styles.comingSoonIcon}>⚔️</div>
            <h2>H2H Challenges Coming Soon</h2>
            <p>Head-to-head wager challenges are under development. Check back soon!</p>
          </div>
        )}

        {/* Create Challenge Tab */}
        {tab === 'create' && (
          <div className={styles.createSection}>
            {!user ? (
              <div className={styles.authGate}>
                <div className={styles.authGateIcon}>🔒</div>
                <h2>Sign in to post a challenge</h2>
                <p>Create and accept wager challenges to compete for prizes.</p>
                <div className={styles.authGateActions}>
                  <Button variant="primary" onClick={() => onOpenAuth('register')}>Create Account</Button>
                  <Button variant="secondary" onClick={() => onOpenAuth('login')}>Log In</Button>
                </div>
              </div>
            ) : (
              <div className={styles.createForm}>
                <h2 className={styles.createTitle}>Post a Challenge</h2>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label>Wager Amount ($)</label>
                    <div className={styles.wagerInput}>
                      <span>$</span>
                      <input type="number" value={customWager}
                        onChange={e => setCustomWager(+e.target.value)} min={1} max={10000} />
                    </div>
                    <div className={styles.wagerPresets}>
                      {[5, 10, 25, 50, 100, 500].map(v => (
                        <button key={v}
                          className={`${styles.wagerPreset} ${customWager === v ? styles.wagerPresetActive : ''}`}
                          onClick={() => setCustomWager(v)}>${v}</button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Time Control</label>
                    <select className={styles.select}>
                      <option>3+0</option><option>5+0</option><option>10+0</option>
                      <option>10+5</option><option>15+10</option><option>30+0</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label>Your Color</label>
                    <select className={styles.select}>
                      <option value="random">🎲 Random</option>
                      <option value="white">⬜ White</option>
                      <option value="black">⬛ Black</option>
                    </select>
                  </div>
                </div>
                <div className={styles.createSummary}>
                  <div className={styles.summaryRow}><span>Your stake</span><strong>${customWager.toFixed(2)}</strong></div>
                  <div className={styles.summaryRow}><span>Opponent stake</span><strong>${customWager.toFixed(2)}</strong></div>
                  <div className={styles.summaryRow}><span>Total pot</span><strong>${(customWager * 2).toFixed(2)}</strong></div>
                  <div className={`${styles.summaryRow} ${styles.rakeRow}`}>
                    <span>House rake (5%)</span><strong>−${(customWager * 2 * HOUSE_RAKE).toFixed(2)}</strong>
                  </div>
                  <div className={`${styles.summaryRow} ${styles.winRow}`}>
                    <span>Winner receives</span>
                    <strong className={styles.winAmount}>${(customWager * 2 * (1 - HOUSE_RAKE)).toFixed(2)}</strong>
                  </div>
                </div>
                <Button variant="primary" size="lg">Post Challenge</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
