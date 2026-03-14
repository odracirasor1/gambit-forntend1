// ══════════════════════════════════════════════════════
// NOTIFICATIONS PAGE — inbox, mark read, delete
// ══════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Button } from '../components/UI'
import styles from './Notifications.module.css'

const API = import.meta.env.VITE_API_URL || ''
const token = () => localStorage.getItem('gambit_token')

const TYPE_ICONS = {
  game_over:       '♟',
  game_challenge:  '⚔️',
  tournament_start:'🏆',
  tournament_join: '🏅',
  puzzle_solved:   '🧩',
  title_granted:   '🎖',
  follow:          '👤',
  message:         '✉️',
  system:          '📢',
}

function NotifRow({ notif, onRead, onDelete }) {
  const icon = TYPE_ICONS[notif.type] || '🔔'
  const date = new Date(notif.created_at).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className={`${styles.row} ${!notif.is_read ? styles.rowUnread : ''}`}>
      <div className={styles.rowIcon}>{icon}</div>
      <div className={styles.rowBody}>
        <div className={styles.rowTitle}>{notif.title}</div>
        {notif.body && <div className={styles.rowDesc}>{notif.body}</div>}
        <div className={styles.rowDate}>{date}</div>
      </div>
      <div className={styles.rowActions}>
        {!notif.is_read && (
          <button className={styles.actionBtn} onClick={() => onRead(notif.id)} title="Mark read">✓</button>
        )}
        <button className={styles.actionBtn} onClick={() => onDelete(notif.id)} title="Delete">✕</button>
      </div>
    </div>
  )
}

export function NotificationsPage({ user, onOpenAuth }) {
  const [notifs, setNotifs]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const fetch_ = useCallback(() => {
    if (!user) return
    setLoading(true)
    const url = `${API}/api/notifications${unreadOnly ? '?unread=true' : ''}`
    fetch(url, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(data => setNotifs(Array.isArray(data.notifications) ? data.notifications : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user, unreadOnly])

  useEffect(() => { fetch_() }, [fetch_])

  async function markRead(id) {
    await fetch(`${API}/api/notifications/${id}/read`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token()}` },
    })
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    await fetch(`${API}/api/notifications/read-all`, {
      method: 'PUT', headers: { Authorization: `Bearer ${token()}` },
    })
    setNotifs(ns => ns.map(n => ({ ...n, is_read: true })))
  }

  async function deleteNotif(id) {
    await fetch(`${API}/api/notifications/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    })
    setNotifs(ns => ns.filter(n => n.id !== id))
  }

  async function clearAll() {
    await fetch(`${API}/api/notifications`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
    })
    setNotifs([])
  }

  if (!user) return (
    <div className={styles.gate}>
      <div className={styles.gateIcon}>🔔</div>
      <h2>Sign in to see notifications</h2>
      <Button variant="primary" onClick={() => onOpenAuth('login')}>Log In</Button>
    </div>
  )

  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Notifications</h1>
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>{unreadCount} unread</span>
            )}
          </div>
          <div className={styles.headerActions}>
            <label className={styles.filterToggle}>
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={e => setUnreadOnly(e.target.checked)}
              />
              Unread only
            </label>
            {unreadCount > 0 && (
              <Button variant="secondary" size="sm" onClick={markAllRead}>Mark all read</Button>
            )}
            {notifs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className={styles.state}>Loading…</div>
        ) : notifs.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔔</div>
            <p>{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</p>
          </div>
        ) : (
          <div className={styles.list}>
            {notifs.map(n => (
              <NotifRow key={n.id} notif={n} onRead={markRead} onDelete={deleteNotif} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
