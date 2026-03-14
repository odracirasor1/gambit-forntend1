import styles from './UI.module.css'

// ─── Button ────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', size = 'md', disabled, onClick, type = 'button', fullWidth, icon }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={[
        styles.btn,
        styles[`btn-${variant}`],
        styles[`btn-${size}`],
        fullWidth ? styles.fullWidth : '',
        icon ? styles.hasIcon : '',
      ].join(' ')}
    >
      {icon && <span className={styles.btnIcon}>{icon}</span>}
      {children}
    </button>
  )
}

// ─── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '', onClick, hoverable, padding = 'md' }) {
  return (
    <div
      className={[styles.card, styles[`pad-${padding}`], hoverable ? styles.cardHover : '', onClick ? styles.cardClickable : '', className].join(' ')}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// ─── Badge ─────────────────────────────────────────────────────
export function Badge({ children, color = 'default', size = 'sm', dot }) {
  return (
    <span className={[styles.badge, styles[`badge-${color}`], styles[`badge-${size}`]].join(' ')}>
      {dot && <span className={styles.badgeDot} />}
      {children}
    </span>
  )
}

// ─── Input ─────────────────────────────────────────────────────
export function Input({ label, error, hint, type = 'text', ...props }) {
  return (
    <div className={styles.formGroup}>
      {label && <label className={styles.label}>{label}</label>}
      <input type={type} className={[styles.input, error ? styles.inputError : ''].join(' ')} {...props} />
      {error && <span className={styles.fieldError}>{error}</span>}
      {hint && !error && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────
export function Modal({ show, onClose, children, title, size = 'md' }) {
  if (!show) return null
  return (
    <div className={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className={[styles.modal, styles[`modal-${size}`]].join(' ')}>
        {title && (
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>{title}</h2>
            <button className={styles.modalClose} onClick={onClose}>✕</button>
          </div>
        )}
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  )
}

// ─── Avatar ────────────────────────────────────────────────────
export function Avatar({ username = '?', size = 36, src }) {
  const initials = username.slice(0, 2).toUpperCase()
  const hue = username.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div
      className={styles.avatar}
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: src ? 'transparent' : `hsl(${hue},35%,45%)`,
      }}
    >
      {src ? <img src={src} alt={username} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initials}
    </div>
  )
}

// ─── Tabs ──────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className={styles.tabs}>
      {tabs.map(tab => (
        <button
          key={tab.value}
          className={[styles.tab, active === tab.value ? styles.tabActive : ''].join(' ')}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count != null && <span className={styles.tabCount}>{tab.count}</span>}
        </button>
      ))}
    </div>
  )
}

// ─── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 24 }) {
  return (
    <div className={styles.spinner} style={{ width: size, height: size, borderWidth: size * 0.1 }} />
  )
}

// ─── Section header ────────────────────────────────────────────
export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        {subtitle && <div className={styles.sectionEyebrow}>{subtitle}</div>}
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      {action}
    </div>
  )
}

// ─── Divider ───────────────────────────────────────────────────
export function Divider({ label }) {
  return (
    <div className={styles.divider}>
      {label && <span className={styles.dividerLabel}>{label}</span>}
    </div>
  )
}

// ─── Rating Chip ───────────────────────────────────────────────
export function RatingChip({ rating, delta }) {
  return (
    <div className={styles.ratingChip}>
      <span className={styles.ratingVal}>{rating}</span>
      {delta != null && (
        <span className={[styles.ratingDelta, delta >= 0 ? styles.deltaPos : styles.deltaNeg].join(' ')}>
          {delta >= 0 ? '+' : ''}{delta}
        </span>
      )}
    </div>
  )
}

// ─── Stat box ──────────────────────────────────────────────────
export function StatBox({ value, label, sub }) {
  return (
    <div className={styles.statBox}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </div>
  )
}
