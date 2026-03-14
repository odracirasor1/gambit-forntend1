import { useState, useEffect, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import ChessBoard from '../components/ChessBoard'
import { Button, Badge } from '../components/UI'
import styles from './Puzzles.module.css'

const API = import.meta.env.VITE_API_URL || ''

function findKingInCheck(chess) {
  if (!chess.inCheck()) return null
  const board = chess.board(), turn = chess.turn()
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'k' && p.color === turn) return 'abcdefgh'[c] + (8 - r)
    }
  return null
}

export function PuzzlesPage({ user }) {
  const chessRef = useRef(new Chess())
  const [puzzle, setPuzzle]       = useState(null)
  const [fen, setFen]             = useState('')
  const [legalMoves, setLegalMoves] = useState([])
  const [lastMove, setLastMove]   = useState(null)
  const [moveQueue, setMoveQueue] = useState([])
  const [movesDone, setMovesDone] = useState(0)
  const [feedback, setFeedback]   = useState(null)
  const [flipped, setFlipped]     = useState(false)
  const [inCheck, setInCheck]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  // Session stats
  const [solved, setSolved]       = useState(0)
  const [attempted, setAttempted] = useState(0)
  const [startTime, setStartTime] = useState(null)

  const syncState = useCallback(() => {
    const chess = chessRef.current
    setFen(chess.fen())
    if (!chess.isGameOver()) {
      setLegalMoves(chess.moves({ verbose: true }).map(m => ({ from: m.from, to: m.to })))
    } else {
      setLegalMoves([])
    }
    setInCheck(findKingInCheck(chess))
  }, [])

  const loadPuzzle = useCallback((p) => {
    const chess = new Chess()
    chess.load(p.fen)
    chessRef.current = chess

    const moves = p.moves.trim().split(' ').filter(Boolean)
    setMoveQueue(moves)
    setMovesDone(0)
    setLastMove(null)
    setFeedback(null)
    setPuzzle(p)
    setStartTime(Date.now())

    // Determine player's turn from FEN
    const playerTurn = chess.turn() === 'w' ? 'white' : 'black'
    setFlipped(playerTurn === 'black')

    // If first move belongs to opponent (moves[0] is opponent's), play it first
    // We determine this: the puzzle FEN is set, and the first move in the sequence
    // is what the player should find. So player moves first by default.
    syncState()
  }, [syncState])

  const fetchPuzzle = useCallback(() => {
    setLoading(true)
    setError(null)
    const token = localStorage.getItem('gambit_token')
    const url = user && token
      ? `${API}/api/puzzles`
      : `${API}/api/puzzles/daily`
    const headers = user && token ? { Authorization: `Bearer ${token}` } : {}

    fetch(url, { headers })
      .then(r => { if (!r.ok) throw new Error('No puzzles available'); return r.json() })
      .then(data => loadPuzzle(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [user, loadPuzzle])

  useEffect(() => { fetchPuzzle() }, [fetchPuzzle])

  const submitAttempt = useCallback((puzzleId, solvedBool, timeMs) => {
    const token = localStorage.getItem('gambit_token')
    if (!user || !token) return
    fetch(`${API}/api/puzzles/${puzzleId}/attempt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ solved: solvedBool, timeMs }),
    }).catch(() => {})
  }, [user])

  const handleMove = useCallback((from, to) => {
    if (feedback === 'done') return
    const chess = chessRef.current
    const expected = moveQueue[movesDone]
    if (!expected) return

    const expFrom = expected.slice(0, 2)
    const expTo   = expected.slice(2, 4)
    const expProm = expected.slice(4) || 'q'

    if (from === expFrom && to === expTo) {
      const move = chess.move({ from, to, promotion: expProm })
      if (!move) return
      setLastMove({ from, to })
      setMovesDone(d => d + 1)

      const nextDone = movesDone + 1
      if (nextDone >= moveQueue.length) {
        // Puzzle complete
        syncState()
        setFeedback('done')
        setSolved(s => s + 1)
        setAttempted(a => a + 1)
        setLegalMoves([])
        submitAttempt(puzzle.id, true, Date.now() - startTime)
      } else {
        setFeedback('correct')
        syncState()
        // Play opponent response
        setTimeout(() => {
          const opp = moveQueue[nextDone]
          if (opp) {
            const oppMove = chess.move({
              from: opp.slice(0, 2), to: opp.slice(2, 4),
              promotion: opp.slice(4) || 'q'
            })
            if (oppMove) {
              setLastMove({ from: oppMove.from, to: oppMove.to })
              setMovesDone(nextDone + 1)
              syncState()
              if (nextDone + 1 >= moveQueue.length) {
                setFeedback('done')
                setSolved(s => s + 1)
                setAttempted(a => a + 1)
                setLegalMoves([])
                submitAttempt(puzzle.id, true, Date.now() - startTime)
              } else {
                setFeedback(null)
              }
            }
          }
        }, 500)
      }
    } else {
      setFeedback('wrong')
      setAttempted(a => a + 1)
      submitAttempt(puzzle?.id, false, Date.now() - (startTime || Date.now()))
      setTimeout(() => setFeedback(null), 1200)
    }
  }, [feedback, moveQueue, movesDone, puzzle, startTime, syncState, submitAttempt])

  const playerTurn = puzzle
    ? (chessRef.current.turn() === 'w' ? 'White' : 'Black')
    : '—'

  if (loading) return (
    <div className={styles.page}>
      <div className={styles.loadingState}>Loading puzzle…</div>
    </div>
  )

  if (error) return (
    <div className={styles.page}>
      <div className={styles.errorState}>
        <div>{error}</div>
        {!user && <div className={styles.errorHint}>Sign in to access rated puzzles matched to your level.</div>}
        <Button variant="primary" onClick={fetchPuzzle}>Try Again</Button>
      </div>
    </div>
  )

  if (!puzzle) return null

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.layout}>
          {/* Board */}
          <div className={styles.boardSide}>
            <div className={styles.boardLabel}>
              <span className={styles.turnDot}
                style={{ background: playerTurn === 'White' ? '#F8F5E6' : '#2C2927', border: '1.5px solid #999' }} />
              {playerTurn} to move
            </div>
            <ChessBoard
              fen={fen}
              flipped={flipped}
              interactive={feedback !== 'done'}
              playerColor={playerTurn.toLowerCase()}
              legalMoves={feedback !== 'done' ? legalMoves : []}
              lastMove={lastMove}
              inCheck={inCheck}
              onMove={handleMove}
              size={520}
            />
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>
            <div className={styles.ratingDisplay}>
              <span className={styles.ratingNum}>{puzzle.rating}</span>
              <span className={styles.ratingLabel}>Puzzle Rating</span>
            </div>

            {puzzle.themes?.length > 0 && (
              <div className={styles.themes}>
                {puzzle.themes.map(t => (
                  <Badge key={t} color="green" size="sm">{t}</Badge>
                ))}
              </div>
            )}

            {/* Feedback */}
            {feedback === 'done' && (
              <div className={[styles.feedback, styles.feedbackDone].join(' ')}>
                <span className={styles.feedbackIcon}>✓</span>
                <div>
                  <div className={styles.feedbackTitle}>Puzzle solved!</div>
                  <div className={styles.feedbackSub}>Excellent play</div>
                </div>
              </div>
            )}
            {feedback === 'correct' && (
              <div className={[styles.feedback, styles.feedbackCorrect].join(' ')}>
                <span className={styles.feedbackIcon}>✓</span>
                <div>
                  <div className={styles.feedbackTitle}>Best move!</div>
                  <div className={styles.feedbackSub}>Keep going…</div>
                </div>
              </div>
            )}
            {feedback === 'wrong' && (
              <div className={[styles.feedback, styles.feedbackWrong].join(' ')}>
                <span className={styles.feedbackIcon}>✗</span>
                <div>
                  <div className={styles.feedbackTitle}>Not the best move</div>
                  <div className={styles.feedbackSub}>Try again</div>
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {feedback === 'done' ? (
                <Button variant="primary" fullWidth onClick={fetchPuzzle}>Next Puzzle →</Button>
              ) : (
                <Button variant="secondary" fullWidth onClick={fetchPuzzle}>Skip</Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setFlipped(f => !f)}>Flip Board</Button>
            </div>

            {/* Session stats */}
            <div className={styles.sessionStats}>
              <div className={styles.sessionTitle}>Today's Session</div>
              <div className={styles.sessionRow}>
                <span>Solved</span>
                <strong className={styles.greenVal}>{solved}</strong>
              </div>
              <div className={styles.sessionRow}>
                <span>Attempted</span>
                <strong>{attempted}</strong>
              </div>
              {attempted > 0 && (
                <div className={styles.sessionRow}>
                  <span>Accuracy</span>
                  <strong>{Math.round((solved / attempted) * 100)}%</strong>
                </div>
              )}
              {!user && (
                <div className={styles.sessionNote}>Sign in to save your progress & get rated puzzles</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
