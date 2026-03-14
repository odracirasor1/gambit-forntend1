import { useState } from 'react'
import { Avatar, Button } from './UI'
import { TitleBadge } from './PlayerName'
import styles from './Navbar.module.css'

export default function Navbar({ currentPage, onNavigate, user, onOpenAuth, onLogout, unreadNotifCount = 0, unreadMsgCount = 0 }) {
  const [menuOpen, setMenuOpen] = useState(false)

  const navItems = [
    { id: 'home',        label: 'Home' },
    { id: 'play',        label: 'Play' },
    { id: 'puzzles',     label: 'Puzzles' },
    { id: 'tournaments', label: 'Tournaments' },
    { id: 'teams',       label: 'Teams' },
    { id: 'watch',       label: '👁 Watch' },
    { id: 'analysis',    label: 'Analysis' },
    ...(user?.is_admin ? [{ id: 'admin', label: '🛡 Admin' }] : []),
  ]

  return (
    <header className={styles.nav}>
      <div className={styles.navInner}>
        {/* Logo */}
        <div className={styles.logo} onClick={() => onNavigate('home')}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" fill="#769656"/>
              <text x="16" y="22" textAnchor="middle" fontSize="18" fill="white" fontFamily="serif">♛</text>
            </svg>
          </div>
          <span className={styles.logoText}>Gambit</span>
        </div>

        {/* Nav links */}
        <nav className={styles.links}>
          {navItems.map(item => (
            <button
              key={item.id}
              className={[styles.link, currentPage === item.id ? styles.linkActive : ''].join(' ')}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
              {item.id === 'play' && (
                <span className={styles.liveCount}>
                  <span className={styles.liveDot} />
                  18K
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right actions */}
        <div className={styles.navRight}>
          {user ? (
            <div className={styles.userArea}>
              {/* Messages icon */}
              <button
                className={[styles.iconBtn, currentPage === 'messages' ? styles.iconBtnActive : ''].join(' ')}
                onClick={() => onNavigate('messages')}
                title="Messages"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {unreadMsgCount > 0 && (
                  <span className={styles.badge}>{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>
                )}
              </button>

              {/* Notifications bell */}
              <button
                className={[styles.iconBtn, currentPage === 'notifications' ? styles.iconBtnActive : ''].join(' ')}
                onClick={() => onNavigate('notifications')}
                title="Notifications"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
                {unreadNotifCount > 0 && (
                  <span className={styles.badge}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</span>
                )}
              </button>

              {/* User info */}
              <button className={styles.userBtn} onClick={() => onNavigate('profile')}>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>
                    {(user.fide_title || user.platform_title) && (
                      <TitleBadge title={user.fide_title || user.platform_title} size="sm" />
                    )}
                    {user.username}
                  </span>
                  <span className={styles.userRating}>{user.rating || 1200}</span>
                </div>
                <Avatar username={user.username} size={34} src={user.avatar_url} />
              </button>
              <Button variant="ghost" size="sm" onClick={onLogout}>Log out</Button>
            </div>
          ) : (
            <div className={styles.authBtns}>
              <Button variant="ghost" size="sm" onClick={() => onOpenAuth('login')}>Log In</Button>
              <Button variant="primary" size="sm" onClick={() => onOpenAuth('register')}>Sign Up</Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
