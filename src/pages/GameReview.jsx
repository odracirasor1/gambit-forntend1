// ══════════════════════════════════════════════════════
// GAME REVIEW PAGE — full PGN + move-by-move replay
// ══════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react'
import { Chess } from 'chess.js'
import ChessBoard from '../components/ChessBoard'
import { Button, Avatar, Badge } from '../components/UI'
import PlayerName from '../components/PlayerName'
import styles from './GameReview.module.css'

const API = import.meta.env.VITE_API_URL || ''

function msToDisplay(ms) {
  if (!ms && ms !== 0) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function GameReviewPage({ gameId, user, onBack }) {
  const [game, setGame]         = useState(null)
  const [positions, setPositions] = useState([]) // [{fen, san, from, to}]
  const [posIdx, setPosIdx]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [flipped, setFlipped]   = useState(false)

  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    fetch(`${API}/api/games/${gameId}`)
      .then(r => { if (!r.ok) throw new Error('Game not found'); return r.json() })
      .then(data => {
        setGame(data)

        // Build position list by replaying moves
        const chess = new Chess()
        const posArr = [{ fen: chess.fen(), san: null, from: null, to: null }]
        for (const m of (data.moves || [])) {
          try {
            const move = chess.move(m.san)
            posArr.push({ fen: chess.fen(), san: move.san, from: move.from, to: move.to, timeSpent: m.time_spent_ms })
          } catch { break }
        }
        setPositions(posArr)
        setPosIdx(posArr.length - 1) // start at final position
        setError(null)

        // Flip if viewing as black
        if (user && data.black === user.username) setFlipped(true)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [gameId, user])

  const goTo    = useCallback((idx) => setPosIdx(Math.max(0, Math.min(positions.length - 1, idx))), [positions.length])
  const goFirst = () => goTo(0)
  const goPrev  = () => goTo(posIdx - 1)
  const goNext  = () => goTo(posIdx + 1)
  const goLast  = () => goTo(positions.length - 1)

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft')  goPrev()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowUp')    goFirst()
      if (e.key === 'ArrowDown')  goLast()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [posIdx, positions.length])

  if (loading) return <div className={styles.state}>Loading game…</div>
  if (error)   return <div className={styles.state}>{error} <Button variant="ghost" size="sm" onClick={onBack}>← Back</Button></div>
  if (!game)   return null

  const cur = positions[posIdx] || positions[0]
  const isWhite = user?.username === game.white
  const isBlack = user?.username === game.black

  // Determine result label from viewer's perspective
  let resultLabel = game.result
  let resultColor = 'default'
  if (game.result === '1-0') {
    if (isWhite) { resultLabel = 'You won'; resultColor = 'green' }
    else if (isBlack) { resultLabel = 'You lost'; resultColor = 'red' }
    else { resultLabel = `${game.white} won` }
  } else if (game.result === '0-1') {
    if (isBlack) { resultLabel = 'You won'; resultColor = 'green' }
    else if (isWhite) { resultLabel = 'You lost'; resultColor = 'red' }
    else { resultLabel = `${game.black} won` }
  } else if (game.result === '1/2-1/2') {
    resultLabel = 'Draw'; resultColor = 'gold'
  }

  const moveCount = positions.length - 1

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={onBack}>← Back</button>
          <div className={styles.headerMeta}>
            <Badge color={resultColor}>{resultLabel}</Badge>
            <span className={styles.metaItem}>{game.time_control}</span>
            <span className={styles.metaItem}>{game.game_type}</span>
            <span className={styles.metaItem}>{moveCount} moves</span>
            {game.ended_at && (
              <span className={styles.metaItem}>
                {new Date(game.ended_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })}
              </span>
            )}
          </div>
          <button className={styles.flipBtn} onClick={() => setFlipped(f => !f)} title="Flip board">⇅</button>
        </div>

        <div className={styles.layout}>

          {/* Board side */}
          <div className={styles.boardSide}>
            {/* Top player */}
            <div className={styles.playerBar}>
              <Avatar username={flipped ? game.white : game.black} size={32} />
              <PlayerName
                username={flipped ? game.white : game.black}
                title={flipped ? (game.white_title || game.white_platform_title) : (game.black_title || game.black_platform_title)}
                size="md"
              />
              <div className={styles.playerRating}>{flipped ? game.white_rating : game.black_rating}</div>
            </div>

            <ChessBoard
              fen={cur?.fen || new Chess().fen()}
              flipped={flipped}
              interactive={false}
              lastMove={cur?.from ? { from: cur.from, to: cur.to } : null}
              size={500}
            />

            {/* Bottom player */}
            <div className={styles.playerBar}>
              <Avatar username={flipped ? game.black : game.white} size={32} />
              <PlayerName
                username={flipped ? game.black : game.white}
                title={flipped ? (game.black_title || game.black_platform_title) : (game.white_title || game.white_platform_title)}
                size="md"
              />
              <div className={styles.playerRating}>{flipped ? game.black_rating : game.white_rating}</div>
            </div>

            {/* Navigation controls */}
            <div className={styles.navControls}>
              <button className={styles.navBtn} onClick={goFirst} disabled={posIdx === 0} title="First move (↑)">⏮</button>
              <button className={styles.navBtn} onClick={goPrev}  disabled={posIdx === 0} title="Previous (←)">◀</button>
              <span className={styles.navPos}>{posIdx} / {moveCount}</span>
              <button className={styles.navBtn} onClick={goNext}  disabled={posIdx >= positions.length - 1} title="Next (→)">▶</button>
              <button className={styles.navBtn} onClick={goLast}  disabled={posIdx >= positions.length - 1} title="Last move (↓)">⏭</button>
            </div>
            <div className={styles.navHint}>Use ← → arrow keys to navigate</div>
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>

            {/* Result card */}
            <div className={styles.resultCard}>
              <div className={styles.resultPlayers}>
                <div className={styles.resultPlayer}>
                  <span className={styles.colorDot} style={{ background: '#f0d9b5' }} />
                  <PlayerName username={game.white} title={game.white_title || game.white_platform_title} size="sm" />
                </div>
                <div className={styles.resultScore}>{game.result}</div>
                <div className={styles.resultPlayer}>
                  <span className={styles.colorDot} style={{ background: '#b58863' }} />
                  <PlayerName username={game.black} title={game.black_title || game.black_platform_title} size="sm" />
                </div>
              </div>
            </div>

            {/* Move list */}
            <div className={styles.moveList}>
              <div className={styles.moveListTitle}>Moves</div>
              <div className={styles.moveListScroll}>
                {positions.length <= 1 ? (
                  <div className={styles.noMoves}>No moves recorded</div>
                ) : (
                  Array.from({ length: Math.ceil(moveCount / 2) }, (_, i) => {
                    const wIdx = i * 2 + 1
                    const bIdx = i * 2 + 2
                    const wPos = positions[wIdx]
                    const bPos = positions[bIdx]
                    return (
                      <div key={i} className={styles.movePair}>
                        <span className={styles.moveNum}>{i + 1}.</span>
                        <button
                          className={[styles.moveSan, posIdx === wIdx ? styles.moveSanActive : ''].join(' ')}
                          onClick={() => goTo(wIdx)}>
                          {wPos?.san}
                        </button>
                        {bPos && (
                          <button
                            className={[styles.moveSan, posIdx === bIdx ? styles.moveSanActive : ''].join(' ')}
                            onClick={() => goTo(bIdx)}>
                            {bPos?.san}
                          </button>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* PGN export */}
            {game.pgn && (
              <div className={styles.pgnSection}>
                <button className={styles.pgnToggle}
                  onClick={() => {
                    navigator.clipboard?.writeText(game.pgn)
                      .then(() => alert('PGN copied to clipboard'))
                      .catch(() => {})
                  }}>
                  📋 Copy PGN
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
