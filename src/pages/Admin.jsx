// ══════════════════════════════════════════════════════
// ADMIN PAGE — platform management dashboard
// ══════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Button, Card, Badge, Modal, Input } from '../components/UI'
import PlayerName from '../components/PlayerName'
import styles from './Admin.module.css'

const API = import.meta.env.VITE_API_URL || ''
const token = () => localStorage.getItem('gambit_token')
const authHeader = () => ({ Authorization: `Bearer ${token()}` })
const jsonHeader = () => ({ 'Content-Type': 'application/json', ...authHeader() })

async function api(path, opts = {}) {
  const res = await fetch(`${API}/api/admin${path}`, opts)
  return { ok: res.ok, data: await res.json(), status: res.status }
}

// ── Stat Card ─────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statValue} style={color ? { color } : {}}>{value ?? '…'}</div>
      <div className={styles.statLabel}>{label}</div>
      {sub && <div className={styles.statSub}>{sub}</div>}
    </div>
  )
}

// ── Edit User Modal ───────────────────────────────────
function EditUserModal({ user, show, onClose, onSaved }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (user) setForm({ username: user.username, email: user.email, rating: user.rating, country: user.country || '', fide_title: user.fide_title || '', avatar_url: user.avatar_url || '' })
  }, [user])

  async function handleSave() {
    setSaving(true); setError('')
    const { ok, data } = await api(`/users/${user.id}`, { method: 'PATCH', headers: jsonHeader(), body: JSON.stringify(form) })
    setSaving(false)
    if (!ok) { setError(data.error || 'Failed'); return }
    onSaved(data); onClose()
  }

  return (
    <Modal show={show} onClose={onClose} title={`Edit ${user?.username}`} size="md">
      <div className={styles.modalForm}>
        {error && <div className={styles.formError}>{error}</div>}
        <Input label="Username" value={form.username || ''} onChange={e => setForm(f => ({...f, username: e.target.value}))} />
        <Input label="Email" value={form.email || ''} onChange={e => setForm(f => ({...f, email: e.target.value}))} />
        <div className={styles.formRow}>
          <Input label="Rating" type="number" value={form.rating || ''} onChange={e => setForm(f => ({...f, rating: +e.target.value}))} />
          <Input label="Country" value={form.country || ''} onChange={e => setForm(f => ({...f, country: e.target.value.toUpperCase()}))} placeholder="AO" />
        </div>
        <Input label="FIDE Title" value={form.fide_title || ''} onChange={e => setForm(f => ({...f, fide_title: e.target.value.toUpperCase()}))} placeholder="GM, IM, FM…" />
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Grant Title Modal ─────────────────────────────────
function GrantTitleModal({ show, onClose, onDone }) {
  const [form, setForm] = useState({ userId: '', title: 'GM', reason: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleGrant() {
    setSaving(true); setError('')
    const { ok, data } = await api('/titles/grant', { method: 'POST', headers: jsonHeader(), body: JSON.stringify(form) })
    setSaving(false)
    if (!ok) { setError(data.error || 'Failed'); return }
    onDone(); onClose()
  }

  return (
    <Modal show={show} onClose={onClose} title="Grant Title" size="sm">
      <div className={styles.modalForm}>
        {error && <div className={styles.formError}>{error}</div>}
        <Input label="User ID" value={form.userId} onChange={e => setForm(f => ({...f, userId: e.target.value}))} placeholder="UUID" />
        <div className={styles.formGroup}>
          <label className={styles.label}>Title</label>
          <select className={styles.select} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}>
            {['GM','IM','FM','CM','WGM','WIM','WFM','WCM','CG','CS'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <Input label="Reason (optional)" value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} />
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleGrant} disabled={saving}>{saving ? 'Granting…' : 'Grant Title'}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Users Section ─────────────────────────────────────
function UsersSection() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const [editUser, setEditUser] = useState(null)
  const [showGrant, setShowGrant] = useState(false)
  const LIMIT = 50

  const fetchUsers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: LIMIT, offset })
    if (search) params.set('q', search)
    if (filter) params.set('filter', filter)
    api(`/users?${params}`).then(({ data }) => {
      setUsers(data.users || []); setTotal(data.total || 0)
    }).finally(() => setLoading(false))
  }, [search, filter, offset])

  useEffect(() => { setOffset(0) }, [search, filter])
  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleBan(u) {
    const reason = prompt(`Ban reason for ${u.username}:`)
    if (reason === null) return
    const { ok, data } = await api(`/users/${u.id}/ban`, { method: 'POST', headers: jsonHeader(), body: JSON.stringify({ reason }) })
    if (ok) fetchUsers(); else alert(data.error)
  }

  async function handleUnban(u) {
    const { ok, data } = await api(`/users/${u.id}/unban`, { method: 'POST', headers: authHeader() })
    if (ok) fetchUsers(); else alert(data.error)
  }

  async function handlePromote(u) {
    if (!confirm(`Make ${u.username} an admin?`)) return
    const { ok, data } = await api(`/users/${u.id}/promote`, { method: 'POST', headers: authHeader() })
    if (ok) fetchUsers(); else alert(data.error)
  }

  async function handleDemote(u) {
    if (!confirm(`Remove admin from ${u.username}?`)) return
    const { ok, data } = await api(`/users/${u.id}/demote`, { method: 'POST', headers: authHeader() })
    if (ok) fetchUsers(); else alert(data.error)
  }

  async function handleDelete(u) {
    if (!confirm(`Permanently delete ${u.username}? This cannot be undone.`)) return
    const { ok, data } = await api(`/users/${u.id}`, { method: 'DELETE', headers: authHeader() })
    if (ok) fetchUsers(); else alert(data.error)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Users <span className={styles.sectionCount}>({total})</span></h2>
        <Button variant="primary" size="sm" onClick={() => setShowGrant(true)}>Grant Title</Button>
      </div>

      <div className={styles.tableControls}>
        <input className={styles.searchInput} placeholder="Search by username or email…" value={search}
          onChange={e => setSearch(e.target.value)} />
        <div className={styles.filterBtns}>
          {[['', 'All'], ['banned', '🚫 Banned'], ['admin', '🛡 Admins'], ['titled', '🏅 Titled']].map(([v, l]) => (
            <button key={v} className={[styles.filterBtn, filter === v ? styles.filterActive : ''].join(' ')}
              onClick={() => setFilter(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th><th>Rating</th><th>Games</th><th>Joined</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className={styles.tableEmpty}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className={styles.tableEmpty}>No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className={u.is_banned ? styles.rowBanned : ''}>
                <td>
                  <PlayerName username={u.username} title={u.fide_title || u.platform_title} size="sm" />
                  <div className={styles.userEmail}>{u.email}</div>
                </td>
                <td>{u.rating}</td>
                <td>{u.games_played}</td>
                <td>{new Date(u.created_at).toLocaleDateString()}</td>
                <td>
                  <div className={styles.statusBadges}>
                    {u.is_admin && <Badge color="gold" size="sm">Admin</Badge>}
                    {u.is_banned && <Badge color="red" size="sm">Banned</Badge>}
                    {!u.is_admin && !u.is_banned && <span className={styles.statusOk}>Active</span>}
                  </div>
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button className={styles.actionBtn} onClick={() => setEditUser(u)}>Edit</button>
                    {u.is_banned
                      ? <button className={styles.actionBtn} onClick={() => handleUnban(u)}>Unban</button>
                      : <button className={styles.actionBtnDanger} onClick={() => handleBan(u)}>Ban</button>
                    }
                    {u.is_admin
                      ? <button className={styles.actionBtn} onClick={() => handleDemote(u)}>Demote</button>
                      : <button className={styles.actionBtn} onClick={() => handlePromote(u)}>Promote</button>
                    }
                    <button className={styles.actionBtnDanger} onClick={() => handleDelete(u)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button className={styles.pageBtn} disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>← Prev</button>
        <span className={styles.pageInfo}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
        <button className={styles.pageBtn} disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}>Next →</button>
      </div>

      <EditUserModal show={!!editUser} user={editUser} onClose={() => setEditUser(null)} onSaved={fetchUsers} />
      <GrantTitleModal show={showGrant} onClose={() => setShowGrant(false)} onDone={fetchUsers} />
    </div>
  )
}

// ── Games Section ─────────────────────────────────────
function GamesSection() {
  const [games, setGames] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const fetchGames = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: LIMIT, offset })
    if (statusFilter) params.set('status', statusFilter)
    api(`/games?${params}`).then(({ data }) => {
      setGames(data.games || []); setTotal(data.total || 0)
    }).finally(() => setLoading(false))
  }, [statusFilter, offset])

  useEffect(() => { setOffset(0) }, [statusFilter])
  useEffect(() => { fetchGames() }, [fetchGames])

  async function handleAbort(id) {
    if (!confirm('Force-abort this game?')) return
    const { ok, data } = await api(`/games/${id}/abort`, { method: 'POST', headers: authHeader() })
    if (ok) fetchGames(); else alert(data.error)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this game record?')) return
    const { ok, data } = await api(`/games/${id}`, { method: 'DELETE', headers: authHeader() })
    if (ok) fetchGames(); else alert(data.error)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Games <span className={styles.sectionCount}>({total})</span></h2>
      </div>
      <div className={styles.tableControls}>
        <div className={styles.filterBtns}>
          {[['', 'All'], ['active', '⚡ Live'], ['finished', '✓ Finished'], ['aborted', 'Aborted']].map(([v, l]) => (
            <button key={v} className={[styles.filterBtn, statusFilter === v ? styles.filterActive : ''].join(' ')}
              onClick={() => setStatusFilter(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>White</th><th>Black</th><th>Type</th><th>Result</th><th>Moves</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className={styles.tableEmpty}>Loading…</td></tr>
              : games.length === 0 ? <tr><td colSpan={7} className={styles.tableEmpty}>No games found</td></tr>
              : games.map(g => (
                <tr key={g.id}>
                  <td><PlayerName username={g.white} size="sm" /></td>
                  <td><PlayerName username={g.black} size="sm" /></td>
                  <td><span className={styles.monoText}>{g.time_control}</span></td>
                  <td>{g.result || <Badge color={g.status === 'active' ? 'green' : 'default'} size="sm" dot={g.status === 'active'}>{g.status}</Badge>}</td>
                  <td>{g.move_count ?? '—'}</td>
                  <td>{g.created_at ? new Date(g.created_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className={styles.rowActions}>
                      {g.status === 'active' && <button className={styles.actionBtnDanger} onClick={() => handleAbort(g.id)}>Abort</button>}
                      {g.status !== 'active' && <button className={styles.actionBtnDanger} onClick={() => handleDelete(g.id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pagination}>
        <button className={styles.pageBtn} disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>← Prev</button>
        <span className={styles.pageInfo}>{offset + 1}–{Math.min(offset + LIMIT, total)} of {total}</span>
        <button className={styles.pageBtn} disabled={offset + LIMIT >= total} onClick={() => setOffset(o => o + LIMIT)}>Next →</button>
      </div>
    </div>
  )
}

// ── Tournaments Section ───────────────────────────────
function TournamentsSection() {
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const fetch_ = useCallback(() => {
    setLoading(true)
    const params = statusFilter ? `?status=${statusFilter}` : ''
    api(`/tournaments${params}`).then(({ data }) => setTournaments(Array.isArray(data) ? data : [])).finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { fetch_() }, [fetch_])

  async function handleCancel(id) {
    if (!confirm('Cancel this tournament?')) return
    const { ok, data } = await api(`/tournaments/${id}/cancel`, { method: 'POST', headers: authHeader() })
    if (ok) fetch_(); else alert(data.error)
  }

  async function handleForceStart(id) {
    if (!confirm('Force-start this tournament now?')) return
    const { ok, data } = await api(`/tournaments/${id}/start`, { method: 'POST', headers: authHeader() })
    if (ok) { alert('Tournament started!'); fetch_() } else alert(data.error)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this tournament?')) return
    const { ok, data } = await api(`/tournaments/${id}`, { method: 'DELETE', headers: authHeader() })
    if (ok) fetch_(); else alert(data.error)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Tournaments <span className={styles.sectionCount}>({tournaments.length})</span></h2>
      </div>
      <div className={styles.tableControls}>
        <div className={styles.filterBtns}>
          {[['', 'All'], ['upcoming', 'Upcoming'], ['active', '⚡ Live'], ['finished', '✓ Finished']].map(([v, l]) => (
            <button key={v} className={[styles.filterBtn, statusFilter === v ? styles.filterActive : ''].join(' ')}
              onClick={() => setStatusFilter(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Format</th><th>Players</th><th>Status</th><th>Starts</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className={styles.tableEmpty}>Loading…</td></tr>
              : tournaments.length === 0 ? <tr><td colSpan={6} className={styles.tableEmpty}>No tournaments</td></tr>
              : tournaments.map(t => (
                <tr key={t.id}>
                  <td>{t.name}{t.is_private && ' 🔒'}</td>
                  <td><span className={styles.monoText}>{t.format?.replace('_', ' ')}</span></td>
                  <td>{t.player_count} / {t.max_players}</td>
                  <td><Badge color={t.status === 'active' ? 'green' : t.status === 'upcoming' ? 'gold' : 'default'} size="sm">{t.status}</Badge></td>
                  <td>{new Date(t.starts_at).toLocaleDateString()}</td>
                  <td>
                    <div className={styles.rowActions}>
                      {t.status === 'upcoming' && <button className={styles.actionBtn} onClick={() => handleForceStart(t.id)}>Force Start</button>}
                      {t.status !== 'finished' && <button className={styles.actionBtnDanger} onClick={() => handleCancel(t.id)}>Cancel</button>}
                      {t.status !== 'active' && <button className={styles.actionBtnDanger} onClick={() => handleDelete(t.id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Teams Section ─────────────────────────────────────
function TeamsSection() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetch_ = useCallback(() => {
    setLoading(true)
    const params = search ? `?q=${encodeURIComponent(search)}` : ''
    api(`/teams${params}`).then(({ data }) => setTeams(Array.isArray(data) ? data : [])).finally(() => setLoading(false))
  }, [search])

  useEffect(() => { fetch_() }, [fetch_])

  async function handleDelete(id, name) {
    if (!confirm(`Delete team "${name}"?`)) return
    const { ok, data } = await api(`/teams/${id}`, { method: 'DELETE', headers: authHeader() })
    if (ok) fetch_(); else alert(data.error)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Teams <span className={styles.sectionCount}>({teams.length})</span></h2>
      </div>
      <div className={styles.tableControls}>
        <input className={styles.searchInput} placeholder="Search teams…" value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Name</th><th>Captain</th><th>Members</th><th>Country</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className={styles.tableEmpty}>Loading…</td></tr>
              : teams.length === 0 ? <tr><td colSpan={6} className={styles.tableEmpty}>No teams</td></tr>
              : teams.map(t => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.captain_username}</td>
                  <td>{t.member_count} / {t.max_members}</td>
                  <td>{t.country || '—'}</td>
                  <td><Badge color={t.is_open ? 'green' : 'default'} size="sm">{t.is_open ? 'Open' : 'Closed'}</Badge></td>
                  <td>
                    <div className={styles.rowActions}>
                      <button className={styles.actionBtnDanger} onClick={() => handleDelete(t.id, t.name)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Titles Section ────────────────────────────────────
function TitlesSection() {
  const [grants, setGrants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGrant, setShowGrant] = useState(false)

  const fetch_ = useCallback(() => {
    setLoading(true)
    api('/titles').then(({ data }) => setGrants(Array.isArray(data) ? data : [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetch_() }, [fetch_])

  async function handleRevoke(userId, username) {
    const reason = prompt(`Reason for revoking title from ${username}:`)
    if (reason === null) return
    const { ok, data } = await api('/titles/revoke', { method: 'POST', headers: jsonHeader(), body: JSON.stringify({ userId, reason }) })
    if (ok) fetch_(); else alert(data.error)
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Title Grants</h2>
        <Button variant="primary" size="sm" onClick={() => setShowGrant(true)}>Grant Title</Button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Player</th><th>Title</th><th>Action</th><th>By</th><th>Reason</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className={styles.tableEmpty}>Loading…</td></tr>
              : grants.length === 0 ? <tr><td colSpan={7} className={styles.tableEmpty}>No title grants</td></tr>
              : grants.map(g => (
                <tr key={g.id}>
                  <td><PlayerName username={g.target_username} title={g.action === 'grant' ? g.title : null} size="sm" /></td>
                  <td><Badge color={['CG','CS'].includes(g.title) ? 'gold' : 'default'} size="sm">{g.title}</Badge></td>
                  <td><Badge color={g.action === 'grant' ? 'green' : 'red'} size="sm">{g.action}</Badge></td>
                  <td>{g.admin_username || 'System'}</td>
                  <td className={styles.reasonCell}>{g.reason || '—'}</td>
                  <td>{new Date(g.created_at).toLocaleDateString()}</td>
                  <td>
                    {g.action === 'grant' && (
                      <button className={styles.actionBtnDanger} onClick={() => handleRevoke(g.user_id, g.target_username)}>Revoke</button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <GrantTitleModal show={showGrant} onClose={() => setShowGrant(false)} onDone={fetch_} />
    </div>
  )
}

// ── Audit Log Section ─────────────────────────────────
function AuditSection() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const LIMIT = 50

  const fetch_ = useCallback(() => {
    setLoading(true)
    api(`/audit?limit=${LIMIT}&offset=${offset}`).then(({ data }) => setLogs(Array.isArray(data) ? data : [])).finally(() => setLoading(false))
  }, [offset])

  useEffect(() => { fetch_() }, [fetch_])

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Audit Log</h2>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Admin</th><th>Action</th><th>Target</th><th>Date</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className={styles.tableEmpty}>Loading…</td></tr>
              : logs.length === 0 ? <tr><td colSpan={4} className={styles.tableEmpty}>No log entries</td></tr>
              : logs.map(l => (
                <tr key={l.id}>
                  <td>{l.admin_username}</td>
                  <td><span className={styles.monoText}>{l.action}</span></td>
                  <td className={styles.reasonCell}>{l.target_type}{l.target_id ? ` · ${l.target_id.slice(0, 8)}…` : ''}</td>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className={styles.pagination}>
        <button className={styles.pageBtn} disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - LIMIT))}>← Prev</button>
        <button className={styles.pageBtn} disabled={logs.length < LIMIT} onClick={() => setOffset(o => o + LIMIT)}>Next →</button>
      </div>
    </div>
  )
}

// ── Main Admin Page ───────────────────────────────────
export function AdminPage({ user }) {
  const [stats, setStats] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    api('/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [])

  if (!user?.is_admin) {
    return (
      <div className={styles.denied}>
        <div className={styles.deniedIcon}>🚫</div>
        <div className={styles.deniedText}>Admin access required</div>
      </div>
    )
  }

  const TABS = [
    { id: 'overview',     label: '📊 Overview' },
    { id: 'users',        label: '👥 Users' },
    { id: 'games',        label: '♟ Games' },
    { id: 'tournaments',  label: '🏆 Tournaments' },
    { id: 'teams',        label: '⚔️ Teams' },
    { id: 'titles',       label: '🏅 Titles' },
    { id: 'audit',        label: '📋 Audit' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Admin Panel</div>
        {TABS.map(t => (
          <button key={t.id}
            className={[styles.sidebarItem, activeTab === t.id ? styles.sidebarItemActive : ''].join(' ')}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.main}>
        {activeTab === 'overview' && (
          <div className={styles.overview}>
            <h2 className={styles.overviewTitle}>Platform Overview</h2>
            <div className={styles.statsGrid}>
              <StatCard label="Total Users" value={stats?.users?.total} sub={`+${stats?.users?.new_this_week || 0} this week`} color="var(--green)" />
              <StatCard label="Banned" value={stats?.users?.banned} />
              <StatCard label="Admins" value={stats?.users?.admins} />
              <StatCard label="Live Games" value={stats?.games?.live} color="#e74c3c" />
              <StatCard label="Games (24h)" value={stats?.games?.last_24h} />
              <StatCard label="Total Games" value={stats?.games?.total} />
              <StatCard label="Active Tournaments" value={stats?.tournaments?.active} color="var(--green)" />
              <StatCard label="Upcoming" value={stats?.tournaments?.upcoming} />
              <StatCard label="Teams" value={stats?.teams?.total} />
            </div>
          </div>
        )}
        {activeTab === 'users'       && <UsersSection />}
        {activeTab === 'games'       && <GamesSection />}
        {activeTab === 'tournaments' && <TournamentsSection />}
        {activeTab === 'teams'       && <TeamsSection />}
        {activeTab === 'titles'      && <TitlesSection />}
        {activeTab === 'audit'       && <AuditSection />}
      </div>

      {/* Shared modals */}
    </div>
  )
}
