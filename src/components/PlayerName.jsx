/**
 * PlayerName — renders a FIDE or platform title badge next to a username.
 *
 * Usage:
 *   <PlayerName username="Magnus" title="GM" />
 *   <PlayerName username="Anna"   title="WIM" size="sm" />
 *   <PlayerName username="Elite"  title="CG"  size="md" />   ← Chessle Grandmaster
 *   <PlayerName username="Best"   title="CS"  size="md" />   ← Chess SuperGrandmaster
 *   <PlayerName username="Guest" />                          ← no badge
 */
import styles from './PlayerName.module.css'

// FIDE titles — lichess-convention gold/purple
const FIDE_COLORS = {
  GM:  { bg: '#e4c45a', text: '#1a1000' },
  IM:  { bg: '#e4c45a', text: '#1a1000' },
  FM:  { bg: '#e4c45a', text: '#1a1000' },
  CM:  { bg: '#e4c45a', text: '#1a1000' },
  WGM: { bg: '#d4a0d4', text: '#1a001a' },
  WIM: { bg: '#d4a0d4', text: '#1a001a' },
  WFM: { bg: '#d4a0d4', text: '#1a001a' },
  WCM: { bg: '#d4a0d4', text: '#1a001a' },
}

// Platform titles — distinct from FIDE, cannot be mistaken
// CG: rich amber-orange  CS: animated purple-gold gradient
const PLATFORM_TITLE_META = {
  CG: {
    bg: '#f5a623', text: '#1a0800',
    title: 'Chessle Grandmaster — Gambit Platform',
    animated: false,
  },
  CS: {
    bg: null,  // handled by CSS gradient animation
    text: '#fff',
    title: 'Chess SuperGrandmaster — Gambit Platform (Highest Title)',
    animated: true,
  },
}

export function TitleBadge({ title, size = 'md' }) {
  if (!title) return null

  const platform = PLATFORM_TITLE_META[title]
  if (platform) {
    return (
      <span
        className={[
          styles.badge,
          styles[`badge_${size}`],
          styles.platformBadge,
          platform.animated ? styles.platformBadgeCS : styles.platformBadgeCG,
        ].join(' ')}
        style={platform.animated ? undefined : { background: platform.bg, color: platform.text }}
        title={platform.title}
      >
        {title}
      </span>
    )
  }

  const colors = FIDE_COLORS[title] || { bg: '#aaa', text: '#000' }
  return (
    <span
      className={`${styles.badge} ${styles[`badge_${size}`]}`}
      style={{ background: colors.bg, color: colors.text }}
      title={`FIDE ${title}`}
    >
      {title}
    </span>
  )
}

export default function PlayerName({ username, title, size = 'md', className = '' }) {
  return (
    <span className={`${styles.root} ${styles[`root_${size}`]} ${className}`}>
      <TitleBadge title={title} size={size} />
      <span className={styles.username}>{username}</span>
    </span>
  )
}
