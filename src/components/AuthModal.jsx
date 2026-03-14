import { useState } from 'react'
import { Modal, Input, Button, Divider } from './UI'
import styles from './AuthModal.module.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export default function AuthModal({ show, onClose, onSuccess, initialTab = 'login' }) {
  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Login
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register
  const [username, setUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')

  const switchTab = (t) => { setTab(t); setError('') }

  const doLogin = async () => {
    setError(''); setLoading(true)
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Login failed')
      onSuccess(data.token, data.user)
      onClose()
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const doRegister = async () => {
    setError(''); setLoading(true)
    try {
      const r = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email: regEmail, password: regPass }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Registration failed')
      onSuccess(data.token, data.user)
      onClose()
    } catch(e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal show={show} onClose={onClose} size="sm">
      <div className={styles.wrap}>
        {/* Logo + title */}
        <div className={styles.logoArea}>
          <svg viewBox="0 0 32 32" width={40} height={40}>
            <circle cx="16" cy="16" r="15" fill="var(--green)"/>
            <text x="16" y="22" textAnchor="middle" fontSize="18" fill="white" fontFamily="serif">♛</text>
          </svg>
          <div>
            <div className={styles.title}>
              {tab === 'login' ? 'Welcome back' : 'Join Gambit'}
            </div>
            <div className={styles.sub}>
              {tab === 'login' ? 'Sign in to your account' : 'Create your free account'}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={[styles.tab, tab==='login'?styles.tabActive:''].join(' ')} onClick={() => switchTab('login')}>Log In</button>
          <button className={[styles.tab, tab==='register'?styles.tabActive:''].join(' ')} onClick={() => switchTab('register')}>Sign Up</button>
        </div>

        {/* Login form */}
        {tab === 'login' && (
          <div className={styles.form}>
            <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            {error && <div className={styles.error}>{error}</div>}
            <Button variant="primary" size="lg" fullWidth disabled={loading} onClick={doLogin}>
              {loading ? 'Signing in…' : 'Log In'}
            </Button>
            <Divider label="or" />
            <div className={styles.switchLink}>
              Don't have an account?{' '}
              <button onClick={() => switchTab('register')}>Sign up free</button>
            </div>
          </div>
        )}

        {/* Register form */}
        {tab === 'register' && (
          <div className={styles.form}>
            <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} placeholder="magnus_c" autoComplete="username" />
            <Input label="Email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <Input label="Password" type="password" value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
            {error && <div className={styles.error}>{error}</div>}
            <Button variant="primary" size="lg" fullWidth disabled={loading} onClick={doRegister}>
              {loading ? 'Creating account…' : 'Create Free Account'}
            </Button>
            <Divider label="or" />
            <div className={styles.switchLink}>
              Already have an account?{' '}
              <button onClick={() => switchTab('login')}>Log in</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
