// ══════════════════════════════════════════════════════
// PROFILE PAGE — own profile + public profiles
// Routes:
//   profile          → own profile (requires auth)
//   profile/:username → public profile of any user
// ══════════════════════════════════════════════════════
import { useState, useEffect } from 'react'
import { Avatar, Button, Badge, Modal, Input } from '../components/UI'
import PlayerName, { TitleBadge } from '../components/PlayerName'
import styles from './Profile.module.css'

const API = import.meta.env.VITE_API_URL || ''

function StatCard({ label, value, sub }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue}>{value ?? '—'}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

function GameRow({ game, username, onReview }) {
  if (!game) return null
  const isWhite = game.white === username
  const opponent = isWhite ? game.black : game.white
  const opponentTitle = isWhite ? game.black_title : game.white_title
  let outcome = '½'
  let outcomeClass = styles.draw
  if (game.result === '1-0') {
    outcome = isWhite ? 'W' : 'L'
    outcomeClass = isWhite ? styles.win : styles.loss
  } else if (game.result === '0-1') {
    outcome = isWhite ? 'L' : 'W'
    outcomeClass = isWhite ? styles.loss : styles.win
  }
  const date = game.ended_at ? new Date(game.ended_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : '—'

  return (
    <div className={styles.gameRow} onClick={() => onReview?.(game.id)} style={{ cursor: 'pointer' }}>
      <span className={`${styles.outcome} ${outcomeClass}`}>{outcome}</span>
      <span className={styles.gameOpponent}>
        <PlayerName username={opponent} title={opponentTitle} size="sm" />
      </span>
      <span className={styles.gameType}>{game.game_type}</span>
      <span className={styles.gameTC}>{game.time_control}</span>
      <span className={styles.gameMoves}>{game.move_count ?? '—'} moves</span>
      <span className={styles.gameDate}>{date}</span>
    </div>
  )
}


// ── Edit Profile Modal ────────────────────────────────
function EditProfileModal({ show, onClose, form, onChange, onSave, saving }) {
  const set = (k, v) => onChange(f => ({ ...f, [k]: v }))

  return (
    <Modal show={show} onClose={onClose} title="Edit Profile" size="lg">
      <div className={styles.editModal}>

        {/* ── Identity ── */}
        <div className={styles.editSection}>
          <div className={styles.editSectionTitle}>Identity</div>
          <div className={styles.editRow}>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Avatar URL</label>
              <input className={styles.editInput} placeholder="https://…" value={form.avatar_url}
                onChange={e => set('avatar_url', e.target.value)} />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Country (2-letter code)</label>
              <input className={styles.editInput} placeholder="e.g. AO" maxLength={2}
                value={form.country} onChange={e => set('country', e.target.value.toUpperCase())} />
            </div>
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Location</label>
            <input className={styles.editInput} placeholder="City, Country" value={form.location}
              onChange={e => set('location', e.target.value)} />
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>Bio <span className={styles.editLabelHint}>(max 500 chars)</span></label>
            <textarea className={styles.editTextarea} rows={3} maxLength={500}
              placeholder="Tell the community about yourself…"
              value={form.bio} onChange={e => set('bio', e.target.value)} />
            <div className={styles.charCount}>{(form.bio || '').length} / 500</div>
          </div>
        </div>

        {/* ── External links ── */}
        <div className={styles.editSection}>
          <div className={styles.editSectionTitle}>Links & Handles</div>
          <div className={styles.editRow}>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Website</label>
              <input className={styles.editInput} placeholder="https://yoursite.com" value={form.website}
                onChange={e => set('website', e.target.value)} />
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Twitter / X</label>
              <div className={styles.editInputPrefix}>
                <span className={styles.prefix}>@</span>
                <input className={styles.editInputInner} placeholder="handle" value={form.twitter_handle}
                  onChange={e => set('twitter_handle', e.target.value.replace(/^@/, ''))} />
              </div>
            </div>
          </div>
          <div className={styles.editRow}>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Twitch</label>
              <div className={styles.editInputPrefix}>
                <span className={styles.prefix}>@</span>
                <input className={styles.editInputInner} placeholder="handle" value={form.twitch_handle}
                  onChange={e => set('twitch_handle', e.target.value.replace(/^@/, ''))} />
              </div>
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Lichess username</label>
              <input className={styles.editInput} placeholder="lichess-user" value={form.lichess_username}
                onChange={e => set('lichess_username', e.target.value)} />
            </div>
          </div>
          <div className={styles.editField} style={{ maxWidth: '50%' }}>
            <label className={styles.editLabel}>Chess.com username</label>
            <input className={styles.editInput} placeholder="chess-com-user" value={form.chess_com_username}
              onChange={e => set('chess_com_username', e.target.value)} />
          </div>
        </div>

        {/* ── Privacy ── */}
        <div className={styles.editSection}>
          <div className={styles.editSectionTitle}>Privacy</div>
          <div className={styles.editRow}>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Profile visibility</label>
              <select className={styles.editSelect} value={form.profile_visibility}
                onChange={e => set('profile_visibility', e.target.value)}>
                <option value="public">Public — anyone can view</option>
                <option value="private">Private — hidden from others</option>
              </select>
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Who can message you</label>
              <select className={styles.editSelect} value={form.allow_messages}
                onChange={e => set('allow_messages', e.target.value)}>
                <option value="everyone">Everyone</option>
                <option value="friends">Friends only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
          </div>
          <div className={styles.editRow}>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Who can challenge you</label>
              <select className={styles.editSelect} value={form.allow_challenges}
                onChange={e => set('allow_challenges', e.target.value)}>
                <option value="everyone">Everyone</option>
                <option value="friends">Friends only</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <div className={styles.editField}>
              <label className={styles.editLabel}>Online status</label>
              <label className={styles.editToggle}>
                <input type="checkbox" checked={form.show_online_status}
                  onChange={e => set('show_online_status', e.target.checked)} />
                Show when I am online
              </label>
            </div>
          </div>
        </div>

        <div className={styles.editModalActions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function ProfilePage({ user, targetUsername, onNavigate, onOpenAuth }) {
  // If targetUsername is provided, show that user's public profile
  // Otherwise show the logged-in user's own profile
  const isOwn = !targetUsername || (user && targetUsername === user.username)
  const username = targetUsername || user?.username

  const [profile, setProfile]       = useState(null)
  const [games, setGames]           = useState([])
  const [gamesPage, setGamesPage]   = useState(1)
  const [gamesTotal, setGamesTotal] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [gamesLoading, setGamesLoading] = useState(false)
  const [error, setError]           = useState(null)
  const [editing, setEditing]       = useState(false)
  const [editForm, setEditForm]     = useState({
    country: '', avatar_url: '', bio: '', location: '',
    website: '', twitter_handle: '', twitch_handle: '',
    lichess_username: '', chess_com_username: '',
    show_online_status: true,
    allow_messages: 'everyone', allow_challenges: 'everyone',
    profile_visibility: 'public',
  })
  const [saving, setSaving]         = useState(false)
  const [activeTab, setActiveTab]   = useState('games')
  const [playStats, setPlayStats]   = useState([])
  const [titleForm, setTitleForm]   = useState({ fide_id: '', fide_title: '' })
  const [titleMsg, setTitleMsg]     = useState(null)
  const [claimingTitle, setClaimingTitle] = useState(false)

  // Follow state (public profiles only)
  const [isFollowing,   setIsFollowing]   = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [challengeSent, setChallengeSent] = useState(false)
  const [challenging,   setChallenging]   = useState(false)

  // Fetch play/stats breakdown for own profile
  useEffect(() => {
    if (!isOwn || !user) return
    const token = localStorage.getItem('gambit_token')
    fetch(`${API}/api/play/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => setPlayStats(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [isOwn, user])

  // Fetch profile data
  useEffect(() => {
    if (!username) return
    setLoading(true)
    fetch(`${API}/api/users/${username}`)
      .then(r => { if (!r.ok) throw new Error('Not found'); return r.json() })
      .then(data => {
        setProfile(data)
        setEditForm({
          country:            data.country            || '',
          avatar_url:         data.avatar_url         || '',
          bio:                data.bio                || '',
          location:           data.location           || '',
          website:            data.website            || '',
          twitter_handle:     data.twitter_handle     || '',
          twitch_handle:      data.twitch_handle      || '',
          lichess_username:   data.lichess_username   || '',
          chess_com_username: data.chess_com_username || '',
          show_online_status: data.show_online_status ?? true,
          allow_messages:     data.allow_messages     || 'everyone',
          allow_challenges:   data.allow_challenges   || 'everyone',
          profile_visibility: data.profile_visibility || 'public',
        })
        setError(null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [username])

  // Fetch game history
  useEffect(() => {
    if (!username) return
    setGamesLoading(true)
    fetch(`${API}/api/users/${username}/games?page=${gamesPage}&limit=15`)
      .then(r => r.json())
      .then(data => {
        setGames(data.games || [])
        setGamesTotal(data.total || 0)
      })
      .catch(() => {})
      .finally(() => setGamesLoading(false))
  }, [username, gamesPage])

  // Fetch follow status for public profiles
  useEffect(() => {
    if (isOwn || !username) return
    fetch(`${API}/api/users/${username}/followers`)
      .then(r => r.json())
      .then(data => {
        const followers = data.followers || []
        setFollowerCount(followers.length)
        if (user) setIsFollowing(followers.some(f => f.id === user.id || f.username === user.username))
      })
      .catch(() => {})
  }, [isOwn, username, user])

  async function toggleFollow() {
    if (!user) { onOpenAuth('login'); return }
    setFollowLoading(true)
    try {
      const method = isFollowing ? 'DELETE' : 'POST'
      const res = await fetch(`${API}/api/users/${username}/follow`, {
        method,
        headers: { Authorization: `Bearer ${localStorage.getItem('gambit_token')}` },
      })
      if (res.ok) {
        setIsFollowing(f => !f)
        setFollowerCount(c => isFollowing ? c - 1 : c + 1)
      }
    } catch {}
    finally { setFollowLoading(false) }
  }

  async function sendChallenge() {
    if (!user) { onOpenAuth('login'); return }
    setChallenging(true)
    try {
      const res = await fetch(`${API}/api/users/${username}/challenge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('gambit_token')}` },
      })
      if (res.ok) setChallengeSent(true)
    } catch {}
    finally { setChallenging(false) }
  }

  async function handleSaveProfile() {
    const token = localStorage.getItem('gambit_token')
    setSaving(true)
    try {
      const body = {}
      const strFields = ['country','avatar_url','bio','location','website',
                         'twitter_handle','twitch_handle','lichess_username','chess_com_username']
      strFields.forEach(k => { if (editForm[k] !== undefined) body[k] = editForm[k] || null })
      body.show_online_status = editForm.show_online_status
      body.allow_messages     = editForm.allow_messages
      body.allow_challenges   = editForm.allow_challenges
      body.profile_visibility = editForm.profile_visibility
      const res = await fetch(`${API}/api/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setProfile(prev => ({ ...prev, ...data }))
        setEditing(false)
        // Update local storage too
        const stored = JSON.parse(localStorage.getItem('gambit_user') || '{}')
        localStorage.setItem('gambit_user', JSON.stringify({ ...stored, ...data }))
      } else {
        alert(data.error || 'Failed to save')
      }
    } catch { alert('Network error') }
    finally { setSaving(false) }
  }

  async function claimTitle() {
    if (!titleForm.fide_id || !titleForm.fide_title) return
    setClaimingTitle(true); setTitleMsg(null)
    try {
      const res = await fetch(`${API}/api/users/me/title`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('gambit_token')}`,
        },
        body: JSON.stringify(titleForm),
      })
      const data = await res.json()
      if (res.ok) {
        setProfile(p => ({ ...p, fide_title: data.user.fide_title, fide_id: data.user.fide_id }))
        setTitleMsg({ type: 'success', text: data.message })
      } else {
        setTitleMsg({ type: 'error', text: data.error })
      }
    } catch { setTitleMsg({ type: 'error', text: 'Network error' }) }
    finally { setClaimingTitle(false) }
  }

  async function removeTitle() {
    try {
      await fetch(`${API}/api/users/me/title`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('gambit_token')}` },
      })
      setProfile(p => ({ ...p, fide_title: null, fide_id: null }))
      setTitleMsg({ type: 'success', text: 'Title removed' })
    } catch { setTitleMsg({ type: 'error', text: 'Network error' }) }
  }

  // Early returns — must come after all hooks
  if (!user && !targetUsername) return (
    <div className={styles.gate}>
      <div className={styles.gateIcon}>👤</div>
      <h2>Sign in to view your profile</h2>
      <Button variant="primary" onClick={() => onOpenAuth('login')}>Log In</Button>
    </div>
  )

  if (loading) return <div className={styles.loading}>Loading profile…</div>
  if (error)   return <div className={styles.error}>User not found.</div>
  if (!profile) return null

  const winRate = profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0
  const losses = (profile.games_played || 0) - (profile.games_won || 0) - (profile.games_drawn || 0)
  const totalPages = Math.ceil(gamesTotal / 15)

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* ── Header card ──────────────────────────────── */}
        <div className={styles.profileCard}>
          <div className={styles.profileLeft}>
            <div className={styles.avatarWrap}>
              <Avatar username={profile.username} size={80} src={profile.avatar_url} />
              {profile.streak > 0 && (
                <div className={styles.streakBadge}>🔥 {profile.streak}</div>
              )}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>
                <PlayerName
                  username={profile.username}
                  title={profile.fide_title || profile.platform_title}
                  size="xl"
                />
              </div>
              {profile.country && (
                <div className={styles.profileCountry}>{profile.country}</div>
              )}
              {profile.bio && (
                <div className={styles.profileBio}>{profile.bio}</div>
              )}
              <div className={styles.profileMeta}>
                {profile.location && <span>📍 {profile.location}</span>}
                <span>Joined {new Date(profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
                {!isOwn && followerCount > 0 && (
                  <span className={styles.followerCount}>{followerCount} follower{followerCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              {(profile.website || profile.twitter_handle || profile.twitch_handle || profile.lichess_username || profile.chess_com_username) && (
                <div className={styles.profileLinks}>
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer" className={styles.profileLink}>🌐 Website</a>
                  )}
                  {profile.twitter_handle && (
                    <a href={`https://twitter.com/${profile.twitter_handle}`} target="_blank" rel="noreferrer" className={styles.profileLink}>𝕏 @{profile.twitter_handle}</a>
                  )}
                  {profile.twitch_handle && (
                    <a href={`https://twitch.tv/${profile.twitch_handle}`} target="_blank" rel="noreferrer" className={styles.profileLink}>🎮 {profile.twitch_handle}</a>
                  )}
                  {profile.lichess_username && (
                    <a href={`https://lichess.org/@/${profile.lichess_username}`} target="_blank" rel="noreferrer" className={styles.profileLink}>♟ Lichess</a>
                  )}
                  {profile.chess_com_username && (
                    <a href={`https://chess.com/member/${profile.chess_com_username}`} target="_blank" rel="noreferrer" className={styles.profileLink}>♚ Chess.com</a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.profileRight}>
            {/* Own profile: opens modal */}
            {isOwn && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                ✏️ Edit Profile
              </Button>
            )}
            {/* Public profile: follow + message + challenge */}
            {!isOwn && (
              <div className={styles.publicActions}>
                <Button
                  variant={isFollowing ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={toggleFollow}
                  disabled={followLoading}
                >
                  {followLoading ? '…' : isFollowing ? '✓ Following' : '+ Follow'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onNavigate('messages', { username: profile.username })}
                >
                  ✉️ Message
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={sendChallenge}
                  disabled={challenging || challengeSent}
                >
                  {challengeSent ? '⚔️ Challenged!' : challenging ? '…' : '⚔️ Challenge'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ── FIDE Title claim (own profile only) ──────── */}
        {isOwn && (
          <div className={styles.titleSection}>
            <div className={styles.titleSectionHeader}>
              <span className={styles.titleSectionTitle}>🏅 FIDE Title</span>
              {profile.fide_title && (
                <TitleBadge title={profile.fide_title} size="lg" />
              )}
            </div>
            {profile.fide_title ? (
              <div className={styles.titleClaimed}>
                <span className={styles.titleClaimedText}>
                  Title <strong>{profile.fide_title}</strong> claimed
                  {profile.fide_id && ` · FIDE ID: ${profile.fide_id}`}
                  {' · Pending admin verification'}
                </span>
                <Button variant="ghost" size="sm" onClick={removeTitle}>Remove</Button>
              </div>
            ) : (
              <div className={styles.titleClaimForm}>
                <p className={styles.titleClaimDesc}>
                  If you hold a FIDE title, enter your details below. An admin will verify and confirm it.
                </p>
                <div className={styles.titleClaimInputs}>
                  <select
                    className={styles.titleSelect}
                    value={titleForm.fide_title}
                    onChange={e => setTitleForm(f => ({ ...f, fide_title: e.target.value }))}
                  >
                    <option value="">Select title…</option>
                    {['GM','IM','FM','CM','WGM','WIM','WFM','WCM'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    className={styles.titleInput}
                    placeholder="FIDE ID (numbers only)"
                    value={titleForm.fide_id}
                    onChange={e => setTitleForm(f => ({ ...f, fide_id: e.target.value }))}
                  />
                  <Button variant="primary" size="sm" onClick={claimTitle} disabled={claimingTitle || !titleForm.fide_title || !titleForm.fide_id}>
                    {claimingTitle ? 'Saving…' : 'Claim Title'}
                  </Button>
                </div>
                {titleMsg && (
                  <div className={`${styles.titleMsg} ${styles[`titleMsg_${titleMsg.type}`]}`}>
                    {titleMsg.text}
                  </div>
                )}
                <p className={styles.titleClaimNote}>
                  You can verify FIDE IDs at <a href="https://ratings.fide.com" target="_blank" rel="noreferrer">ratings.fide.com</a>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Platform Title (shown on any profile) ────── */}
        {(profile.platform_title || isOwn) && (
          <div className={styles.titleSection}>
            <div className={styles.titleSectionHeader}>
              <span className={styles.titleSectionTitle}>⭐ Gambit Platform Title</span>
              {profile.platform_title && (
                <TitleBadge title={profile.platform_title} size="lg" />
              )}
            </div>
            {profile.platform_title ? (
              <div className={styles.titleClaimed}>
                <span className={styles.titleClaimedText}>
                  <strong>{profile.platform_title === 'CS' ? 'Chess SuperGrandmaster' : 'Chessle Grandmaster'}</strong>
                  {' · Awarded by Gambit'}
                  {profile.platform_title_granted_at && (
                    <> · {new Date(profile.platform_title_granted_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</>
                  )}
                </span>
              </div>
            ) : isOwn ? (
              <p className={styles.titleClaimDesc} style={{ margin: 0 }}>
                Platform titles (CG / CS) are awarded automatically when you meet the conditions —
                no application needed. They are only available to players without a FIDE title.
              </p>
            ) : null}
          </div>
        )}

        {/* ── Ratings ──────────────────────────────────── */}
        <div className={styles.ratingsRow}>
          <div className={styles.ratingCard}>
            <div className={styles.ratingIcon}>🔥</div>
            <div className={styles.ratingVal}>{profile.rating_bullet ?? 1200}</div>
            <div className={styles.ratingLabel}>Bullet</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingIcon}>⚡</div>
            <div className={styles.ratingVal}>{profile.rating ?? 1200}</div>
            <div className={styles.ratingLabel}>Blitz</div>
          </div>
          <div className={styles.ratingCard}>
            <div className={styles.ratingIcon}>⏱</div>
            <div className={styles.ratingVal}>{profile.rating_rapid ?? 1200}</div>
            <div className={styles.ratingLabel}>Rapid</div>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────── */}
        <div className={styles.statsGrid}>
          <StatCard label="Games Played" value={profile.games_played} />
          <StatCard label="Wins"         value={profile.games_won} />
          <StatCard label="Draws"        value={profile.games_drawn} />
          <StatCard label="Losses"       value={losses} />
          <StatCard label="Win Rate"     value={`${winRate}%`} />
          <StatCard label="Streak"       value={profile.streak} sub="current" />
        </div>

        {/* ── Tabs ─────────────────────────────────────── */}
        <div className={styles.tabs}>
          {['games', 'stats'].map(t => (
            <button key={t}
              className={`${styles.tab} ${activeTab === t ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Game History ─────────────────────────────── */}
        {activeTab === 'games' && (
          <div className={styles.gamesSection}>
            <div className={styles.gamesHeader}>
              <span className={styles.gamesTitle}>Game History</span>
              <span className={styles.gamesCount}>{gamesTotal} games</span>
            </div>

            {gamesLoading ? (
              <div className={styles.gamesLoading}>Loading…</div>
            ) : games.length === 0 ? (
              <div className={styles.gamesEmpty}>No games played yet.</div>
            ) : (
              <>
                <div className={styles.gamesTableHead}>
                  <span>Result</span>
                  <span>Opponent</span>
                  <span>Type</span>
                  <span>Time</span>
                  <span>Moves</span>
                  <span>Date</span>
                </div>
                {games.map(g => (
                  <GameRow key={g.id} game={g} username={profile.username}
                    onReview={(id) => onNavigate('game_review', { gameId: id })} />
                ))}

                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.pageBtn}
                      disabled={gamesPage === 1}
                      onClick={() => setGamesPage(p => p - 1)}>
                      ← Prev
                    </button>
                    <span className={styles.pageInfo}>{gamesPage} / {totalPages}</span>
                    <button
                      className={styles.pageBtn}
                      disabled={gamesPage === totalPages}
                      onClick={() => setGamesPage(p => p + 1)}>
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Stats Tab ────────────────────────────────── */}
        {activeTab === 'stats' && (
          <div className={styles.statsSection}>
            <div className={styles.statsBreakdown}>
              <div className={styles.wdlBar}>
                <div className={styles.wdlWin}  style={{ width: `${winRate}%` }} title={`Wins: ${profile.games_won}`} />
                <div className={styles.wdlDraw} style={{ width: `${profile.games_played > 0 ? Math.round((profile.games_drawn / profile.games_played) * 100) : 0}%` }} title={`Draws: ${profile.games_drawn}`} />
                <div className={styles.wdlLoss} style={{ width: `${profile.games_played > 0 ? Math.round((losses / profile.games_played) * 100) : 0}%` }} title={`Losses: ${losses}`} />
              </div>
              <div className={styles.wdlLegend}>
                <span className={styles.legendWin}>■ Wins ({profile.games_won})</span>
                <span className={styles.legendDraw}>■ Draws ({profile.games_drawn})</span>
                <span className={styles.legendLoss}>■ Losses ({losses})</span>
              </div>
            </div>

            {playStats.length > 0 && (
              <div className={styles.playStatsTable}>
                <div className={styles.playStatsTitle}>Breakdown by time control</div>
                <div className={styles.playStatsHead}>
                  <span>Type</span><span>Games</span><span>Wins</span><span>Draws</span><span>Losses</span><span>Avg moves</span>
                </div>
                {playStats.map(s => (
                  <div key={s.game_type} className={styles.playStatsRow}>
                    <span className={styles.playStatsType}>{s.game_type}</span>
                    <span>{s.total}</span>
                    <span className={styles.recW}>{s.wins}</span>
                    <span className={styles.recD}>{s.draws}</span>
                    <span className={styles.recL}>{s.losses}</span>
                    <span>{s.avg_moves ?? '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Edit Profile Modal ── */}
      {isOwn && (
        <EditProfileModal
          show={editing}
          onClose={() => setEditing(false)}
          form={editForm}
          onChange={setEditForm}
          onSave={handleSaveProfile}
          saving={saving}
        />
      )}
    </div>
  )
}
