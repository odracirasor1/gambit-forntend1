// ══════════════════════════════════════════════════════
// TEAMS PAGE — browse, create, join, manage teams
// ══════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, SectionHeader, Modal, Input } from '../components/UI'
import PlayerName from '../components/PlayerName'
import styles from './Teams.module.css'

const API = import.meta.env.VITE_API_URL || ''
const token = () => localStorage.getItem('gambit_token')

// ── Create Team Modal ─────────────────────────────────
function CreateTeamModal({ show, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', description: '', country: '', is_open: true, max_members: 100 })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    const errs = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/tournaments/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ ...form, max_members: +form.max_members, country: form.country || null }),
      })
      const data = await res.json()
      if (!res.ok) { setErrors({ _global: data.error }); return }
      onCreated(data); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal show={show} onClose={onClose} title="Create Team" size="md">
      <div className={styles.modalForm}>
        {errors._global && <div className={styles.formError}>{errors._global}</div>}
        <Input label="Team Name" value={form.name} onChange={e => set('name', e.target.value)} error={errors.name} placeholder="e.g. Sicilian Knights" />
        <div className={styles.formGroup}>
          <label className={styles.label}>Description (optional)</label>
          <textarea className={styles.textarea} rows={2} value={form.description}
            onChange={e => set('description', e.target.value)} placeholder="What's your team about?" />
        </div>
        <div className={styles.formRow}>
          <Input label="Country Code (optional)" value={form.country} onChange={e => set('country', e.target.value.toUpperCase())} placeholder="e.g. AO" />
          <Input label="Max Members" type="number" value={form.max_members} onChange={e => set('max_members', e.target.value)} />
        </div>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={form.is_open} onChange={e => set('is_open', e.target.checked)} />
          <span>Open team (anyone can join without approval)</span>
        </label>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Creating…' : 'Create Team'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Join Request Modal ────────────────────────────────
function JoinRequestModal({ team, show, onClose, onDone }) {
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API}/api/tournaments/teams/${team.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ message }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      onDone(data); onClose()
    } finally { setSaving(false) }
  }

  return (
    <Modal show={show} onClose={onClose} title={`Request to join ${team?.name}`} size="sm">
      <div className={styles.modalForm}>
        {error && <div className={styles.formError}>{error}</div>}
        <p className={styles.joinNote}>This is a closed team. Your request will be sent to the captain for approval.</p>
        <div className={styles.formGroup}>
          <label className={styles.label}>Message to captain (optional)</label>
          <textarea className={styles.textarea} rows={2} value={message} onChange={e => setMessage(e.target.value)} placeholder="Why do you want to join?" />
        </div>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Sending…' : 'Send Request'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Team Detail Modal ─────────────────────────────────
function TeamDetailModal({ team, show, onClose, onJoin, onLeave, myTeamId, user, onRefresh }) {
  const [detail, setDetail] = useState(null)
  const [requests, setRequests] = useState([])
  const [tab, setTab] = useState('members')
  const [saving, setSaving] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({})

  const isCaptain = user && detail?.captain_id === user.id
  const isMember  = user && myTeamId === team?.id

  useEffect(() => {
    if (!show || !team) return
    fetch(`${API}/api/tournaments/teams/${team.id}`)
      .then(r => r.json()).then(setDetail).catch(() => {})
  }, [show, team])

  useEffect(() => {
    if (!isCaptain || tab !== 'requests') return
    fetch(`${API}/api/tournaments/teams/${team.id}/requests`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(rows => setRequests(Array.isArray(rows) ? rows : [])).catch(() => {})
  }, [isCaptain, tab, team])

  async function handleKick(userId) {
    if (!confirm('Remove this member?')) return
    await fetch(`${API}/api/tournaments/teams/${team.id}/kick/${userId}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    })
    setDetail(d => d ? { ...d, members: d.members.filter(m => m.id !== userId) } : d)
  }

  async function handleTransfer(userId) {
    if (!confirm('Transfer captaincy to this player?')) return
    await fetch(`${API}/api/tournaments/teams/${team.id}/transfer/${userId}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    })
    onRefresh(); onClose()
  }

  async function handleRequestAction(reqId, action) {
    await fetch(`${API}/api/tournaments/teams/${team.id}/requests/${reqId}/${action}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    })
    setRequests(r => r.filter(x => x.id !== reqId))
    if (action === 'accept') onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete team "${team.name}"? This cannot be undone.`)) return
    setSaving(true)
    await fetch(`${API}/api/tournaments/teams/${team.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
    })
    setSaving(false); onRefresh(); onClose()
  }

  async function handleSaveEdit() {
    setSaving(true)
    await fetch(`${API}/api/tournaments/teams/${team.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify(editForm),
    })
    setSaving(false); setShowEdit(false); onRefresh()
  }

  if (!detail && !team) return null
  const t = detail || team

  return (
    <Modal show={show} onClose={onClose} title={t.name} size="lg">
      <div className={styles.teamDetail}>
        <div className={styles.teamDetailTop}>
          {t.country && <span className={styles.teamCountry}>🌍 {t.country}</span>}
          <Badge color={t.is_open ? 'green' : 'default'}>{t.is_open ? 'Open' : 'Closed'}</Badge>
          <span className={styles.memberCount}>👥 {t.member_count || detail?.members?.length || 0} / {t.max_members}</span>
          {t.captain_username && <span className={styles.captainLabel}>⚔️ Captain: <strong>{t.captain_username}</strong></span>}
        </div>

        {t.description && <p className={styles.teamDesc}>{t.description}</p>}

        <div className={styles.detailTabs}>
          <button className={[styles.detailTab, tab === 'members' ? styles.detailTabActive : ''].join(' ')} onClick={() => setTab('members')}>Members</button>
          {isCaptain && <button className={[styles.detailTab, tab === 'requests' ? styles.detailTabActive : ''].join(' ')} onClick={() => setTab('requests')}>Join Requests {requests.length > 0 && <span className={styles.reqBadge}>{requests.length}</span>}</button>}
        </div>

        {tab === 'members' && (
          <div className={styles.memberList}>
            {(detail?.members || []).map(m => (
              <div key={m.id} className={styles.memberRow}>
                <div className={styles.memberInfo}>
                  <PlayerName username={m.username} title={m.fide_title || m.platform_title} size="sm" />
                  <span className={styles.memberRating}>{m.rating}</span>
                  {m.role === 'captain' && <Badge color="gold" size="sm">Captain</Badge>}
                </div>
                {isCaptain && m.id !== user?.id && (
                  <div className={styles.memberActions}>
                    <button className={styles.smallBtn} onClick={() => handleTransfer(m.id)}>Make Captain</button>
                    <button className={styles.smallBtnDanger} onClick={() => handleKick(m.id)}>Kick</button>
                  </div>
                )}
              </div>
            ))}
            {!detail?.members?.length && <div className={styles.emptyMsg}>No members yet</div>}
          </div>
        )}

        {tab === 'requests' && (
          <div className={styles.requestList}>
            {requests.length === 0 ? <div className={styles.emptyMsg}>No pending requests</div> :
              requests.map(r => (
                <div key={r.id} className={styles.requestRow}>
                  <div>
                    <PlayerName username={r.username} size="sm" />
                    <span className={styles.memberRating}>{r.rating}</span>
                    {r.message && <p className={styles.reqMessage}>"{r.message}"</p>}
                  </div>
                  <div className={styles.memberActions}>
                    <button className={styles.smallBtn} onClick={() => handleRequestAction(r.id, 'accept')}>Accept</button>
                    <button className={styles.smallBtnDanger} onClick={() => handleRequestAction(r.id, 'decline')}>Decline</button>
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className={styles.detailActions}>
          {!isMember && !isCaptain && user && (
            <Button variant="primary" onClick={() => { onJoin(t); onClose() }}>
              {t.is_open ? 'Join Team' : 'Request to Join'}
            </Button>
          )}
          {isMember && !isCaptain && (
            <Button variant="secondary" onClick={() => { onLeave(t.id); onClose() }}>Leave Team</Button>
          )}
          {isCaptain && (
            <>
              <Button variant="ghost" onClick={() => { setEditForm({ name: t.name, description: t.description, is_open: t.is_open }); setShowEdit(true) }}>Edit</Button>
              <Button variant="danger" onClick={handleDelete} disabled={saving}>Delete Team</Button>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>

      {/* Edit sub-modal */}
      <Modal show={showEdit} onClose={() => setShowEdit(false)} title="Edit Team" size="sm">
        <div className={styles.modalForm}>
          <Input label="Name" value={editForm.name || ''} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
          <div className={styles.formGroup}>
            <label className={styles.label}>Description</label>
            <textarea className={styles.textarea} rows={2} value={editForm.description || ''}
              onChange={e => setEditForm(f => ({...f, description: e.target.value}))} />
          </div>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={editForm.is_open ?? true}
              onChange={e => setEditForm(f => ({...f, is_open: e.target.checked}))} />
            <span>Open team</span>
          </label>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────
export function TeamsPage({ user, onOpenAuth }) {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected] = useState(null)
  const [joinTarget, setJoinTarget] = useState(null)
  const [myTeam, setMyTeam] = useState(null)

  const fetchTeams = useCallback(() => {
    setLoading(true)
    const url = search ? `${API}/api/tournaments/teams?q=${encodeURIComponent(search)}` : `${API}/api/tournaments/teams`
    fetch(url).then(r => r.json())
      .then(data => setTeams(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => { fetchTeams() }, [fetchTeams])

  useEffect(() => {
    if (!user) { setMyTeam(null); return }
    // Find user's team from the list (they can only be in one)
    // We'll detect it after fetch by checking if captain or member
  }, [user, teams])

  async function handleJoin(team) {
    if (!user) { onOpenAuth('register'); return }
    if (!team.is_open) { setJoinTarget(team); return }
    const res = await fetch(`${API}/api/tournaments/teams/${team.id}/join`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}` }
    })
    const data = await res.json()
    if (res.ok) { fetchTeams() }
    else alert(data.error || 'Could not join')
  }

  async function handleLeave(teamId) {
    if (!user) return
    const res = await fetch(`${API}/api/tournaments/teams/${teamId}/leave`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` }
    })
    if (res.ok) { setMyTeam(null); fetchTeams() }
    else { const d = await res.json(); alert(d.error) }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <SectionHeader
          title="Teams"
          subtitle="Play Together"
          action={<Button variant="primary" onClick={() => user ? setShowCreate(true) : onOpenAuth('register')}>+ Create Team</Button>}
        />
        <p className={styles.pageDesc}>Join a team to compete together in team events and climb the rankings.</p>

        <div className={styles.searchBar}>
          <input className={styles.searchInput} placeholder="Search teams…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? <div className={styles.state}>Loading teams…</div>
          : teams.length === 0 ? <div className={styles.state}>No teams found. <button onClick={() => setShowCreate(true)}>Create one!</button></div>
          : (
          <div className={styles.grid}>
            {teams.map(t => (
              <Card key={t.id} className={styles.teamCard} hoverable onClick={() => setSelected(t)}>
                <div className={styles.teamCardTop}>
                  <div className={styles.teamName}>{t.name}</div>
                  <Badge color={t.is_open ? 'green' : 'default'} size="sm">{t.is_open ? 'Open' : 'Closed'}</Badge>
                </div>
                {t.description && <p className={styles.teamDesc}>{t.description}</p>}
                <div className={styles.teamMeta}>
                  <span>👥 {t.member_count} / {t.max_members}</span>
                  {t.country && <span>🌍 {t.country}</span>}
                  <span>⚔️ {t.captain_username}</span>
                </div>
                <div className={styles.teamActions} onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(t)}>View</Button>
                  {user && (
                    <Button variant="primary" size="sm" onClick={() => handleJoin(t)}
                      disabled={parseInt(t.member_count) >= t.max_members}>
                      {t.is_open ? 'Join' : 'Request'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateTeamModal show={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchTeams} />

      <TeamDetailModal
        show={!!selected} team={selected}
        onClose={() => setSelected(null)}
        onJoin={handleJoin} onLeave={handleLeave}
        myTeamId={myTeam?.id} user={user}
        onRefresh={fetchTeams}
      />

      <JoinRequestModal
        show={!!joinTarget} team={joinTarget}
        onClose={() => setJoinTarget(null)}
        onDone={() => { setJoinTarget(null); fetchTeams() }}
      />
    </div>
  )
}
