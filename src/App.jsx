import { useState, useEffect, useRef, useCallback } from 'react'
import Navbar from './components/Navbar'
import AuthModal from './components/AuthModal'
import { ToastProvider, useToast } from './components/Toast'
import HomePage from './pages/Home'
import PlayPage from './pages/Play'
import { TournamentsPage } from './pages/Tournaments'
import { TeamsPage }          from './pages/Teams'
import { AdminPage }          from './pages/Admin'
import { PuzzlesPage }        from './pages/Puzzles'
import { AnalysisPage }       from './pages/Analysis'
import { WatchPage }          from './pages/Watch'
import { ProfilePage }        from './pages/Profile'
import { GameReviewPage }     from './pages/GameReview'
import { NotificationsPage }  from './pages/Notifications'
import { MessagesPage }       from './pages/Messages'
import ChallengeInbox         from './components/ChallengeInbox'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws'
const API     = import.meta.env.VITE_API_URL || ''

function AppInner() {
  const toast = useToast()

  // Auth state
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('gambit_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('gambit_token') || null)

  // Routing
  const [page, setPage]                   = useState('home')
  const [profileTarget, setProfileTarget] = useState(null)
  const [reviewGameId, setReviewGameId]   = useState(null)
  const [messageTarget, setMessageTarget] = useState(null)

  // Auth modal
  const [authShow, setAuthShow] = useState(false)
  const [authTab, setAuthTab]   = useState('login')

  // Notification + message badge counts
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [unreadMsgCount,   setUnreadMsgCount]   = useState(0)
  const [newChallenge,     setNewChallenge]     = useState(null) // latest incoming challenge push

  useEffect(() => {
    if (!token) { setUnreadNotifCount(0); setUnreadMsgCount(0); return }
    const headers = { Authorization: `Bearer ${token}` }
    fetch(`${API}/api/notifications/unread-count`, { headers })
      .then(r => r.json()).then(d => setUnreadNotifCount(d.count ?? 0)).catch(() => {})
    fetch(`${API}/api/messages`, { headers })
      .then(r => r.json()).then(d => {
        const convs = Array.isArray(d.conversations) ? d.conversations : []
        setUnreadMsgCount(convs.reduce((s, c) => s + (c.unread_count || 0), 0))
      }).catch(() => {})
  }, [token])

  // WebSocket
  const wsRef = useRef(null)

  const connectWs = useCallback((t) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (!t) return
    const ws = new WebSocket(`${WS_URL}?token=${t}`)
    ws.onopen  = () => { wsRef.current = ws }
    ws.onclose = () => { wsRef.current = null; if (t) setTimeout(() => connectWs(t), 3000) }
    ws.onerror = () => {}
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)

        if (msg.type === 'session_replaced') {
          ws.close()
          toast?.('You connected from another tab. This session is now inactive.', 'warning')
        }
        if (msg.type === 'title_granted') {
          setUser(prev => {
            if (!prev) return prev
            const updated = { ...prev, platform_title: msg.title }
            localStorage.setItem('gambit_user', JSON.stringify(updated))
            return updated
          })
          const label = msg.title === 'CS' ? 'Chess SuperGrandmaster' : 'Chessle Grandmaster'
          toast?.(`🏆 You've been awarded the ${label} (${msg.title}) title!`, 'success')
        }
        if (msg.type === 'notification') {
          setUnreadNotifCount(c => c + 1)
          toast?.(msg.title || 'New notification', 'info')
        }
        if (msg.type === 'message') {
          setUnreadMsgCount(c => c + 1)
          toast?.(`💬 Message from ${msg.from_username || 'someone'}`, 'info')
        }
        if (msg.type === 'game-challenge') {
          setNewChallenge({ id: msg.challengeId, username: msg.username })
        }
        if (msg.type === 'challenge-accepted') {
          toast?.(`✓ ${msg.username} accepted your challenge! Starting game…`, 'success')
        }
      } catch {}
    }
    wsRef.current = ws
  }, [toast])

  useEffect(() => {
    if (token) connectWs(token)
  }, [token, connectWs])

  const wsSend = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      toast?.('Not connected to server', 'error')
    }
  }, [toast])

  const handleAuthSuccess = (t, u) => {
    setToken(t); setUser(u)
    localStorage.setItem('gambit_token', t)
    localStorage.setItem('gambit_user', JSON.stringify(u))
    connectWs(t)
    toast?.(`Welcome, ${u.username}!`, 'success')
  }

  const handleLogout = () => {
    setToken(null); setUser(null)
    localStorage.removeItem('gambit_token')
    localStorage.removeItem('gambit_user')
    wsRef.current?.close(); wsRef.current = null
    setUnreadNotifCount(0); setUnreadMsgCount(0)
    toast?.('Logged out', 'info')
    setPage('home')
  }

  const openAuth = (tab = 'login') => { setAuthTab(tab); setAuthShow(true) }

  const navigate = (p, opts = {}) => {
    if (p === 'profile' && opts.username) setProfileTarget(opts.username)
    else if (p === 'profile')             setProfileTarget(null)
    if (p === 'game_review' && opts.gameId) setReviewGameId(opts.gameId)
    if (p === 'messages' && opts.username) setMessageTarget(opts.username)
    else if (p === 'messages')             setMessageTarget(null)
    if (p === 'notifications') setUnreadNotifCount(0)
    if (p === 'messages')      setUnreadMsgCount(0)
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div>
      <Navbar
        currentPage={page}
        onNavigate={navigate}
        user={user}
        onOpenAuth={openAuth}
        onLogout={handleLogout}
        unreadNotifCount={unreadNotifCount}
        unreadMsgCount={unreadMsgCount}
      />

      {page === 'home'          && <HomePage onNavigate={navigate} onOpenAuth={openAuth} user={user} />}
      {page === 'play'          && <PlayPage user={user} onOpenAuth={openAuth} wsConn={wsRef.current} onWsSend={wsSend} />}
      {page === 'tournaments'   && <TournamentsPage user={user} onOpenAuth={openAuth} />}
      {page === 'teams'         && <TeamsPage user={user} onOpenAuth={openAuth} />}
      {page === 'puzzles'       && <PuzzlesPage user={user} />}
      {page === 'analysis'      && <AnalysisPage />}
      {page === 'watch'         && <WatchPage onOpenAuth={openAuth} />}
      {page === 'profile'       && (
        <ProfilePage user={user} targetUsername={profileTarget} onNavigate={navigate} onOpenAuth={openAuth} />
      )}
      {page === 'game_review'   && (
        <GameReviewPage gameId={reviewGameId} user={user} onBack={() => navigate('profile')} />
      )}
      {page === 'notifications' && <NotificationsPage user={user} onOpenAuth={openAuth} />}
      {page === 'messages'      && <MessagesPage user={user} onOpenAuth={openAuth} initialUsername={messageTarget} />}
      {page === 'learn'         && (
        <div style={{ paddingTop: 80, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'serif', fontSize: 24 }}>
          Learn — Coming Soon
        </div>
      )}
      {page === 'admin' && <AdminPage user={user} />}

      <AuthModal show={authShow} onClose={() => setAuthShow(false)} onSuccess={handleAuthSuccess} initialTab={authTab} />

      <ChallengeInbox
        user={user}
        newChallenge={newChallenge}
        onNavigate={navigate}
      />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
