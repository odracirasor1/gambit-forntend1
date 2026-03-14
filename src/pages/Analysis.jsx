import { useState, useCallback, useEffect } from 'react'
import { Chess } from 'chess.js'
import ChessBoard from '../components/ChessBoard'
import { Button, SectionHeader } from '../components/UI'
import { useStockfish } from '../hooks/useStockfish'
import styles from './Analysis.module.css'

// ── Eval Bar ──────────────────────────────────────────
function EvalBar({ evaluation, flipped }) {
  if (!evaluation) {
    return (
      <div className={styles.evalBarWrap}>
        <div className={styles.evalBarOuter}>
          <div className={styles.evalBarWhite} style={{ height: '50%' }} />
        </div>
        <div className={styles.evalLabel}>0.0</div>
      </div>
    )
  }
  let pct = 50
  if (evaluation.type === 'mate') {
    pct = evaluation.value > 0 ? 95 : 5
  } else {
    const pawns = Math.max(-5, Math.min(5, evaluation.value / 100))
    pct = 50 + pawns * 9
  }
  const whitePct = flipped ? 100 - pct : pct
  const label = evaluation.type === 'mate'
    ? `M${Math.abs(evaluation.value)}`
    : (evaluation.value >= 0 ? '+' : '') + (evaluation.value / 100).toFixed(1)

  return (
    <div className={styles.evalBarWrap} title={`Stockfish evaluation: ${label}`}>
      <div className={styles.evalBarOuter}>
        <div className={styles.evalBarWhite} style={{ height: whitePct + '%' }} />
      </div>
      <div className={`${styles.evalLabel} ${evaluation.type === 'mate' ? styles.evalMate : ''}`}>{label}</div>
    </div>
  )
}

const OPENINGS = {
  'e4':                { eco:'B00', name:"King's Pawn" },
  'e4 e5':             { eco:'C20', name:'Open Game' },
  'e4 e5 Nf3':         { eco:'C40', name:"King's Knight" },
  'e4 e5 Nf3 Nc6 Bc4': { eco:'C50', name:'Italian Game' },
  'e4 e5 Nf3 Nc6 Bb5': { eco:'C60', name:'Ruy López' },
  'e4 c5':             { eco:'B20', name:'Sicilian Defence' },
  'e4 e6':             { eco:'C00', name:'French Defence' },
  'e4 c6':             { eco:'B10', name:'Caro-Kann' },
  'd4':                { eco:'A40', name:"Queen's Pawn" },
  'd4 d5 c4':          { eco:'D06', name:"Queen's Gambit" },
  'd4 Nf6 c4 g6':      { eco:'E60', name:"King's Indian" },
  'c4':                { eco:'A10', name:'English Opening' },
  'Nf3':               { eco:'A04', name:'Réti Opening' },
}

function lookupOpening(moves) {
  for (let i = Math.min(moves.length, 6); i > 0; i--) {
    const key = moves.slice(0, i).join(' ')
    if (OPENINGS[key]) return OPENINGS[key]
  }
  return null
}

export function AnalysisPage() {
  const [chess] = useState(() => new Chess())
  const [positions, setPositions] = useState([{ fen: new Chess().fen(), san: null }])
  const [posIdx, setPosIdx] = useState(0)
  const [lastMove, setLastMove] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [pgn, setPgn] = useState('')
  const [pgnError, setPgnError] = useState('')
  const [opening, setOpening] = useState(null)
  const [engineOn, setEngineOn] = useState(true)

  const { ready: engineReady, thinking, evaluation, getBestMove, stopEngine } = useStockfish()

  const curFen = positions[posIdx]?.fen || new Chess().fen()

  // Auto-analyze when position changes and engine is on
  useEffect(() => {
    if (!engineOn || !engineReady) return
    stopEngine()
    // Trigger continuous analysis
    const worker = new Worker('/engine/stockfish.js', { type: 'classic' })
    let alive = true
    worker.onmessage = () => {}
    worker.onerror = () => {}
    // We use the hook's getBestMove which updates evaluation via onmessage
    getBestMove(curFen, 8).catch(() => {})
    return () => { alive = false }
  }, [curFen, engineOn, engineReady])

  const jumpTo = (idx) => {
    const clamped = Math.max(0, Math.min(positions.length - 1, idx))
    setPosIdx(clamped)
    const pos = positions[clamped]
    setLastMove(pos.move ? { from: pos.move.from, to: pos.move.to } : null)
  }

  const loadPgn = () => {
    try {
      const c = new Chess()
      c.loadPgn(pgn)
      const history = c.history({ verbose: true })
      const posArr = [{ fen: new Chess().fen(), san: null, move: null }]
      const replay = new Chess()
      history.forEach(m => {
        replay.move(m.san)
        posArr.push({ fen: replay.fen(), san: m.san, move: m })
      })
      setPositions(posArr)
      setPosIdx(posArr.length - 1)
      setLastMove(history.length ? { from: history[history.length-1].from, to: history[history.length-1].to } : null)
      setPgnError('')
      const sans = history.map(m => m.san)
      setOpening(lookupOpening(sans))
    } catch(e) {
      setPgnError('Invalid PGN — ' + e.message)
    }
  }

  const clearBoard = () => {
    chess.reset()
    setPositions([{ fen: new Chess().fen(), san: null, move: null }])
    setPosIdx(0)
    setLastMove(null)
    setPgn('')
    setPgnError('')
    setOpening(null)
  }

  const handleBoardMove = useCallback((from, to) => {
    const c = new Chess(curFen)
    const move = c.move({ from, to, promotion: 'q' })
    if (!move) return
    const newPos = { fen: c.fen(), san: move.san, move }
    const newPositions = [...positions.slice(0, posIdx + 1), newPos]
    setPositions(newPositions)
    setPosIdx(newPositions.length - 1)
    setLastMove({ from, to })
  }, [curFen, positions, posIdx])

  // Legal moves for current position
  const tmpChess = new Chess(curFen)
  const legalMoves = tmpChess.moves({ verbose: true }).map(m => ({ from: m.from, to: m.to }))

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <SectionHeader title="Analysis Board" subtitle="Study" />

        <div className={styles.layout}>
          {/* Eval Bar + Board */}
          <div className={styles.boardColumn}>
            {opening && (
              <div className={styles.openingBanner}>
                <span className={styles.openingEco}>{opening.eco}</span>
                <span className={styles.openingName}>{opening.name}</span>
              </div>
            )}
            <div className={styles.boardWithEval}>
              <EvalBar evaluation={evaluation} flipped={flipped} />
              <ChessBoard
                fen={curFen}
                flipped={flipped}
                interactive={true}
                playerColor="white"
                legalMoves={legalMoves}
                lastMove={lastMove}
                onMove={handleBoardMove}
                size={520}
              />
            </div>
            {/* Nav controls */}
            <div className={styles.navControls}>
              <button className={styles.navBtn} onClick={() => jumpTo(0)}>⇤</button>
              <button className={styles.navBtn} onClick={() => jumpTo(posIdx - 1)}>←</button>
              <span className={styles.navPos}>{posIdx} / {positions.length - 1}</span>
              <button className={styles.navBtn} onClick={() => jumpTo(posIdx + 1)}>→</button>
              <button className={styles.navBtn} onClick={() => jumpTo(positions.length - 1)}>⇥</button>
              <button className={styles.navBtn} onClick={() => setFlipped(f => !f)}>⇅</button>
            </div>

            {/* Stockfish status bar */}
            <div className={styles.engineBar}>
              <div className={styles.engineStatus}>
                <div className={`${styles.engineDot} ${engineReady ? styles.engineDotReady : ''} ${thinking ? styles.engineDotThinking : ''}`} />
                <span className={styles.engineName}>
                  {!engineReady ? 'Loading Stockfish…' : thinking ? 'Stockfish analyzing…' : 'Stockfish 18'}
                </span>
                {evaluation && (
                  <span className={styles.engineEval}>
                    {evaluation.type === 'mate'
                      ? `Mate in ${Math.abs(evaluation.value)}`
                      : `${evaluation.value >= 0 ? '+' : ''}${(evaluation.value / 100).toFixed(2)} pawns`}
                  </span>
                )}
              </div>
              <button
                className={`${styles.engineToggle} ${engineOn ? styles.engineOn : ''}`}
                onClick={() => { setEngineOn(v => !v); if (engineOn) stopEngine() }}
              >
                {engineOn ? '⏸ Pause' : '▶ Analyze'}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.sidebar}>
            {/* PGN input */}
            <div className={styles.pgnSection}>
              <label className={styles.pgnLabel}>Load PGN</label>
              <textarea
                className={styles.pgnInput}
                value={pgn}
                onChange={e => setPgn(e.target.value)}
                placeholder="1. e4 e5 2. Nf3 Nc6 3. Bc4…"
                rows={5}
              />
              {pgnError && <div className={styles.pgnError}>{pgnError}</div>}
              <div className={styles.pgnActions}>
                <Button variant="primary" size="sm" onClick={loadPgn}>Load PGN</Button>
                <Button variant="ghost" size="sm" onClick={clearBoard}>Clear</Button>
              </div>
            </div>

            {/* FEN */}
            <div className={styles.fenSection}>
              <label className={styles.pgnLabel}>FEN</label>
              <input className={styles.fenInput} value={curFen} readOnly />
            </div>

            {/* Move list */}
            <div className={styles.moveListWrap}>
              <div className={styles.moveListTitle}>Moves</div>
              <div className={styles.moveList}>
                {positions.slice(1).length === 0 && (
                  <div className={styles.moveEmpty}>Make a move or load a PGN</div>
                )}
                {Array.from({ length: Math.ceil((positions.length - 1) / 2) }, (_, i) => {
                  const wIdx = i * 2 + 1
                  const bIdx = i * 2 + 2
                  return (
                    <div key={i} className={styles.movePair}>
                      <span className={styles.moveNum}>{i + 1}.</span>
                      {positions[wIdx] && (
                        <button
                          className={[styles.moveSan, posIdx === wIdx ? styles.moveActive : ''].join(' ')}
                          onClick={() => jumpTo(wIdx)}
                        >
                          {positions[wIdx].san}
                        </button>
                      )}
                      {positions[bIdx] && (
                        <button
                          className={[styles.moveSan, posIdx === bIdx ? styles.moveActive : ''].join(' ')}
                          onClick={() => jumpTo(bIdx)}
                        >
                          {positions[bIdx].san}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
