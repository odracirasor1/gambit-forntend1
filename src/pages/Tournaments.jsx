// ══════════════════════════════════════════════════════
// TOURNAMENTS PAGE — create, browse, join, view details
// ══════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, SectionHeader, Modal, Input } from '../components/UI'
import PlayerName from '../components/PlayerName'
import styles from './Tournaments.module.css'

const API = import.meta.env.VITE_API_URL || ''
const token = () => localStorage.getItem('gambit_token')

const STATUS_CONFIG = {
  active:   { label: 'Live',     color: 'green' },
  upcoming: { label: 'Upcoming', color: 'gold' },
  finished: { label: 'Ended',    color: 'default' },
}

const TIME_CONTROLS = ['1+0','2+1','3+0','3+2','5+0','5+3','10+0','10+5','15+10','30+0']
const FORMATS = [
  { value: 'swiss',       label: 'Swiss',        desc: 'Pairs players by score each round' },
  { value: 'round_robin', label: 'Round Robin',  desc: 'Every player faces every other player' },
]

// ── Create Tournament Modal ───────────────────────────
function CreateTournamentModal({ show, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', description: '', format: 'swiss', time_control: '5+0',
    max_players: 32, min_players: 2, min_rating: '', max_rating: '',
    is_private: false,
    starts_at: new Date(Date.now() + 3600_000).toISOString().slice(0, 16),
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.time_control) errs.time_control = 'Required'
    if (form.min_rating && form.max_rating && +form.min_rating > +form.max_rating)
      errs.max_rating = 'Must be above min rating'
    if (form.format === 'round_robin' && +form.max_players > 32)
      errs.max_players = 'Round robin max is 32'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const body = {
        ...form,
        max_players: +form.max_players,
        min_players: +form.min_players,
        min_rating: form.min_rating ? +form.min_rating : null,
        max_rating: form.max_rating ? +form.max_rating : null,
        starts_at: new Date(form.starts_at).toISOString(),
      }
      const res = await fetch(`${API}/api/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErrors({ _global: data.error || 'Failed to create' }); return }
      onCreated(data)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal show={show} onClose={onClose} title="Create Tournament" size="lg">
      <div className={styles.modalForm}>
        {errors._global && <div className={styles.formError}>{errors._global}</div>}

        <Input label="Tournament Name" value={form.name}
          onChange={e => set('name', e.target.value)} error={errors.name}
          placeholder="e.g. Saturday Blitz Open" />

        <div className={styles.formGroup}>
          <label className={styles.label}>Description (optional)</label>
          <textarea className={styles.textarea} rows={2} value={form.description}
            onChange={e => set('description', e.target.value)}
            placeholder="Any details about the tournament…" />
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Format</label>
            <div className={styles.formatCards}>
              {FORMATS.map(f => (
                <div key={f.value}
                  className={[styles.formatCard, form.format === f.value ? styles.formatCardActive : ''].join(' ')}
                  onClick={() => set('format', f.value)}>
                  <div className={styles.formatCardName}>{f.label}</div>
                  <div className={styles.formatCardDesc}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Time Control</label>
            <select className={styles.select} value={form.time_control}
              onChange={e => set('time_control', e.target.value)}>
              {TIME_CONTROLS.map(tc => <option key={tc} value={tc}>{tc}</option>)}
            </select>
            {errors.time_control && <span className={styles.fieldError}>{errors.time_control}</span>}
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Starts At</label>
            <input type="datetime-local" className={styles.input} value={form.starts_at}
              onChange={e => set('starts_at', e.target.value)} />
          </div>
        </div>

        <div className={styles.formRow}>
          <Input label="Max Players" type="number" value={form.max_players}
            onChange={e => set('max_players', e.target.value)} error={errors.max_players} />
          <Input label="Min Players to Start" type="number" value={form.min_players}
            onChange={e => set('min_players', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <Input label="Min Rating (optional)" type="number" value={form.min_rating}
            onChange={e => set('min_rating', e.target.value)} placeholder="e.g. 1200" />
          <Input label="Max Rating (optional)" type="number" value={form.max_rating}
            onChange={e => set('max_rating', e.target.value)} error={errors.max_rating} placeholder="e.g. 2000" />
        </div>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={form.is_private}
            onChange={e => set('is_private', e.target.checked)} />
          <span>Private (invite-only)</span>
        </label>

        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Creating…' : 'Create Tournament'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Tournament Detail Modal ───────────────────────────
function TournamentDetailModal({ tournament, show, onClose, onJoin, onLeave, isJoined, user }) {
  const [tab, setTab] = useState('info')
  const [standings, setStandings] = useState([])
  const [rounds, setRounds] = useState([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!show || !tournament) return
    setLoadingDetail(true)
    Promise.all([
      fetch(`${API}/api/tournaments/${tournament.id}/standings`).then(r => r.json()),
      fetch(`${API}/api/tournaments/${tournament.id}/rounds`).then(r => r.json()),
    ]).then(([s, r]) => {
      setStandings(s.standings || [])
      setRounds(r.rounds || [])
    }).catch(() => {}).finally(() => setLoadingDetail(false))
  }, [show, tournament])

  if (!tournament) return null
  const t = tournament
  const playerCount = parseInt(t.player_count) || 0
  const sc = STATUS_CONFIG[t.status] || { label: t.status, color: 'default' }
  const dateStr = new Date(t.starts_at).toLocaleString('en-GB', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })

  return (
    <Modal show={show} onClose={onClose} title={t.name} size="lg">
      <div className={styles.detailModal}>
        <div className={styles.detailTopRow}>
          <Badge color={sc.color} dot={t.status === 'active'}>{sc.label}</Badge>
          <span className={styles.tFormat}>{(t.format || '').replace('_', ' ')}</span>
          <span className={styles.tControlBadge}>{t.time_control}</span>
          {t.is_private && <Badge color="default">🔒 Private</Badge>}
        </div>

        {t.description && <p className={styles.detailDesc}>{t.description}</p>}

        <div className={styles.detailMeta}>
          <div><span className={styles.tMetaLabel}>Players</span><span className={styles.tMetaVal}>{playerCount} / {t.max_players}</span></div>
          <div><span className={styles.tMetaLabel}>Starts</span><span className={styles.tMetaVal}>{dateStr}</span></div>
          {t.min_players > 2 && <div><span className={styles.tMetaLabel}>Min to Start</span><span className={styles.tMetaVal}>{t.min_players}</span></div>}
          {t.min_rating && <div><span className={styles.tMetaLabel}>Min Rating</span><span className={styles.tMetaVal}>{t.min_rating}</span></div>}
          {t.max_rating && <div><span className={styles.tMetaLabel}>Max Rating</span><span className={styles.tMetaVal}>{t.max_rating}</span></div>}
          {t.created_by_username && <div><span className={styles.tMetaLabel}>Organizer</span><span className={styles.tMetaVal}>{t.created_by_username}</span></div>}
        </div>

        <div className={styles.detailTabs}>
          {['info','standings','rounds'].map(tb => (
            <button key={tb} className={[styles.detailTab, tab === tb ? styles.detailTabActive : ''].join(' ')}
              onClick={() => setTab(tb)}>
              {tb.charAt(0).toUpperCase() + tb.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'info' && (
          <div className={styles.playerList}>
            <div className={styles.playerListTitle}>Registered Players ({playerCount})</div>
            {(t.players || []).map(p => (
              <div key={p.id} className={styles.playerRow}>
                <PlayerName username={p.username} title={p.fide_title || p.platform_title} size="sm" />
                <span className={styles.playerRating}>{p.rating}</span>
              </div>
            ))}
            {!t.players?.length && <div className={styles.emptyMsg}>No players yet</div>}
          </div>
        )}

        {tab === 'standings' && (
          <div className={styles.standingsTable}>
            {loadingDetail ? <div className={styles.emptyMsg}>Loading…</div> :
             standings.length === 0 ? <div className={styles.emptyMsg}>No standings yet — tournament hasn't started</div> :
             standings.map(p => (
              <div key={p.id} className={styles.standingRow}>
                <span className={styles.standingRank}>
                  {p.rank === '1' || p.rank === 1 ? '🥇' : p.rank === '2' || p.rank === 2 ? '🥈' : p.rank === '3' || p.rank === 3 ? '🥉' : `#${p.rank}`}
                </span>
                <PlayerName username={p.username} title={p.fide_title || p.platform_title} size="sm" />
                <span className={styles.standingScore}>{p.score} pts</span>
                <span className={styles.standingRecord}>{p.wins}W {p.draws}D {p.losses}L</span>
              </div>
            ))}
          </div>
        )}

        {tab === 'rounds' && (
          <div className={styles.roundsList}>
            {loadingDetail ? <div className={styles.emptyMsg}>Loading…</div> :
             rounds.length === 0 ? <div className={styles.emptyMsg}>No rounds yet</div> :
             rounds.map(r => (
              <div key={r.round} className={styles.roundBlock}>
                <div className={styles.roundTitle}>Round {r.round}</div>
                {r.games.map(g => (
                  <div key={g.gameId} className={styles.roundGame}>
                    <PlayerName username={g.white?.username} title={g.white?.fide_title || g.white?.platform_title} size="sm" />
                    <span className={styles.roundResult}>{g.result || (g.status === 'active' ? '⚡' : '—')}</span>
                    <PlayerName username={g.black?.username} title={g.black?.fide_title || g.black?.platform_title} size="sm" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className={styles.detailActions}>
          {t.status === 'upcoming' && (
            isJoined
              ? <Button variant="secondary" onClick={() => { onLeave(t.id); onClose() }}>Leave Tournament</Button>
              : <Button variant="primary" onClick={() => { onJoin(t.id); onClose() }}
                  disabled={playerCount >= t.max_players}>
                  {playerCount >= t.max_players ? 'Full' : 'Join Tournament'}
                </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────
export function TournamentsPage({ user, onOpenAuth }) {
  const [filter, setFilter] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [joiningId, setJoiningId] = useState(null)
  const [joinedIds, setJoinedIds] = useState(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)

  const fetchTournaments = useCallback(() => {
    setLoading(true)
    const url = filter ? `${API}/api/tournaments?status=${filter}` : `${API}/api/tournaments`
    fetch(url).then(r => r.json())
      .then(data => { setTournaments(Array.isArray(data) ? data : []); setError(null) })
      .catch(() => setError('Failed to load tournaments'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { fetchTournaments() }, [fetchTournaments])

  useEffect(() => {
    if (!user) return
    fetch(`${API}/api/tournaments/my`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setJoinedIds(new Set(data.map(t => t.id))) })
      .catch(() => {})
  }, [user])

  async function handleJoin(tournamentId) {
    if (!user) { onOpenAuth('register'); return }
    setJoiningId(tournamentId)
    try {
      const res = await fetch(`${API}/api/tournaments/${tournamentId}/join`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json()
      if (res.ok) { setJoinedIds(prev => new Set([...prev, tournamentId])); fetchTournaments() }
      else alert(data.error || 'Could not join')
    } catch { alert('Network error') }
    finally { setJoiningId(null) }
  }

  async function handleLeave(tournamentId) {
    if (!user) return
    try {
      await fetch(`${API}/api/tournaments/${tournamentId}/leave`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
      })
      setJoinedIds(prev => { const s = new Set(prev); s.delete(tournamentId); return s })
      fetchTournaments()
    } catch { alert('Network error') }
  }

  async function openDetail(t) {
    // Fetch full detail (includes players list)
    try {
      const res = await fetch(`${API}/api/tournaments/${t.id}`,
        user ? { headers: { Authorization: `Bearer ${token()}` } } : undefined)
      const full = await res.json()
      setSelected(res.ok ? full : t)
    } catch { setSelected(t) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <SectionHeader
            title="Tournaments"
            subtitle="Compete"
            action={<Button variant="primary" onClick={() => user ? setShowCreate(true) : onOpenAuth('register')}>+ Create</Button>}
          />
          <p className={styles.headerDesc}>
            Swiss and Round Robin events — join, spectate, and climb the standings.
          </p>
        </div>

        <div className={styles.filters}>
          {[{ v:'', label:'All' }, { v:'active', label:'🔴 Live' }, { v:'upcoming', label:'⏰ Upcoming' }, { v:'finished', label:'✓ Finished' }]
            .map(f => (
              <button key={f.v}
                className={[styles.filterBtn, filter === f.v ? styles.filterActive : ''].join(' ')}
                onClick={() => setFilter(f.v)}>{f.label}</button>
            ))}
        </div>

        {loading ? <div className={styles.state}>Loading tournaments…</div>
          : error ? <div className={styles.state}>{error} <button onClick={fetchTournaments}>Retry</button></div>
          : tournaments.length === 0 ? <div className={styles.state}>No tournaments found.</div>
          : (
          <div className={styles.grid}>
            {tournaments.map(t => {
              const sc = STATUS_CONFIG[t.status] || { label: t.status, color: 'default' }
              const playerCount = parseInt(t.player_count) || 0
              const pct = Math.round((playerCount / t.max_players) * 100)
              const dateStr = t.status === 'active' ? 'In progress'
                : new Date(t.starts_at).toLocaleDateString('en-GB', { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
              const isJoined = joinedIds.has(t.id)
              const isJoining = joiningId === t.id

              return (
                <Card key={t.id} className={styles.tCard} hoverable>
                  <div className={styles.tCardTop}>
                    <Badge color={sc.color} dot={t.status === 'active'} size="sm">{sc.label}</Badge>
                    <div className={styles.tCardTopRight}>
                      {t.is_private && <span className={styles.privateBadge}>🔒</span>}
                      <span className={styles.tFormat}>{(t.format || '').replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className={styles.tName}>{t.name}</div>
                  {t.description && <div className={styles.tDesc}>{t.description}</div>}
                  <div className={styles.tControl}>
                    <span className={styles.tControlBadge}>{t.time_control}</span>
                    {t.min_rating && <span className={styles.tRatingGate}>{t.min_rating}+</span>}
                    {t.max_rating && <span className={styles.tRatingGate}>≤{t.max_rating}</span>}
                  </div>

                  <div className={styles.tMeta}>
                    <div className={styles.tMetaItem}>
                      <span className={styles.tMetaLabel}>Players</span>
                      <span className={styles.tMetaVal}>{playerCount} / {t.max_players}</span>
                    </div>
                    <div className={styles.tMetaItem}>
                      <span className={styles.tMetaLabel}>{t.status === 'active' ? 'Status' : 'Starts'}</span>
                      <span className={styles.tMetaVal}>{dateStr}</span>
                    </div>
                  </div>

                  <div className={styles.tProgress}>
                    <div className={styles.tProgressBar}>
                      <div className={styles.tProgressFill} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.tProgressLabel}>{pct}% full</span>
                  </div>

                  <div className={styles.tActions}>
                    {t.status === 'finished' ? (
                      <Button variant="secondary" size="sm" onClick={() => openDetail(t)}>View Results</Button>
                    ) : t.status === 'active' ? (
                      <Button variant="primary" size="sm" onClick={() => openDetail(t)}>Standings</Button>
                    ) : isJoined ? (
                      <Button variant="secondary" size="sm" onClick={() => handleLeave(t.id)}>✓ Joined — Leave</Button>
                    ) : (
                      <Button variant="primary" size="sm"
                        onClick={() => handleJoin(t.id)}
                        disabled={isJoining || playerCount >= t.max_players}>
                        {isJoining ? 'Joining…' : playerCount >= t.max_players ? 'Full' : 'Join'}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openDetail(t)}>Details</Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <CreateTournamentModal
        show={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => fetchTournaments()}
      />

      <TournamentDetailModal
        show={!!selected}
        tournament={selected}
        onClose={() => setSelected(null)}
        onJoin={handleJoin}
        onLeave={handleLeave}
        isJoined={selected && joinedIds.has(selected.id)}
        user={user}
      />
    </div>
  )
}
