// ══════════════════════════════════════════════════════
// CHALLENGE INBOX — floating panel for incoming challenges
// Shown globally when user is logged in.
// Receives real-time 'game-challenge' WS events and also
// polls GET /api/users/me/challenges on mount.
// ══════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Avatar } from './UI'
import PlayerName from './PlayerName'
import styles from './ChallengeInbox.module.css'

const API = import.meta.env.VITE_API_URL || ''
const token = () => localStorage.getItem('gambit_token')

export default function ChallengeInbox({ user, newChallenge, onNavigate }) {
  const [challenges, setChallenges] = useState([])
  const [open, setOpen]             = useState(false)
  const [acting, setActing]         = useState(null) // id being accepted/declined

  const fetchChallenges = useCallback(() => {
    if (!user) return
    fetch(`${API}/api/users/me/challenges`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(data => setChallenges(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [user])

  // Initial load
  useEffect(() => { fetchChallenges() }, [fetchChallenges])

  // Real-time: new challenge pushed via WS from App.jsx
  useEffect(() => {
    if (!newChallenge) return
    // Avoid duplicates
    setChallenges(prev =>
      prev.find(c => c.username === newChallenge.username)
        ? prev
        : [{ id: newChallenge.id, username: newChallenge.username, created_at: new Date().toISOString() }, ...prev]
    )
    setOpen(true)
  }, [newChallenge])

  async function accept(challenge) {
    setActing(challenge.id)
    try {
      const res = await fetch(`${API}/api/users/challenges/${challenge.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) {
        setChallenges(cs => cs.filter(c => c.id !== challenge.id))
        // Navigate to play — game will start via WS game_start event
        onNavigate?.('play')
        if (challenges.length <= 1) setOpen(false)
      }
    } catch {}
    finally { setActing(null) }
  }

  async function decline(challenge) {
    setActing(challenge.id)
    try {
      await fetch(`${API}/api/users/challenges/${challenge.id}/decline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      })
      setChallenges(cs => cs.filter(c => c.id !== challenge.id))
      if (challenges.length <= 1) setOpen(false)
    } catch {}
    finally { setActing(null) }
  }

  if (!user || challenges.length === 0) return null

  return (
    <div className={styles.root}>
      {/* Toggle button */}
      <button className={styles.toggle} onClick={() => setOpen(o => !o)}>
        ⚔️ {challenges.length} Challenge{challenges.length !== 1 ? 's' : ''}
        <span className={styles.toggleDot} />
      </button>

      {/* Panel */}
      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            Incoming Challenges
            <button className={styles.closeBtn} onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className={styles.list}>
            {challenges.map(c => (
              <div key={c.id} className={styles.row}>
                <Avatar username={c.username} size={36} />
                <div className={styles.rowInfo}>
                  <PlayerName username={c.username} title={c.fide_title || c.platform_title} size="sm" />
                  <div className={styles.rowTime}>
                    {new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <button
                    className={styles.acceptBtn}
                    onClick={() => accept(c)}
                    disabled={acting === c.id}
                  >
                    {acting === c.id ? '…' : '✓ Accept'}
                  </button>
                  <button
                    className={styles.declineBtn}
                    onClick={() => decline(c)}
                    disabled={acting === c.id}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
