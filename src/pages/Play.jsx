import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import ChessBoard from '../components/ChessBoard'
import { Button, Avatar, Spinner } from '../components/UI'
import PlayerName from '../components/PlayerName'
import { useStockfish, LEVEL_NAMES } from '../hooks/useStockfish'
import styles from './Play.module.css'

// ── Constants ────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || ''

const TIME_CONTROLS = [
  { label:'1+0',   cat:'bullet',    ms:60000,    inc:0 },
  { label:'2+1',   cat:'bullet',    ms:120000,   inc:1000 },
  { label:'3+0',   cat:'blitz',     ms:180000,   inc:0 },
  { label:'3+2',   cat:'blitz',     ms:180000,   inc:2000 },
  { label:'5+0',   cat:'blitz',     ms:300000,   inc:0 },
  { label:'5+3',   cat:'blitz',     ms:300000,   inc:3000 },
  { label:'10+0',  cat:'rapid',     ms:600000,   inc:0 },
  { label:'10+5',  cat:'rapid',     ms:600000,   inc:5000 },
  { label:'15+10', cat:'rapid',     ms:900000,   inc:10000 },
  { label:'30+0',  cat:'classical', ms:1800000,  inc:0 },
]
const CAT_COLORS = { bullet:'#E74C3C', blitz:'#E67E22', rapid:'var(--green)', classical:'#2980B9' }

function msToDisplay(ms) {
  if (ms <= 0) return '0:00'
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec < 10 ? '0' : ''}${sec}`
}

function getLevelRating(lvl) {
  return { 1:400, 2:700, 3:1000, 4:1300, 5:1600, 6:1900, 7:2200, 8:2600 }[lvl] || 1200
}

// ── Find king square in check ────────────────────────────────────────────────
function findKingInCheck(chess) {
  if (!chess.inCheck()) return null
  const board = chess.board()
  const turn = chess.turn()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'k' && p.color === turn) {
        return 'abcdefgh'[c] + (8 - r)
      }
    }
  }
  return null
}

// ── Eval Bar ─────────────────────────────────────────────────────────────────
function EvalBar({ evaluation, myColor }) {
  let pct = 50
  if (evaluation) {
    if (evaluation.type === 'mate') {
      pct = evaluation.value > 0 ? 95 : 5
    } else {
      pct = 50 + Math.max(-5, Math.min(5, evaluation.value / 100)) * 9
    }
  }
  const whitePct = myColor === 'white' ? pct : 100 - pct
  const label = evaluation
    ? (evaluation.type === 'mate'
        ? `M${Math.abs(evaluation.value)}`
        : (evaluation.value >= 0 ? '+' : '') + (evaluation.value / 100).toFixed(1))
    : '0.0'
  return (
    <div className={styles.evalBar} title={`Stockfish: ${label}`}>
      <div className={styles.evalWhite} style={{ height: whitePct + '%' }} />
      <div className={styles.evalLabel}>{label}</div>
    </div>
  )
}

// ── Promotion Dialog ──────────────────────────────────────────────────────────
function PromotionDialog({ color, onChoose }) {
  const pieces = ['q', 'r', 'b', 'n']
  const symbols = {
    white: { q:'♕', r:'♖', b:'♗', n:'♘' },
    black: { q:'♛', r:'♜', b:'♝', n:'♞' },
  }
  return (
    <div className={styles.promoOverlay}>
      <div className={styles.promoBox}>
        <div className={styles.promoTitle}>Promote pawn</div>
        <div className={styles.promoPieces}>
          {pieces.map(p => (
            <button key={p} className={styles.promoBtn} onClick={() => onChoose(p)}>
              {symbols[color][p]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Game Status Banner ────────────────────────────────────────────────────────
function StatusBanner({ chess, result, gameMode, myColor, activeClock, fiftyMoveCount }) {
  if (result) return null // result overlay handles this
  if (!chess) return null

  const turn = chess.turn() === 'w' ? 'White' : 'Black'
  const inCheck = chess.inCheck()

  let msg = null
  let cls = styles.statusNeutral

  if (inCheck && !chess.isCheckmate()) {
    msg = `${turn} is in check!`
    cls = styles.statusCheck
  } else if (fiftyMoveCount >= 90) {
    msg = `50-move rule approaching (${Math.floor(fiftyMoveCount/2)} moves)`
    cls = styles.statusWarn
  }

  if (!msg) return null
  return <div className={`${styles.statusBanner} ${cls}`}>{msg}</div>
}

// ── Main Play Page ────────────────────────────────────────────────────────────
export default function PlayPage({ user, onOpenAuth, wsConn, onWsSend }) {
  // Core game state
  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(chessRef.current.fen())
  const [legalMoves, setLegalMoves] = useState([])
  const [lastMove, setLastMove] = useState(null)
  const [inCheck, setInCheck] = useState(null)
  const [moves, setMoves] = useState([])    // SAN history
  const [result, setResult] = useState(null)
  const [fiftyMoveCount, setFiftyMoveCount] = useState(0)

  // Promotion
  const [pendingPromo, setPendingPromo] = useState(null) // { from, to }

  // Game setup
  const [phase, setPhase] = useState('setup') // setup | playing | over | seeking
  const [gameMode, setGameMode] = useState('engine') // engine | local | human
  const [selectedTc, setSelectedTc] = useState('10+0')
  const [engineLevel, setEngineLevel] = useState(4)
  const [engineColor, setEngineColor] = useState('black') // which color engine plays
  const [myColor, setMyColor] = useState('white') // player's color in engine/online mode
  const [flipped, setFlipped] = useState(false)
  const [opponent, setOpponent] = useState(null)
  const [gameId, setGameId] = useState(null)

  // Clocks
  const [whiteTime, setWhiteTime] = useState(600000)
  const [blackTime, setBlackTime] = useState(600000)
  const [activeClock, setActiveClock] = useState(null)
  const clockRef = useRef(null)
  const clockLastTickRef = useRef(null)

  // Seek
  const [seekSeconds, setSeekSeconds] = useState(0)
  const seekTimerRef = useRef(null)

  // Open challenge link
  const [openChallengeSlug, setOpenChallengeSlug] = useState(null)
  const [openChallengeLoading, setOpenChallengeLoading] = useState(false)
  const [openChallengeCopied, setOpenChallengeCopied] = useState(false)

  const { ready: engineReady, thinking: engineThinking, evaluation, getBestMove, stopEngine } = useStockfish()

  // ── Sync chess state to React state ────────────────────────────────────────
  const syncState = useCallback(() => {
    const chess = chessRef.current
    setFen(chess.fen())
    setLegalMoves(chess.moves({ verbose: true }).map(m => ({ from: m.from, to: m.to })))
    setInCheck(findKingInCheck(chess))
    // Parse 50-move half-move clock from FEN
    const fenParts = chess.fen().split(' ')
    setFiftyMoveCount(parseInt(fenParts[4]) || 0)
  }, [])

  // ── Clock tick ──────────────────────────────────────────────────────────────
  const startClock = useCallback(() => {
    clearInterval(clockRef.current)
    clockLastTickRef.current = Date.now()
    clockRef.current = setInterval(() => {
      const now = Date.now()
      const elapsed = now - (clockLastTickRef.current || now)
      clockLastTickRef.current = now

      setActiveClock(turn => {
        if (!turn) return turn
        if (turn === 'white') {
          setWhiteTime(t => {
            const next = Math.max(0, t - elapsed)
            if (next === 0) endGameByTime('white')
            return next
          })
        } else {
          setBlackTime(t => {
            const next = Math.max(0, t - elapsed)
            if (next === 0) endGameByTime('black')
            return next
          })
        }
        return turn
      })
    }, 100)
  }, [])

  function endGameByTime(loser) {
    clearInterval(clockRef.current)
    const res = loser === 'white' ? '0-1' : '1-0'
    setResult({ result: res, reason: 'timeout' })
    setPhase('over')
    setActiveClock(null)
  }

  // ── End game helper ─────────────────────────────────────────────────────────
  const endLocalGame = useCallback((chess) => {
    clearInterval(clockRef.current)
    setActiveClock(null)
    let res = '1/2-1/2', reason = 'draw'
    if (chess.isCheckmate()) {
      res = chess.turn() === 'w' ? '0-1' : '1-0'
      reason = 'checkmate'
    } else if (chess.isStalemate())            { reason = 'stalemate' }
    else if (chess.isThreefoldRepetition())    { reason = 'threefold repetition' }
    else if (chess.isInsufficientMaterial())   { reason = 'insufficient material' }
    else if (chess.isDraw())                   { reason = '50-move rule' }
    setResult({ result: res, reason })
    setPhase('over')
  }, [])

  // ── Check if move is a pawn promotion ──────────────────────────────────────
  function isPromotion(chess, from, to) {
    const piece = chess.get(from)
    if (!piece || piece.type !== 'p') return false
    const toRank = parseInt(to[1])
    return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1)
  }

  // ── Execute a move (with optional promotion) ────────────────────────────────
  const executeMove = useCallback((from, to, promotion = 'q') => {
    const chess = chessRef.current
    const tc = TIME_CONTROLS.find(t => t.label === selectedTc) || TIME_CONTROLS[6]

    const move = chess.move({ from, to, promotion })
    if (!move) return false

    // Apply increment to the side that just moved
    const justMoved = move.color === 'w' ? 'white' : 'black'
    if (tc.inc > 0) {
      if (justMoved === 'white') setWhiteTime(t => t + tc.inc)
      else setBlackTime(t => t + tc.inc)
    }

    setLastMove({ from, to })
    setMoves(prev => [...prev, move.san])

    const nextTurn = chess.turn() === 'w' ? 'white' : 'black'
    setActiveClock(nextTurn)
    clockLastTickRef.current = Date.now()

    syncState()

    if (chess.isGameOver() || chess.isDraw()) {
      endLocalGame(chess)
    }
    return true
  }, [selectedTc, syncState, endLocalGame])

  // ── Board move handler (from ChessBoard click) ──────────────────────────────
  const handleBoardMove = useCallback((from, to) => {
    if (phase !== 'playing') return
    const chess = chessRef.current

    // Check if this is a promotion
    if (isPromotion(chess, from, to)) {
      setPendingPromo({ from, to })
      return
    }

    executeMove(from, to)
  }, [phase, executeMove])

  // ── Online move handler ─────────────────────────────────────────────────────
  const handleOnlineMove = useCallback((from, to) => {
    if (phase !== 'playing') return
    const chess = chessRef.current
    const isMine = (myColor === 'white' && chess.turn() === 'w') ||
                   (myColor === 'black' && chess.turn() === 'b')
    if (!isMine) return

    if (isPromotion(chess, from, to)) {
      setPendingPromo({ from, to })
      return
    }
    if (executeMove(from, to)) {
      onWsSend?.({ type: 'move', gameId, from, to, promotion: 'q' })
    }
  }, [phase, myColor, gameId, onWsSend, executeMove])

  // ── Promotion chosen ────────────────────────────────────────────────────────
  const handlePromotion = useCallback((piece) => {
    if (!pendingPromo) return
    const { from, to } = pendingPromo
    setPendingPromo(null)
    if (gameMode === 'human' && gameId) {
      if (executeMove(from, to, piece)) {
        onWsSend?.({ type: 'move', gameId, from, to, promotion: piece })
      }
    } else {
      executeMove(from, to, piece)
    }
  }, [pendingPromo, gameMode, gameId, onWsSend, executeMove])

  // ── Engine move trigger ─────────────────────────────────────────────────────
  useEffect(() => {
    if (gameMode !== 'engine' || phase !== 'playing' || !engineReady) return
    const chess = chessRef.current
    const isEngineTurn = (engineColor === 'white' && chess.turn() === 'w') ||
                         (engineColor === 'black' && chess.turn() === 'b')
    if (!isEngineTurn || chess.isGameOver()) return

    const currentFen = chess.fen()
    getBestMove(currentFen, engineLevel).then(move => {
      if (!move) return
      // Make sure position hasn't changed
      if (chessRef.current.fen() !== currentFen) return
      executeMove(move.from, move.to, move.promotion || 'q')
    })
  }, [fen, gameMode, phase, engineColor, engineReady, engineLevel, getBestMove, executeMove])

  // ── Reconnect to active game on mount / WS reconnect ───────────────────────
  useEffect(() => {
    if (!user) return
    const token = localStorage.getItem('gambit_token')
    if (!token) return

    fetch(`${API}/api/play/active`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        const active = data.activeGame
        if (!active) return

        // Fetch full game detail to get moves + current FEN
        return fetch(`${API}/api/games/${active.id}`)
          .then(r => r.json())
          .then(game => {
            if (!game || game.status !== 'active') return

            const color = game.white_id === user.id ? 'white' : 'black'

            // Replay all moves onto the chess instance
            const chess = new Chess()
            for (const m of (game.moves || [])) {
              try { chess.move(m.san) } catch { break }
            }
            chessRef.current = chess

            setMyColor(color)
            setFlipped(color === 'black')
            setGameId(game.id)
            setGameMode('human')
            setOpponent({
              username: color === 'white' ? game.black : game.white,
              rating:   color === 'white' ? game.black_rating : game.white_rating,
            })
            setWhiteTime(game.white_time_ms ?? 600000)
            setBlackTime(game.black_time_ms ?? 600000)
            setActiveClock(chess.turn() === 'w' ? 'white' : 'black')
            setMoves(game.moves?.map(m => m.san) ?? [])
            setResult(null)
            setLastMove(game.moves?.length > 0
              ? { from: game.moves.at(-1).uci.slice(0, 2), to: game.moves.at(-1).uci.slice(2, 4) }
              : null)
            setPhase('playing')
            syncState()
            startClock()
          })
      })
      .catch(() => {}) // silently ignore — no active game is fine
  }, [user, wsConn, syncState, startClock])

  // ── WebSocket messages ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!wsConn) return
    const handler = (e) => {
      let msg; try { msg = JSON.parse(e.data) } catch { return }

      // ── 4. SESSION REPLACEMENT ─────────────────────────────────────────────
      // Server closed our old socket because we opened a new tab.
      // Show a non-intrusive notice; don't navigate — this fires on the OLD tab.
      if (msg.type === 'session_replaced') {
        clearInterval(seekTimerRef.current)
        clearInterval(clockRef.current)
        setPhase('setup')
        // Surface a subtle banner rather than an alert — the toast system handles it
        // but we don't have direct toast access here; the Navbar/App level WS handler
        // will catch this if needed. Just reset local state cleanly.
        return
      }

      // ── 3. SEEK CANCEL ACK ─────────────────────────────────────────────────
      if (msg.type === 'seek_cancelled') {
        clearInterval(seekTimerRef.current)
        setPhase('setup'); setSeekSeconds(0); setGameMode('human')
        return
      }

      if (msg.type === 'game_start') {
        clearInterval(seekTimerRef.current)
        const color = msg.white.id === user?.id ? 'white' : 'black'
        setMyColor(color); setFlipped(color === 'black'); setGameId(msg.gameId)
        const oppData = color === 'white' ? msg.black : msg.white
        setOpponent({ ...oppData, fide_title: oppData.title ?? null, platform_title: oppData.platform_title ?? null })

        // ── 2. RECONNECTION ───────────────────────────────────────────────────
        // Server sends reconnected:true with current fen + move history.
        // Replay moves into chessRef so legal-move detection is correct,
        // then fast-forward the clock times from the server values.
        if (msg.reconnected && msg.moves?.length) {
          chessRef.current.reset()
          msg.moves.forEach(san => chessRef.current.move(san))
          setMoves(msg.moves)
          setLastMove(msg.moves.length > 0
            ? (() => {
                // derive last move squares from history — chess.js verbose history
                const hist = chessRef.current.history({ verbose: true })
                const last = hist.at(-1)
                return last ? { from: last.from, to: last.to } : null
              })()
            : null)
        } else {
          chessRef.current.reset()
          setMoves([])
          setLastMove(null)
        }

        setWhiteTime(msg.white.time); setBlackTime(msg.black.time)
        setActiveClock(msg.turn ?? 'white')
        setResult(null); setPhase('playing')
        syncState(); startClock()
      }
      if (msg.type === 'move') {
        chessRef.current.move(msg.san)
        setLastMove({ from: msg.from, to: msg.to })
        setWhiteTime(msg.whiteTime); setBlackTime(msg.blackTime)
        setActiveClock(msg.turn); setMoves(prev => [...prev, msg.san])
        syncState()
      }
      if (msg.type === 'game_over') {
        clearInterval(clockRef.current); setActiveClock(null)
        setResult(msg); setPhase('over')
      }
      if (msg.type === 'game_aborted') {
        clearInterval(clockRef.current); setActiveClock(null)
        setResult({ result: null, reason: 'aborted' }); setPhase('over')
      }
    }
    wsConn.addEventListener('message', handler)
    return () => wsConn.removeEventListener('message', handler)
  }, [wsConn, user, syncState, startClock])

  // ── Determine which move handler to use ────────────────────────────────────
  const isLocalMode = gameMode === 'local'
  const isEngineMode = gameMode === 'engine'
  const isOnlineMode = gameMode === 'human'

  // In local mode: always interactive on player's own pieces (both sides)
  // In engine mode: only interactive when it's the human's turn
  // In online mode: only interactive when it's myColor's turn
  const currentTurn = chessRef.current.turn() === 'w' ? 'white' : 'black'

  const boardInteractive = phase === 'playing' && !pendingPromo && (() => {
    if (isLocalMode) return true  // both sides can always move
    if (isEngineMode) return !engineThinking && currentTurn !== engineColor
    if (isOnlineMode) return currentTurn === myColor
    return false
  })()

  // playerColor tells the board which pieces belong to the user
  // In local mode: show pieces for whoever's turn it is (so they can click their own)
  const boardPlayerColor = isLocalMode ? currentTurn : myColor

  // Legal moves to show (only show for the side that can move)
  const visibleLegalMoves = boardInteractive ? legalMoves : []

  // ── Start game helpers ──────────────────────────────────────────────────────
  const resetBoard = () => {
    chessRef.current = new Chess()
    setFen(chessRef.current.fen())
    setLastMove(null)
    setMoves([])
    setResult(null)
    setInCheck(null)
    setFiftyMoveCount(0)
    setPendingPromo(null)
    syncState()
  }

  const startEngineGame = () => {
    stopEngine()
    resetBoard()
    const playerIsWhite = engineColor === 'black'
    setMyColor(playerIsWhite ? 'white' : 'black')
    setFlipped(!playerIsWhite)
    const tc = TIME_CONTROLS.find(t => t.label === selectedTc) || TIME_CONTROLS[6]
    setWhiteTime(tc.ms); setBlackTime(tc.ms)
    setActiveClock('white')
    setOpponent({ username: `Stockfish (${LEVEL_NAMES[engineLevel]})`, rating: getLevelRating(engineLevel) })
    setGameMode('engine'); setPhase('playing')
    startClock()
  }

  const startLocalGame = () => {
    stopEngine()
    resetBoard()
    setMyColor('white'); setFlipped(false)
    const tc = TIME_CONTROLS.find(t => t.label === selectedTc) || TIME_CONTROLS[6]
    setWhiteTime(tc.ms); setBlackTime(tc.ms)
    setActiveClock('white')
    setOpponent({ username: 'Black', rating: '?' })
    setGameMode('local'); setPhase('playing')
    startClock()
  }

  const createOpenChallenge = async () => {
    if (!user) { onOpenAuth?.('register'); return }
    const token = localStorage.getItem('gambit_token')
    if (!token) return
    setOpenChallengeLoading(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/open-challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ time_control: selectedTc, color: 'random', rated: true }),
      })
      const data = await res.json()
      if (res.ok) setOpenChallengeSlug(data.shareUrl || data.slug)
    } catch {}
    finally { setOpenChallengeLoading(false) }
  }

  const copyOpenChallenge = () => {
    if (!openChallengeSlug) return
    navigator.clipboard.writeText(openChallengeSlug).then(() => {
      setOpenChallengeCopied(true)
      setTimeout(() => setOpenChallengeCopied(false), 2000)
    })
  }

  const cancelOpenChallenge = async () => {
    if (!openChallengeSlug) return
    const token = localStorage.getItem('gambit_token')
    const slug = openChallengeSlug.split('/').pop()
    try {
      await fetch(`${import.meta.env.VITE_API_URL || ''}/api/open-challenges/${slug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
    setOpenChallengeSlug(null)
  }

  const seek = () => {
    if (!user) { onOpenAuth?.('register'); return }
    setGameMode('human'); setPhase('seeking'); setSeekSeconds(0)
    seekTimerRef.current = setInterval(() => setSeekSeconds(s => s + 1), 1000)
    onWsSend?.({ type: 'seek', timeControl: selectedTc })
  }

  const cancelSeek = () => {
    clearInterval(seekTimerRef.current)
    setPhase('setup')
    setSeekSeconds(0)
    onWsSend?.({ type: 'seek_cancel' })   // 3. tell server to remove from queue
  }

  const resign = () => {
    clearInterval(clockRef.current); stopEngine()
    const res = isLocalMode
      ? (currentTurn === 'white' ? '0-1' : '1-0')
      : (myColor === 'white' ? '0-1' : '1-0')
    setResult({ result: res, reason: 'resignation' })
    setPhase('over'); setActiveClock(null)
    if (gameId) onWsSend?.({ type: 'resign', gameId })
  }

  const newGame = () => {
    stopEngine()
    clearInterval(clockRef.current)
    clearInterval(seekTimerRef.current)
    resetBoard()
    setPhase('setup'); setGameId(null); setActiveClock(null)
  }

  const offerDraw = () => {
    if (gameId) onWsSend?.({ type: 'draw_offer', gameId })
    else {
      // Local draw offer: just end it
      clearInterval(clockRef.current); setActiveClock(null)
      setResult({ result: '1/2-1/2', reason: 'agreement' }); setPhase('over')
    }
  }

  // ── Result overlay helpers ──────────────────────────────────────────────────
  function getResultDisplay() {
    if (!result) return {}
    const r = result.result
    let icon = '½', title = 'Draw'
    if (r !== '1/2-1/2') {
      const whiteWon = r === '1-0'
      if (isLocalMode) {
        icon = whiteWon ? '♔' : '♚'
        title = whiteWon ? 'White wins!' : 'Black wins!'
      } else {
        const iWon = (r === '1-0' && myColor === 'white') || (r === '0-1' && myColor === 'black')
        icon = iWon ? '🏆' : '💀'
        title = iWon ? 'Victory!' : 'Defeat'
      }
    }
    const reason = result.reason
      ? result.reason.charAt(0).toUpperCase() + result.reason.slice(1)
      : ''
    return { icon, title, reason }
  }

  const grouped = TIME_CONTROLS.reduce((acc, t) => { (acc[t.cat] = acc[t.cat] || []).push(t); return acc }, {})

  // Top/bottom player names (accounts for board flip)
  const topPlayer = flipped
    ? { name: user?.username || 'You', rating: user?.rating ?? '1200', title: user?.fide_title || user?.platform_title }
    : { name: opponent?.username || '?', rating: opponent?.rating ?? '—', title: opponent?.fide_title || opponent?.platform_title }
  const bottomPlayer = flipped
    ? { name: opponent?.username || '?', rating: opponent?.rating ?? '—', title: opponent?.fide_title || opponent?.platform_title }
    : { name: user?.username || 'You', rating: user?.rating ?? '1200', title: user?.fide_title || user?.platform_title }
  const topClock = flipped ? (isLocalMode ? 'white' : myColor === 'white' ? 'white' : 'black')
    : (isLocalMode ? 'black' : myColor === 'white' ? 'black' : 'white')
  const topClockVal = topClock === 'white' ? whiteTime : blackTime
  const bottomClockVal = topClock === 'white' ? blackTime : whiteTime

  const { icon: resIcon, title: resTitle, reason: resReason } = getResultDisplay()

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        {/* Eval bar for engine mode */}
        {isEngineMode && phase !== 'setup' && (
          <EvalBar evaluation={evaluation} myColor={myColor} />
        )}

        {/* Board column */}
        <div className={styles.boardCol}>

          {/* Top player bar */}
          <div className={[styles.playerBar, activeClock === topClock ? styles.playerActive : ''].join(' ')}>
            <Avatar username={topPlayer.name} size={36} />
            <div className={styles.playerInfo}>
              <span className={styles.playerName}>
                <PlayerName username={topPlayer.name} title={topPlayer.title} size="md" />
              </span>
              <span className={styles.playerRating}>{topPlayer.rating}</span>
            </div>
            {isEngineMode && engineThinking && topClock !== (myColor === 'white' ? 'white' : 'black') && (
              <div className={styles.thinkingDot}>
                <span className={styles.thinkingText}>thinking…</span>
                <span className={styles.thinkingPulse} />
              </div>
            )}
            <div className={[styles.clock, activeClock === topClock ? styles.clockActive : '', topClockVal < 30000 ? styles.clockLow : ''].join(' ')}>
              {phase === 'playing' || phase === 'over' ? msToDisplay(topClockVal) : '—'}
            </div>
          </div>

          {/* Status banner */}
          {phase === 'playing' && (
            <StatusBanner
              chess={chessRef.current}
              result={result}
              gameMode={gameMode}
              myColor={myColor}
              activeClock={activeClock}
              fiftyMoveCount={fiftyMoveCount}
            />
          )}

          {/* Board */}
          <div className={styles.boardWrap}>
            <ChessBoard
              fen={fen}
              flipped={flipped}
              interactive={boardInteractive}
              playerColor={boardPlayerColor}
              legalMoves={visibleLegalMoves}
              lastMove={lastMove}
              inCheck={inCheck}
              onMove={isOnlineMode ? handleOnlineMove : handleBoardMove}
              size={520}
            />

            {/* Promotion overlay */}
            {pendingPromo && (
              <PromotionDialog
                color={chessRef.current.turn() === 'w' ? 'white' : 'black'}
                onChoose={handlePromotion}
              />
            )}

            {/* Game over overlay */}
            {phase === 'over' && result && (
              <div className={styles.resultOverlay}>
                <div className={styles.resultBox}>
                  <div className={styles.resultIcon}>{resIcon}</div>
                  <div className={styles.resultTitle}>{resTitle}</div>
                  <div className={styles.resultReason}>{resReason}</div>
                  {result.ratings && (
                    <div className={styles.resultRatings}>
                      <span className={[styles.ratingDelta, (myColor === 'white' ? result.ratings.white.delta : result.ratings.black.delta) >= 0 ? styles.pos : styles.neg].join(' ')}>
                        {(myColor === 'white' ? result.ratings.white.delta : result.ratings.black.delta) >= 0 ? '+' : ''}
                        {myColor === 'white' ? result.ratings.white.delta : result.ratings.black.delta}
                      </span>
                    </div>
                  )}
                  <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                    <Button variant="primary" onClick={newGame}>New Game</Button>
                    {isEngineMode && <Button variant="secondary" onClick={startEngineGame}>Rematch</Button>}
                    {isLocalMode  && <Button variant="secondary" onClick={startLocalGame}>Rematch</Button>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom player bar */}
          <div className={[styles.playerBar, activeClock === (topClock === 'white' ? 'black' : 'white') ? styles.playerActive : ''].join(' ')}>
            <Avatar username={bottomPlayer.name} size={36} />
            <div className={styles.playerInfo}>
              <span className={styles.playerName}>
                <PlayerName username={bottomPlayer.name} title={bottomPlayer.title} size="md" />
              </span>
              <span className={styles.playerRating}>{bottomPlayer.rating}</span>
            </div>
            <div className={[styles.clock, activeClock === (topClock === 'white' ? 'black' : 'white') ? styles.clockActive : '', bottomClockVal < 30000 ? styles.clockLow : ''].join(' ')}>
              {phase === 'playing' || phase === 'over' ? msToDisplay(bottomClockVal) : '—'}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>

          {/* ── Setup panel ── */}
          {phase === 'setup' && (
            <div className={styles.setupPanel}>
              <div className={styles.modeTabs}>
                <button className={[styles.modeTab, gameMode === 'human' ? styles.modeTabActive : ''].join(' ')} onClick={() => setGameMode('human')}>
                  👥 vs Human
                </button>
                <button className={[styles.modeTab, gameMode === 'engine' ? styles.modeTabActive : ''].join(' ')} onClick={() => setGameMode('engine')}>
                  🤖 vs Engine
                </button>
                <button className={[styles.modeTab, gameMode === 'local' ? styles.modeTabActive : ''].join(' ')} onClick={() => setGameMode('local')}>
                  ♟ Local 2P
                </button>
              </div>

              {gameMode === 'engine' && (
                <div className={styles.engineConfig}>
                  <div className={styles.engineSection}>
                    <div className={styles.engineSectionLabel}>Difficulty</div>
                    <div className={styles.levelGrid}>
                      {Object.entries(LEVEL_NAMES).map(([lvl, name]) => (
                        <button
                          key={lvl}
                          className={[styles.levelBtn, engineLevel === Number(lvl) ? styles.levelBtnActive : ''].join(' ')}
                          onClick={() => setEngineLevel(Number(lvl))}
                          title={`~${getLevelRating(Number(lvl))} ELO`}
                        >
                          <span className={styles.levelNum}>{lvl}</span>
                          <span className={styles.levelName}>{name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.engineSection}>
                    <div className={styles.engineSectionLabel}>Play as</div>
                    <div className={styles.colorSelect}>
                      <button className={[styles.colorBtn, engineColor === 'black' ? styles.colorBtnActive : ''].join(' ')} onClick={() => setEngineColor('black')}>
                        <span className={styles.colorPiece}>♔</span> White
                      </button>
                      <button className={[styles.colorBtn, engineColor === 'white' ? styles.colorBtnActive : ''].join(' ')} onClick={() => setEngineColor('white')}>
                        <span className={styles.colorPieceBlack}>♚</span> Black
                      </button>
                    </div>
                  </div>
                  <div className={styles.engineStatus}>
                    <span className={[styles.engineDot, engineReady ? styles.engineDotReady : styles.engineDotLoading].join(' ')} />
                    <span className={styles.engineStatusText}>{engineReady ? 'Stockfish ready' : 'Loading engine…'}</span>
                  </div>
                </div>
              )}

              {gameMode === 'local' && (
                <div className={styles.localInfo}>
                  <div className={styles.localInfoIcon}>♟</div>
                  <p>Two players, one board. Pass the device after each move. Both sides can move freely.</p>
                </div>
              )}

              <div className={styles.tcGroups}>
                {Object.entries(grouped).map(([cat, tcs]) => (
                  <div key={cat} className={styles.tcGroup}>
                    <div className={styles.tcCat} style={{ color: CAT_COLORS[cat] }}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </div>
                    <div className={styles.tcBtns}>
                      {tcs.map(t => (
                        <button
                          key={t.label}
                          className={[styles.tcBtn, selectedTc === t.label ? styles.tcBtnActive : ''].join(' ')}
                          onClick={() => setSelectedTc(t.label)}
                          style={{ '--tc-color': CAT_COLORS[t.cat] }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {gameMode === 'engine' ? (
                <Button variant="primary" size="lg" fullWidth onClick={startEngineGame} disabled={!engineReady}>
                  {engineReady ? `Play vs ${LEVEL_NAMES[engineLevel]}` : 'Loading engine…'}
                </Button>
              ) : gameMode === 'local' ? (
                <Button variant="primary" size="lg" fullWidth onClick={startLocalGame}>
                  Start Local Game
                </Button>
              ) : (
                <>
                  <Button variant="primary" size="lg" fullWidth onClick={seek}>
                    {user ? `Play ${selectedTc}` : 'Sign in to play online'}
                  </Button>
                  <div style={{ marginTop: 8 }}>
                    <Button variant="secondary" size="md" fullWidth onClick={startLocalGame}>
                      Play local 2-player
                    </Button>
                  </div>

                  {/* ── Open challenge link ── */}
                  {user && (
                    <div className={styles.openChallenge}>
                      {!openChallengeSlug ? (
                        <Button variant="ghost" size="sm" fullWidth onClick={createOpenChallenge} disabled={openChallengeLoading}>
                          {openChallengeLoading ? 'Creating…' : '🔗 Create challenge link'}
                        </Button>
                      ) : (
                        <div className={styles.openChallengeLink}>
                          <div className={styles.openChallengeUrl} title={openChallengeSlug}>
                            {openChallengeSlug}
                          </div>
                          <div className={styles.openChallengeActions}>
                            <button className={styles.openChallengeBtn} onClick={copyOpenChallenge}>
                              {openChallengeCopied ? '✓ Copied!' : '📋 Copy'}
                            </button>
                            <button className={styles.openChallengeBtn} onClick={cancelOpenChallenge}>
                              ✕ Cancel
                            </button>
                          </div>
                          <div className={styles.openChallengeHint}>Share this link — first to click wins the white/black assignment</div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Seeking panel ── */}
          {phase === 'seeking' && (
            <div className={styles.seekPanel}>
              <Spinner size={48} />
              <div className={styles.seekTime}>{Math.floor(seekSeconds/60)}:{String(seekSeconds%60).padStart(2,'0')}</div>
              <div className={styles.seekLabel}>Searching for {selectedTc} opponent…</div>
              <Button variant="ghost" size="sm" onClick={cancelSeek}>Cancel</Button>
            </div>
          )}

          {/* ── In-game sidebar ── */}
          {(phase === 'playing' || phase === 'over') && (
            <>
              {/* Turn indicator */}
              {phase === 'playing' && (
                <div className={styles.turnIndicator}>
                  <div className={[styles.turnPiece, currentTurn === 'white' ? styles.turnWhite : styles.turnBlack].join(' ')}>
                    {currentTurn === 'white' ? '♔' : '♚'}
                  </div>
                  <span className={styles.turnLabel}>
                    {isLocalMode
                      ? `${currentTurn === 'white' ? 'White' : 'Black'} to move`
                      : currentTurn === myColor ? 'Your turn' : 'Opponent\'s turn'}
                  </span>
                  {fiftyMoveCount > 0 && (
                    <span className={styles.fiftyBadge} title="Half-moves since last capture or pawn move (50-move rule)">
                      {Math.floor(fiftyMoveCount / 2)}/50
                    </span>
                  )}
                </div>
              )}

              {isEngineMode && (
                <div className={styles.engineBadge}>
                  <span className={styles.engineBadgeIcon}>🤖</span>
                  <div>
                    <div className={styles.engineBadgeName}>{LEVEL_NAMES[engineLevel]}</div>
                    <div className={styles.engineBadgeRating}>~{getLevelRating(engineLevel)} ELO · Stockfish</div>
                  </div>
                  {engineThinking && <Spinner size={16} />}
                </div>
              )}

              {/* Move list */}
              <div className={styles.moveListWrap}>
                <div className={styles.moveListHeader}>
                  Move history
                  <span className={styles.moveCount}>{moves.length} moves</span>
                </div>
                <div className={styles.moveList} id="moveList">
                  {moves.length === 0 && (
                    <div className={styles.moveListEmpty}>Make the first move…</div>
                  )}
                  {Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => (
                    <div key={i} className={styles.movePair}>
                      <span className={styles.moveNum}>{i + 1}.</span>
                      <span className={[styles.moveSan, moves.length - 1 === i*2 ? styles.moveLast : ''].join(' ')}>
                        {moves[i * 2] || ''}
                      </span>
                      <span className={[styles.moveSan, moves.length - 1 === i*2+1 ? styles.moveLast : ''].join(' ')}>
                        {moves[i * 2 + 1] || ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Game controls */}
              <div className={styles.gameControls}>
                <button className={styles.ctrlBtn} onClick={() => setFlipped(f => !f)} title="Flip board">⇅</button>
                {phase === 'playing' && (
                  <button className={styles.ctrlBtn} onClick={resign} title="Resign">🏳</button>
                )}
                {phase === 'playing' && (
                  <button className={styles.ctrlBtn} onClick={offerDraw} title="Offer draw">½</button>
                )}
                <button className={styles.ctrlBtn} onClick={newGame} title="New game">✕</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
