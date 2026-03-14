import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useStockfish — Stockfish 18 lite (single-threaded WASM)
 *
 * Files live in public/engine/ (copied from node_modules/stockfish/bin/ by
 * scripts/copy-engine.cjs which runs automatically on npm install).
 *
 *   public/engine/stockfish.js    ← Worker script
 *   public/engine/stockfish.wasm  ← WASM binary (found automatically, same dir)
 */

const LEVEL_CONFIG = {
  1: { skillLevel:  0, depth:  1, moveTime:  50  },
  2: { skillLevel:  3, depth:  2, moveTime:  100 },
  3: { skillLevel:  6, depth:  3, moveTime:  200 },
  4: { skillLevel:  9, depth:  5, moveTime:  400 },
  5: { skillLevel: 12, depth:  8, moveTime:  700 },
  6: { skillLevel: 15, depth: 12, moveTime: 1000 },
  7: { skillLevel: 18, depth: 16, moveTime: 1500 },
  8: { skillLevel: 20, depth: 22, moveTime: 2500 },
}

export const LEVEL_NAMES = {
  1: 'Beginner',
  2: 'Novice',
  3: 'Casual',
  4: 'Intermediate',
  5: 'Club Player',
  6: 'Advanced',
  7: 'Expert',
  8: 'Master',
}

export function useStockfish() {
  const workerRef  = useRef(null)
  const resolveRef = useRef(null)

  const [ready,      setReady]      = useState(false)
  const [thinking,   setThinking]   = useState(false)
  const [evaluation, setEvaluation] = useState(null)

  useEffect(() => {
    let cancelled = false
    const worker = new Worker('/engine/stockfish.js', { type: 'classic' })
    workerRef.current = worker

    worker.onmessage = (e) => {
      if (cancelled) return
      const line = typeof e.data === 'string' ? e.data : null
      if (!line) return

      if (line === 'uciok')   { worker.postMessage('isready'); return }
      if (line === 'readyok') { setReady(true);                return }

      if (line.startsWith('info') && line.includes(' score ')) {
        const mateM = line.match(/score mate (-?\d+)/)
        const cpM   = line.match(/score cp (-?\d+)/)
        if (mateM)    setEvaluation({ type: 'mate', value: parseInt(mateM[1], 10) })
        else if (cpM) setEvaluation({ type: 'cp',   value: parseInt(cpM[1],   10) })
      }

      if (line.startsWith('bestmove')) {
        const moveStr = line.split(' ')[1]
        setThinking(false)
        if (resolveRef.current && moveStr && moveStr !== '(none)') {
          resolveRef.current({
            from:      moveStr.slice(0, 2),
            to:        moveStr.slice(2, 4),
            promotion: moveStr.length > 4 ? moveStr[4] : undefined,
          })
          resolveRef.current = null
        }
      }
    }

    worker.onerror = (err) => {
      console.error('[Stockfish 18] Worker error:', err)
      if (!cancelled) setReady(false)
    }

    worker.postMessage('uci')

    return () => {
      cancelled = true
      worker.postMessage('quit')
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const getBestMove = useCallback((fen, level = 4) => {
    return new Promise((resolve) => {
      if (!workerRef.current || !ready) { resolve(null); return }
      const { skillLevel, depth, moveTime } = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[4]
      setThinking(true)
      resolveRef.current = resolve
      const w = workerRef.current
      w.postMessage('stop')
      w.postMessage(`setoption name Skill Level value ${skillLevel}`)
      w.postMessage(`setoption name Hash value 16`)
      w.postMessage(`position fen ${fen}`)
      w.postMessage(`go depth ${depth} movetime ${moveTime}`)
    })
  }, [ready])

  const stopEngine = useCallback(() => {
    workerRef.current?.postMessage('stop')
    setThinking(false)
    if (resolveRef.current) { resolveRef.current(null); resolveRef.current = null }
  }, [])

  return { ready, thinking, evaluation, getBestMove, stopEngine }
}
