// ══════════════════════════════════════════════════════
// WATCH PAGE — Spectate live games & tournaments
// ══════════════════════════════════════════════════════
import { useState, useEffect, useRef, useCallback } from 'react'
import { Chess } from 'chess.js'
import ChessBoard from '../components/ChessBoard'
import PlayerName from '../components/PlayerName'
import styles from './Watch.module.css'

const API    = import.meta.env.VITE_API_URL || ''
const WS_URL = import.meta.env.VITE_WS_URL  || 'ws://localhost:3001/ws'

function PlayerRow({ player, side, timeMs }) {
  if (!player) return null
  const secs = timeMs != null ? Math.max(0, Math.floor(timeMs / 1000)) : null
  const timeStr = secs != null
    ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
    : null

  return (
    <div className={`${styles.playerRow} ${styles[side]}`}>
      <div className={styles.playerAvatar}>{(player.username || '?')[0].toUpperCase()}</div>
      <div className={styles.playerInfo}>
        {player.country && <span className={styles.playerCountry}>{player.country}</span>}
        <PlayerName username={player.username} title={player.fide_title} size="md" />
        <span className={styles.playerRating}>{player.rating}</span>
      </div>
      {timeStr && <div className={styles.playerClock}>{timeStr}</div>}
    </div>
  )
}

function LiveGameCard({ game, onClick, isSelected }) {
  return (
    <div
      className={`${styles.gameCard} ${isSelected ? styles.gameCardSelected : ''}`}
      onClick={() => onClick(game)}
    >
      <div className={styles.gameCardPlayers}>
        <div className={styles.miniPlayer}>
          <PlayerName username={game.white} title={game.white_title || game.white_platform_title} size="sm" />
          <span className={styles.miniRating}>{game.white_rating}</span>
        </div>
        <div className={styles.vsLabel}>vs</div>
        <div className={`${styles.miniPlayer} ${styles.miniPlayerRight}`}>
          <PlayerName username={game.black} title={game.black_title || game.black_platform_title} size="sm" />
          <span className={styles.miniRating}>{game.black_rating}</span>
        </div>
      </div>
      <div className={styles.gameCardMeta}>
        <span className={styles.tcBadge}>{game.time_control}</span>
        <span className={styles.gameTypeBadge}>{game.game_type}</span>
      </div>
    </div>
  )
}

// ── Spectator WebSocket hook ──────────────────────────
// Opens an anonymous WS connection (no token) just to receive move broadcasts.
// The server sends 'move' and 'game_over' messages to everyone.
function useSpectatorWs(watchingGameId, onMove, onGameOver) {
  const wsRef = useRef(null)

  useEffect(() => {
    if (!watchingGameId) return

    // Close any existing spectator socket
    wsRef.current?.close()

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      // Subscribe to a specific game's broadcast channel
      ws.send(JSON.stringify({ type: 'spectate', gameId: watchingGameId }))
    }

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.gameId !== watchingGameId) return
        if (msg.type === 'move')      onMove(msg)
        if (msg.type === 'game_over') onGameOver(msg)
      } catch {}
    }

    ws.onerror = () => {}
    ws.onclose = () => {}

    return () => ws.close()
  }, [watchingGameId])  // eslint-disable-line react-hooks/exhaustive-deps
}

export function WatchPage({ onOpenAuth }) {
  const [activeTab, setActiveTab]             = useState('games')
  const [liveGames, setLiveGames]             = useState([])
  const [liveTournaments, setLiveTournaments] = useState([])
  const [watchingGame, setWatchingGame]       = useState(null)
  const [fen, setFen]                         = useState(new Chess().fen())
  const [moves, setMoves]                     = useState([])
  const [whiteTime, setWhiteTime]             = useState(null)
  const [blackTime, setBlackTime]             = useState(null)
  const [lastMove, setLastMove]               = useState(null)
  const [gameOver, setGameOver]               = useState(null)
  const [loading, setLoading]                 = useState(true)
  const pollRef = useRef(null)

  // ── Fetch game list ─────────────────────────────────
  const fetchGames = useCallback(() => {
    fetch(`${API}/api/games?status=active&limit=20`)
      .then(r => r.json())
      .then(data => {
        const games = Array.isArray(data) ? data : []
        setLiveGames(games)
        setWatchingGame(prev => prev ?? (games[0] || null))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const fetchTournaments = useCallback(() => {
    fetch(`${API}/api/tournaments?status=active`)
      .then(r => r.json())
      .then(data => setLiveTournaments(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchGames()
    fetchTournaments()
    pollRef.current = setInterval(() => {
      fetchGames()
      fetchTournaments()
    }, 10000) // poll less aggressively — WS handles live moves
    return () => clearInterval(pollRef.current)
  }, [fetchGames, fetchTournaments])

  // ── Load initial game state when selection changes ──
  useEffect(() => {
    if (!watchingGame?.id) return
    setGameOver(null)
    setLastMove(null)
    fetch(`${API}/api/games/${watchingGame.id}`)
      .then(r => r.json())
      .then(data => {
        setFen(data.fen || new Chess().fen())
        setMoves(data.moves || [])
        setWhiteTime(data.white_time_ms ?? null)
        setBlackTime(data.black_time_ms ?? null)
      })
      .catch(() => {})
  }, [watchingGame?.id])

  // ── WebSocket live move handler ─────────────────────
  const handleMove = useCallback((msg) => {
    setFen(msg.fen)
    setLastMove({ from: msg.from, to: msg.to })
    setWhiteTime(msg.whiteTime ?? null)
    setBlackTime(msg.blackTime ?? null)
    setMoves(prev => [...prev, { san: msg.san }])
  }, [])

  const handleGameOver = useCallback((msg) => {
    setGameOver(msg)
    // Remove finished game from live list after a short delay
    setTimeout(() => setLiveGames(prev => prev.filter(g => g.id !== msg.gameId)), 3000)
  }, [])

  useSpectatorWs(watchingGame?.id, handleMove, handleGameOver)

  const white = watchingGame ? { username: watchingGame.white, rating: watchingGame.white_rating } : null
  const black = watchingGame ? { username: watchingGame.black, rating: watchingGame.black_rating } : null

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <div className={styles.liveTag}><span className={styles.livePulse} /> LIVE</div>
            <h1 className={styles.pageTitle}>Watch Chess</h1>
            <p className={styles.pageDesc}>Spectate live games and tournaments — no account needed.</p>
          </div>
          <div className={styles.guestNote}>
            <span>👁 Guest spectator</span>
            <button className={styles.joinBtn} onClick={() => onOpenAuth('register')}>
              Create account to play →
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {[
            { v: 'games',       label: '♟ Live Games' },
            { v: 'tournaments', label: '🏆 Tournaments' },
          ].map(t => (
            <button key={t.v}
              className={`${styles.tab} ${activeTab === t.v ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(t.v)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Games Tab */}
        {activeTab === 'games' && (
          <div className={styles.gamesLayout}>
            <div className={styles.gameList}>
              <div className={styles.gameListHeader}>
                <span>Live Now</span>
                <span className={styles.gameCount}>{liveGames.length} games</span>
              </div>
              {loading ? (
                <div className={styles.stateMsg}>Loading games…</div>
              ) : liveGames.length === 0 ? (
                <div className={styles.stateMsg}>No live games right now.</div>
              ) : (
                liveGames.map(g => (
                  <LiveGameCard key={g.id} game={g}
                    onClick={g => { setWatchingGame(g); setGameOver(null) }}
                    isSelected={watchingGame?.id === g.id} />
                ))
              )}
            </div>

            {watchingGame ? (
              <div className={styles.boardSection}>
                <PlayerRow player={black} side="top"    timeMs={blackTime} />
                <div className={styles.boardWrap}>
                  <ChessBoard fen={fen} lastMove={lastMove} interactive={false} size={480} />
                </div>
                <PlayerRow player={white} side="bottom" timeMs={whiteTime} />

                {gameOver && (
                  <div className={styles.gameOverBanner}>
                    <strong>Game over</strong> — {gameOver.reason}
                    {gameOver.winnerId
                      ? ` · ${gameOver.winnerId === watchingGame.white_id ? watchingGame.white : watchingGame.black} wins`
                      : ' · Draw'}
                  </div>
                )}

                <div className={styles.moveListPanel}>
                  <div className={styles.moveListTitle}>Moves</div>
                  <div className={styles.moveList}>
                    {moves.length === 0 ? (
                      <div className={styles.noMoves}>Game just started</div>
                    ) : (
                      moves.map((m, i) =>
                        i % 2 === 0 ? (
                          <div key={i} className={styles.movePair}>
                            <span className={styles.moveNum}>{Math.floor(i / 2) + 1}.</span>
                            <span className={styles.moveSan}>{m.san}</span>
                            {moves[i + 1] && <span className={styles.moveSan}>{moves[i + 1].san}</span>}
                          </div>
                        ) : null
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noGame}>Select a game to watch</div>
            )}
          </div>
        )}

        {/* Tournaments Tab */}
        {activeTab === 'tournaments' && (
          <div className={styles.tournamentsLayout}>
            {liveTournaments.length === 0 ? (
              <div className={styles.stateMsg}>No live tournaments right now.</div>
            ) : (
              liveTournaments.map(t => (
                <TournamentPanel key={t.id} tournament={t} />
              ))
            )}
          </div>
        )}

        {/* CTA */}
        <div className={styles.ctaBanner}>
          <div className={styles.ctaText}>
            <strong>Want to play?</strong> Create a free account to join games, compete in tournaments, and track your progress.
          </div>
          <div className={styles.ctaActions}>
            <button className={styles.ctaPlay}  onClick={() => onOpenAuth('register')}>Play for Free</button>
            <button className={styles.ctaLogin} onClick={() => onOpenAuth('login')}>Log In</button>
          </div>
        </div>

      </div>
    </div>
  )
}

function TournamentPanel({ tournament }) {
  const [standings, setStandings] = useState([])
  const [rounds, setRounds]       = useState([])
  const [showStandings, setShowStandings] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/tournaments/${tournament.id}/standings`)
      .then(r => r.json()).then(d => setStandings(d.standings || [])).catch(() => {})
    fetch(`${API}/api/tournaments/${tournament.id}/rounds`)
      .then(r => r.json()).then(d => setRounds(d.rounds || [])).catch(() => {})
  }, [tournament.id])

  return (
    <div className={styles.tournPanel}>
      <div className={styles.tournHeader}>
        <div>
          <div className={styles.tournName}>{tournament.name}</div>
          <div className={styles.tournMeta}>
            <span className={styles.liveDot} />
            <span>{tournament.format} · {tournament.time_control}</span>
            <span>Round {tournament.current_round}</span>
          </div>
        </div>
      </div>

      <div className={styles.tournTabs}>
        <button className={`${styles.tTab} ${showStandings  ? styles.tTabActive : ''}`} onClick={() => setShowStandings(true)}>Standings</button>
        <button className={`${styles.tTab} ${!showStandings ? styles.tTabActive : ''}`} onClick={() => setShowStandings(false)}>Rounds</button>
      </div>

      {showStandings ? (
        <div className={styles.standings}>
          {standings.length === 0 ? <div className={styles.stateMsg}>No standings yet</div> : (
            standings.map((p, i) => (
              <div key={p.username} className={`${styles.standingRow} ${i === 0 ? styles.standingFirst : ''}`}>
                <span className={styles.standingRank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1)}</span>
                {p.country && <span className={styles.standingCountry}>{p.country}</span>}
                <PlayerName username={p.username} title={p.fide_title || p.platform_title} size="sm" className={styles.standingName} />
                <span className={styles.standingPts}>{p.score}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className={styles.roundsList}>
          {rounds.length === 0 ? <div className={styles.stateMsg}>No rounds yet</div> : (
            rounds.map(r => (
              <div key={r.round} className={styles.roundBlock}>
                <div className={styles.roundTitle}>Round {r.round}</div>
                {r.games.map(g => (
                  <div key={g.gameId} className={styles.roundGame}>
                    <PlayerName username={g.white?.username} title={g.white?.fide_title || g.white?.platform_title} size="sm" />
                    <span className={styles.roundResult}>{g.result || '—'}</span>
                    <PlayerName username={g.black?.username} title={g.black?.fide_title || g.black?.platform_title} size="sm" />
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
