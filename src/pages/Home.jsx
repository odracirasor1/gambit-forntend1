import { useState, useEffect, useRef } from 'react'
import ChessBoard from '../components/ChessBoard'
import { Button, Card, Badge, SectionHeader, StatBox, Avatar } from '../components/UI'
import PlayerName from '../components/PlayerName'
import styles from './Home.module.css'

const DEMO_MOVES = [
  {from:'e2',to:'e4'},{from:'e7',to:'e5'},{from:'g1',to:'f3'},{from:'b8',to:'c6'},
  {from:'f1',to:'c4'},{from:'f8',to:'c5'},{from:'b1',to:'c3'},{from:'g8',to:'f6'},
  {from:'d2',to:'d3'},{from:'d7',to:'d6'},
]

let chessLib = null
async function getChess() {
  if (!chessLib) { const mod = await import('chess.js'); chessLib = mod.Chess }
  return chessLib
}

const PLAY_MODES = [
  { icon:'⚡', label:'Bullet',     times:'1+0, 2+1',     desc:'Under 3 minutes',      color:'#E74C3C',      page:'play',        tc:'bullet' },
  { icon:'🔥', label:'Blitz',      times:'3+0, 5+0',     desc:'3–5 minutes',          color:'#E67E22',      page:'play',        tc:'blitz' },
  { icon:'⏱', label:'Rapid',      times:'10+0, 15+10',  desc:'10–15 minutes',        color:'var(--green)', page:'play',        tc:'rapid' },
  { icon:'♟', label:'Classical',  times:'30+0',          desc:'30+ minutes',          color:'#2980B9',      page:'play',        tc:'classical' },
  { icon:'🧩', label:'Puzzles',    times:'Rated tactics', desc:'Improve your pattern', color:'#8E44AD',      page:'puzzles',     tc:null },
  { icon:'🏆', label:'Tournament', times:'Daily & Weekly',desc:'Compete for glory',    color:'#D4A843',      page:'tournaments', tc:null },
]

const API = import.meta.env.VITE_API_URL || ''

export default function HomePage({ onNavigate, onOpenAuth, user }) {

  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [lastMove, setLastMove] = useState(null)
  const [lbTab, setLbTab] = useState('blitz')
  const [leaderboard, setLeaderboard] = useState([])
  const [lbLoading, setLbLoading] = useState(true)
  const [heroPlayers, setHeroPlayers] = useState({ white: null, black: null })
  const chessRef = useRef(null)
  const moveIdxRef = useRef(0)

  // Demo board animation
  useEffect(() => {
    let chess
    getChess().then(Chess => { chess = new Chess(); chessRef.current = chess })
    const interval = setInterval(async () => {
      if (!chessRef.current) return
      const c = chessRef.current
      const demo = DEMO_MOVES[moveIdxRef.current % DEMO_MOVES.length]
      const result = c.move({ from: demo.from, to: demo.to })
      if (result) { setFen(c.fen()); setLastMove({ from: demo.from, to: demo.to }); moveIdxRef.current++ }
      if (moveIdxRef.current >= DEMO_MOVES.length) {
        moveIdxRef.current = 0; c.reset(); setFen(c.fen()); setLastMove(null)
      }
    }, 1800)
    return () => clearInterval(interval)
  }, [])

  // Fetch real leaderboard from API
  useEffect(() => {
    setLbLoading(true)
    fetch(`${API}/api/leaderboard?type=${lbTab}&limit=8`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setLeaderboard(list)
        if (list.length >= 2) setHeroPlayers({ white: list[0], black: list[1] })
      })
      .catch(() => setLeaderboard([]))
      .finally(() => setLbLoading(false))
  }, [lbTab])

  return (
    <div className={styles.page}>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroBadge}>
            <span className={styles.heroBadgeDot} />
            Players online now
          </div>
          <h1 className={styles.heroH1}>
            The chess platform<br/>
            <em className={styles.heroAccent}>built for mastery.</em>
          </h1>
          <p className={styles.heroDesc}>
            Play rated games, solve puzzles, compete in tournaments,
            and analyze your games — all in one beautifully crafted platform.
          </p>
          <div className={styles.heroActions}>
            {user ? (
              <Button variant="primary" size="xl" onClick={() => onNavigate('play')}>Play Now</Button>
            ) : (
              <>
                <Button variant="primary" size="xl" onClick={() => onOpenAuth('register')}>Play for Free</Button>
                <Button variant="secondary" size="xl" onClick={() => onOpenAuth('login')}>Log In</Button>
              </>
            )}
          </div>
          <div className={styles.heroStats}>
            <StatBox value="Live" label="Games" />
            <div className={styles.statDivider} />
            <StatBox value="Rated" label="Players" />
            <div className={styles.statDivider} />
            <StatBox value="Free" label="To Play" />
          </div>
        </div>

        <div className={styles.heroRight}>
          <div className={styles.boardDecor}>
            <ChessBoard fen={fen} lastMove={lastMove} size={480} interactive={false} />
            {heroPlayers.white && (
              <div className={styles.boardBadge1}>
                <Avatar username={heroPlayers.white.username} size={28} />
                <div>
                  <div className={styles.boardBadgeName}>
                    <PlayerName username={heroPlayers.white.username} title={heroPlayers.white.fide_title || heroPlayers.white.platform_title} size="sm" />
                  </div>
                  <div className={styles.boardBadgeRating}>{heroPlayers.white.rating} ♟ {lbTab}</div>
                </div>
              </div>
            )}
            {heroPlayers.black && (
              <div className={styles.boardBadge2}>
                <Avatar username={heroPlayers.black.username} size={28} />
                <div>
                  <div className={styles.boardBadgeName}>
                    <PlayerName username={heroPlayers.black.username} title={heroPlayers.black.fide_title || heroPlayers.black.platform_title} size="sm" />
                  </div>
                  <div className={styles.boardBadgeRating}>{heroPlayers.black.rating} ♟ {lbTab}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Play modes ───────────────────────────────────── */}
      <section className={styles.section}>
        <SectionHeader title="Choose Your Game" subtitle="Play modes" />
        <div className={styles.modesGrid}>
          {PLAY_MODES.map(m => (
            <button key={m.label} className={styles.modeCard}
              onClick={() => onNavigate(m.page, m.tc ? { tc: m.tc } : {})}>
              <div className={styles.modeIcon} style={{ '--mode-color': m.color }}>{m.icon}</div>
              <div className={styles.modeLabel}>{m.label}</div>
              <div className={styles.modeTimes}>{m.times}</div>
              <div className={styles.modeDesc}>{m.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Leaderboard ──────────────────────────────────── */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionInner}>
          <div className={styles.lbHeader}>
            <SectionHeader title="Top Players" subtitle="Leaderboard" />
            <div className={styles.lbTabs}>
              {['blitz','rapid','bullet'].map(t => (
                <button key={t}
                  className={[styles.lbTab, lbTab === t ? styles.lbTabActive : ''].join(' ')}
                  onClick={() => setLbTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {lbLoading ? (
            <div className={styles.lbLoading}>Loading…</div>
          ) : leaderboard.length === 0 ? (
            <div className={styles.lbEmpty}>No players yet. Be the first!</div>
          ) : (
            <div className={styles.lbTable}>
              <div className={styles.lbHead}>
                <span>#</span><span>Player</span><span>Rating</span><span>W/D/L</span><span>Games</span>
              </div>
              {leaderboard.map((p, i) => {
                const losses = (p.games_played ?? 0) - (p.games_won ?? 0) - (p.games_drawn ?? 0)
                return (
                  <div key={p.username} className={styles.lbRow}
                    style={{ cursor: 'pointer' }}
                    onClick={() => onNavigate('profile', { username: p.username })}>
                    <span className={[styles.lbRank, i < 3 ? styles[`rank${i}`] : ''].join(' ')}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}
                    </span>
                    <div className={styles.lbPlayer}>
                      <Avatar username={p.username} size={32} />
                      <div>
                        <div className={styles.lbName}>
                          <PlayerName username={p.username} title={p.fide_title || p.platform_title} size="md" />
                        </div>
                        {p.country && <div className={styles.lbCountry}>{p.country}</div>}
                      </div>
                    </div>
                    <div className={styles.lbRating}>{p.rating}</div>
                    <div className={styles.lbRecord}>
                      <span className={styles.recW}>{p.games_won ?? 0}</span>
                      <span className={styles.recD}>{p.games_drawn ?? 0}</span>
                      <span className={styles.recL}>{losses}</span>
                    </div>
                    <div className={styles.lbStreak}>{p.games_played ?? 0}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      {!user && (
        <section className={styles.cta}>
          <div className={styles.ctaInner}>
            <h2 className={styles.ctaTitle}>Ready to start your chess journey?</h2>
            <p className={styles.ctaDesc}>Join players worldwide. It's completely free.</p>
            <div className={styles.ctaActions}>
              <Button variant="primary" size="xl" onClick={() => onOpenAuth('register')}>Create Free Account</Button>
              <Button variant="secondary" size="xl" onClick={() => onNavigate('play')}>Play as Guest</Button>
            </div>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerLogo}>
            <svg viewBox="0 0 24 24" width={22} height={22}>
              <circle cx="12" cy="12" r="11" fill="var(--green)"/>
              <text x="12" y="17" textAnchor="middle" fontSize="13" fill="white" fontFamily="serif">♛</text>
            </svg>
            <span>Gambit Chess</span>
          </div>
          <div className={styles.footerLinks}>
            <button onClick={() => onNavigate('play')}>Play</button>
            <button onClick={() => onNavigate('puzzles')}>Puzzles</button>
            <button onClick={() => onNavigate('tournaments')}>Tournaments</button>
            <button onClick={() => onNavigate('analysis')}>Analysis</button>
          </div>
          <div className={styles.footerCopy}>© 2026 Gambit Chess Platform</div>
        </div>
      </footer>
    </div>
  )
}
