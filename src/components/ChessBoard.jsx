import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import ChessPiece from './ChessPiece'
import styles from './ChessBoard.module.css'

// Parse FEN position string → 8x8 matrix
function fenToMatrix(fen) {
  const pos = Array(8).fill(null).map(() => Array(8).fill(null))
  const rows = fen.split(' ')[0].split('/')
  rows.forEach((row, r) => {
    let c = 0
    for (const ch of row) {
      if (/\d/.test(ch)) c += parseInt(ch)
      else { pos[r][c] = ch; c++ }
    }
  })
  return pos
}

function sqToCoords(sq) {
  return { r: 8 - parseInt(sq[1]), c: sq.charCodeAt(0) - 97 }
}

function coordsToSq(r, c) {
  return 'abcdefgh'[c] + (8 - r)
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1']

export default function ChessBoard({
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  flipped = false,
  interactive = false,
  playerColor = 'white',
  legalMoves = [],     // array of { from, to } UCI move objects
  lastMove = null,     // { from, to }
  inCheck = null,      // square of king in check
  onMove,              // callback(from, to)
  size = 560,          // board pixel size
}) {
  const [selected, setSelected] = useState(null) // selected square e.g. 'e2'
  const prevFenRef = useRef(fen)
  useEffect(() => {
    if (prevFenRef.current !== fen) {
      prevFenRef.current = fen
      setSelected(null)
    }
  }, [fen])

  const pos = useMemo(() => fenToMatrix(fen), [fen])
  const sqSize = size / 8

  // Legal targets from selected square
  const legalTargets = useMemo(() => {
    if (!selected) return new Set()
    return new Set(legalMoves.filter(m => m.from === selected).map(m => m.to))
  }, [selected, legalMoves])

  const handleSquareClick = useCallback((sq) => {
    if (!interactive) return

    // If clicking a legal target → make move
    if (selected && legalTargets.has(sq)) {
      onMove?.(selected, sq)
      setSelected(null)
      return
    }

    const { r, c } = sqToCoords(sq)
    const piece = pos[r][c]

    // Select own piece
    const isOwn = piece && (
      playerColor === 'white' ? piece === piece.toUpperCase() : piece !== piece.toUpperCase()
    )
    if (isOwn) {
      setSelected(sq === selected ? null : sq)
    } else {
      setSelected(null)
    }
  }, [selected, legalTargets, interactive, onMove, pos, playerColor])

  // Render squares in correct orientation
  const renderBoard = () => {
    const squares = []
    for (let ri = 0; ri < 8; ri++) {
      for (let ci = 0; ci < 8; ci++) {
        const r = flipped ? 7 - ri : ri
        const c = flipped ? 7 - ci : ci
        const sq = coordsToSq(r, c)
        const piece = pos[r][c]
        const isLight = (r + c) % 2 !== 0
        const isSelected = selected === sq
        const isLegalTarget = legalTargets.has(sq)
        const isLastFrom = lastMove?.from === sq
        const isLastTo   = lastMove?.to   === sq
        const isCheck    = inCheck === sq

        const showRank = ci === 0
        const showFile = ri === 7

        squares.push(
          <div
            key={sq}
            className={[
              styles.square,
              isLight ? styles.light : styles.dark,
              isSelected  ? styles.selected  : '',
              isLastFrom  ? styles.lastFrom  : '',
              isLastTo    ? styles.lastTo    : '',
              isCheck     ? styles.inCheck   : '',
              isLegalTarget && piece ? styles.legalCapture : '',
            ].join(' ')}
            style={{ width: sqSize, height: sqSize }}
            onClick={() => handleSquareClick(sq)}
          >
            {/* Coordinate labels */}
            {showRank && (
              <span className={`${styles.coord} ${styles.coordRank} ${isLight ? styles.coordOnLight : styles.coordOnDark}`}>
                {flipped ? ri + 1 : 8 - ri}
              </span>
            )}
            {showFile && (
              <span className={`${styles.coord} ${styles.coordFile} ${isLight ? styles.coordOnLight : styles.coordOnDark}`}>
                {FILES[flipped ? 7 - ci : ci]}
              </span>
            )}

            {/* Legal move dot */}
            {isLegalTarget && !piece && (
              <div className={styles.legalDot} />
            )}

            {/* Capture ring */}
            {isLegalTarget && piece && (
              <div className={styles.captureRing} />
            )}

            {/* Piece */}
            {piece && (
              <div className={`${styles.piece} ${isSelected ? styles.pieceSelected : ''}`}>
                <ChessPiece piece={piece} size={sqSize * 0.88} />
              </div>
            )}
          </div>
        )
      }
    }
    return squares
  }

  return (
    <div
      className={styles.boardWrap}
      style={{ width: size, height: size, '--sq-size': `${sqSize}px` }}
    >
      <div className={styles.board} style={{ width: size, height: size }}>
        {renderBoard()}
      </div>
    </div>
  )
}
