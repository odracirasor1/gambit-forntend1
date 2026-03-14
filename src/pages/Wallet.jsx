// ══════════════════════════════════════════════════════
// WALLET PAGE — credits balance, deposit, withdraw, history
// ══════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Button, Card } from '../components/UI'
import styles from './Wallet.module.css'

const API = import.meta.env.VITE_API_URL || ''

function token() { return localStorage.getItem('gambit_token') }

const TYPE_ICONS = {
  deposit:    '💳',
  withdrawal: '🏦',
  wager:      '⚔️',
  winnings:   '🏆',
  refund:     '↩️',
}

const TYPE_LABELS = {
  deposit:    'Deposit',
  withdrawal: 'Withdrawal',
  wager:      'Wager placed',
  winnings:   'Winnings',
  refund:     'Refund',
}

function TxRow({ tx }) {
  const positive = tx.amount > 0
  return (
    <div className={styles.txRow}>
      <span className={styles.txIcon}>{TYPE_ICONS[tx.type] || '•'}</span>
      <div className={styles.txInfo}>
        <span className={styles.txType}>{TYPE_LABELS[tx.type] || tx.type}</span>
        <span className={styles.txDate}>{new Date(tx.created_at).toLocaleString()}</span>
      </div>
      <div className={styles.txRight}>
        <span className={`${styles.txAmount} ${positive ? styles.txPos : styles.txNeg}`}>
          {positive ? '+' : ''}{tx.amount.toLocaleString()} cr
        </span>
        <span className={styles.txBalance}>{tx.balance.toLocaleString()} cr</span>
      </div>
    </div>
  )
}

function DepositModal({ packages, onDeposit, onClose, loading }) {
  const [selected, setSelected] = useState(null)

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Buy Credits</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <p className={styles.modalSub}>
          100 credits = $1.00 USD · Secure payment via Flutterwave
        </p>
        <div className={styles.packages}>
          {packages.map(p => (
            <button
              key={p.id}
              className={`${styles.packageCard} ${selected === p.id ? styles.packageSelected : ''}`}
              onClick={() => setSelected(p.id)}
            >
              <div className={styles.packageCredits}>{p.credits.toLocaleString()}</div>
              <div className={styles.packageLabel}>{p.label}</div>
              {p.bonus > 0 && <div className={styles.packageBonus}>+{p.bonus} bonus!</div>}
              <div className={styles.packagePrice}>${p.usd.toFixed(2)}</div>
            </button>
          ))}
        </div>
        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!selected || loading}
            onClick={() => onDeposit(selected)}
          >
            {loading ? 'Redirecting…' : 'Pay with Flutterwave →'}
          </Button>
        </div>
        <p className={styles.modalNote}>
          You'll be redirected to Flutterwave's secure checkout. Supports cards, mobile money, and bank transfers.
        </p>
      </div>
    </div>
  )
}

function WithdrawModal({ balance, onWithdraw, onClose, loading }) {
  const [form, setForm] = useState({
    credits: 500,
    accountBank: '',
    accountNumber: '',
    accountName: '',
    currency: 'USD',
  })
  const [error, setError] = useState('')

  const usdValue = (form.credits / 100).toFixed(2)

  function set(field, val) {
    setForm(prev => ({ ...prev, [field]: val }))
    setError('')
  }

  function submit() {
    if (form.credits < 100)      return setError('Minimum withdrawal is 100 credits')
    if (form.credits > balance)  return setError('Insufficient credits')
    if (!form.accountBank)       return setError('Enter bank / mobile money provider')
    if (!form.accountNumber)     return setError('Enter account number')
    if (!form.accountName)       return setError('Enter account name')
    onWithdraw(form)
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Withdraw Credits</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.withdrawForm}>
          <div className={styles.formGroup}>
            <label>Credits to withdraw</label>
            <input
              type="number"
              value={form.credits}
              min={100} max={balance}
              onChange={e => set('credits', parseInt(e.target.value) || 0)}
              className={styles.input}
            />
            <span className={styles.inputHint}>≈ ${usdValue} USD · Balance: {balance.toLocaleString()} cr</span>
          </div>

          <div className={styles.formGroup}>
            <label>Bank / Mobile Money Provider</label>
            <input
              placeholder="e.g. BAI, BFA, Unitel Money"
              value={form.accountBank}
              onChange={e => set('accountBank', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Account Number / Phone Number</label>
            <input
              placeholder="Account or mobile number"
              value={form.accountNumber}
              onChange={e => set('accountNumber', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Account Holder Name</label>
            <input
              placeholder="Full name"
              value={form.accountName}
              onChange={e => set('accountName', e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Currency</label>
            <select
              value={form.currency}
              onChange={e => set('currency', e.target.value)}
              className={styles.select}
            >
              <option value="USD">USD</option>
              <option value="AOA">AOA (Angolan Kwanza)</option>
              <option value="NGN">NGN</option>
              <option value="KES">KES</option>
              <option value="ZAR">ZAR</option>
            </select>
          </div>

          {error && <div className={styles.formError}>{error}</div>}

          <div className={styles.withdrawSummary}>
            <div className={styles.summaryRow}>
              <span>Credits deducted</span>
              <strong>{form.credits.toLocaleString()} cr</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>You receive</span>
              <strong>${usdValue} {form.currency !== 'USD' ? `(${form.currency} equiv.)` : ''}</strong>
            </div>
          </div>
        </div>

        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={loading} onClick={submit}>
            {loading ? 'Processing…' : 'Withdraw'}
          </Button>
        </div>
        <p className={styles.modalNote}>
          Withdrawals are processed within 1–3 business days via Flutterwave.
        </p>
      </div>
    </div>
  )
}

export function WalletPage({ user, onOpenAuth }) {
  const [balance, setBalance]       = useState(0)
  const [packages, setPackages]     = useState([])
  const [history, setHistory]       = useState([])
  const [tab, setTab]               = useState('history')
  const [showDeposit, setShowDeposit]   = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [depositLoading, setDepositLoading]   = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [toast, setToast]           = useState(null)
  const [loading, setLoading]       = useState(true)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchBalance = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`${API}/api/credits/balance`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      const data = await res.json()
      setBalance(data.balance ?? 0)
      setPackages(data.packages ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [user])

  const fetchHistory = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`${API}/api/credits/history`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      const data = await res.json()
      setHistory(data.history ?? [])
    } catch {}
  }, [user])

  useEffect(() => {
    fetchBalance()
    fetchHistory()
  }, [fetchBalance, fetchHistory])

  // Handle payment redirect result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const credits = params.get('credits')
    if (payment === 'success') {
      showToast(`Payment successful! ${credits} credits added to your wallet.`)
      fetchBalance()
      fetchHistory()
      window.history.replaceState({}, '', window.location.pathname)
    } else if (payment === 'failed') {
      showToast('Payment failed or cancelled.', 'error')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function handleDeposit(packageId) {
    setDepositLoading(true)
    try {
      const res = await fetch(`${API}/api/credits/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ packageId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Redirect to Flutterwave checkout
      window.location.href = data.checkoutUrl
    } catch (err) {
      showToast(err.message || 'Deposit failed', 'error')
      setDepositLoading(false)
    }
  }

  async function handleWithdraw(form) {
    setWithdrawLoading(true)
    try {
      const res = await fetch(`${API}/api/credits/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(`Withdrawal of ${form.credits} credits initiated. Processing in 1–3 days.`)
      setShowWithdraw(false)
      fetchBalance()
      fetchHistory()
    } catch (err) {
      showToast(err.message || 'Withdrawal failed', 'error')
    } finally {
      setWithdrawLoading(false)
    }
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.authGate}>
          <div className={styles.authIcon}>💰</div>
          <h2>Sign in to access your wallet</h2>
          <p>Deposit credits, wager on games, and withdraw your winnings.</p>
          <div className={styles.authActions}>
            <Button variant="primary" onClick={() => onOpenAuth('register')}>Create Account</Button>
            <Button variant="secondary" onClick={() => onOpenAuth('login')}>Log In</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {toast && (
          <div className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Wallet</h1>
            <p className={styles.pageDesc}>Manage your credits — deposit, wager, withdraw.</p>
          </div>
        </div>

        {/* Balance card */}
        <div className={styles.balanceCard}>
          <div className={styles.balanceLeft}>
            <div className={styles.balanceLabel}>Available Balance</div>
            {loading ? (
              <div className={styles.balanceSkeleton} />
            ) : (
              <>
                <div className={styles.balanceAmount}>{balance.toLocaleString()}</div>
                <div className={styles.balanceSub}>credits · ≈ ${(balance / 100).toFixed(2)} USD</div>
              </>
            )}
          </div>
          <div className={styles.balanceActions}>
            <Button variant="primary" size="lg" onClick={() => setShowDeposit(true)}>
              + Add Credits
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setShowWithdraw(true)}
              disabled={balance < 100}>
              Withdraw
            </Button>
          </div>
        </div>

        {/* Info strip */}
        <div className={styles.infoStrip}>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>⚔️</span>
            <span>Wager credits on H2H games</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>🏆</span>
            <span>Win up to 2× your stake</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>🏦</span>
            <span>5% house rake on wins</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoIcon}>🌍</span>
            <span>Powered by Flutterwave</span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setTab('history')}>Transaction History</button>
          <button className={`${styles.tab} ${tab === 'withdrawals' ? styles.tabActive : ''}`}
            onClick={() => { setTab('withdrawals') }}>Withdrawals</button>
        </div>

        {/* History */}
        {tab === 'history' && (
          <div className={styles.txList}>
            {history.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📋</div>
                <p>No transactions yet. Add credits to get started.</p>
              </div>
            ) : (
              history.map(tx => <TxRow key={tx.id} tx={tx} />)
            )}
          </div>
        )}

        {/* Withdrawals */}
        {tab === 'withdrawals' && (
          <WithdrawalsList user={user} />
        )}

      </div>

      {showDeposit && (
        <DepositModal
          packages={packages}
          onDeposit={handleDeposit}
          onClose={() => setShowDeposit(false)}
          loading={depositLoading}
        />
      )}

      {showWithdraw && (
        <WithdrawModal
          balance={balance}
          onWithdraw={handleWithdraw}
          onClose={() => setShowWithdraw(false)}
          loading={withdrawLoading}
        />
      )}
    </div>
  )
}

function WithdrawalsList({ user }) {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/credits/withdrawals`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
      .then(r => r.json())
      .then(data => setWithdrawals(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={styles.stateMsg}>Loading…</div>
  if (withdrawals.length === 0) return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>🏦</div>
      <p>No withdrawals yet.</p>
    </div>
  )

  const STATUS_COLOR = { pending: '#f59e0b', processing: '#3b82f6', completed: '#22c55e', failed: '#ef4444' }

  return (
    <div className={styles.txList}>
      {withdrawals.map(w => (
        <div key={w.id} className={styles.txRow}>
          <span className={styles.txIcon}>🏦</span>
          <div className={styles.txInfo}>
            <span className={styles.txType}>Withdrawal · {w.credits.toLocaleString()} cr → ${parseFloat(w.amount_usd).toFixed(2)}</span>
            <span className={styles.txDate}>{new Date(w.created_at).toLocaleString()}</span>
          </div>
          <span className={styles.statusBadge} style={{ color: STATUS_COLOR[w.status] }}>
            {w.status}
          </span>
        </div>
      ))}
    </div>
  )
}
