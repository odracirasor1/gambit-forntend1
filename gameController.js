/**
 * gameController.js — Single Responsibility: game lifecycle orchestration
 *
 * Owns:
 *  - Starting a game (create state + persist + notify players)
 *  - Ending a game (persist + ELO + notify + tournament hook)
 *
 * Does NOT own: chess rules, transport, DB queries, clock ticking, pairing
 */

const gameService  = require('./game');
const gameRepo     = require('./gameRepository');
const matchmaking  = require('./matchmaking');
const { calculateNewRatings } = require('./elo');
const { outcomeFromResult, outcomeToPoints, pointsFromReason, Points } = require('./outcome');
const { parseTimeControl } = require('./timeControl');
const { classify }         = require('./speed');
const tournament           = require('./tournament');
const credits              = require('./credits');
const titles               = require('./titles');

// Injected send function from websocket.js
let _sendToUser          = () => {};
let _broadcastSpectators = () => {};
function init(sendToUserFn, broadcastSpectatorsFn) {
  _sendToUser          = sendToUserFn;
  _broadcastSpectators = broadcastSpectatorsFn || (() => {});
}

// ── Start a new game ──────────────────────────────────────────
async function startGame(userA, userB, timeControl) {
  const [white, black]         = gameService.assignColors(userA, userB);
  const { timeMs, incrementMs } = parseTimeControl(timeControl);
  const gameType = classify(timeMs / 1000, incrementMs / 1000).key;

  const gameId = await gameRepo.insertGame({
    whiteId: white.id, blackId: black.id, timeControl, gameType, timeMs,
  });
  const game = gameService.createGameState({ gameId, white, black, timeControl });

  const payload = {
    type: 'game_start',
    gameId,
    white: { id: white.id, username: white.username, rating: white.rating, title: white.fide_title || null, platform_title: white.platform_title || null, time: timeMs },
    black: { id: black.id, username: black.username, rating: black.rating, title: black.fide_title || null, platform_title: black.platform_title || null, time: timeMs },
    fen:   game.chess.fen(),
    timeControl,
  };

  _sendToUser(white.id, payload);
  _sendToUser(black.id, payload);

  return game;
}

// ── End a game ────────────────────────────────────────────────
async function endGame(game, result, winnerId, reason) {
  const pgn       = gameService.finaliseGame(game);
  const moveCount = game.chess.history().length;

  // Fetch current ratings
  const players = await gameRepo.getPlayers(game.white.id, game.black.id);
  const wRow    = players.find(p => p.id === game.white.id);
  const bRow    = players.find(p => p.id === game.black.id);

  if (!wRow || !bRow) {
    console.error('Player missing in DB', { white: game.white.id, black: game.black.id });
    return;
  }

  // ELO
  const score   = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
  const ratings = calculateNewRatings(
    { rating: wRow.rating, games_played: wRow.games_played },
    { rating: bRow.rating, games_played: bRow.games_played },
    score
  );

  // Persist
  await gameRepo.finaliseGame({ gameId: game.id, result, winnerId, pgn, moveCount });
  await gameRepo.updatePlayerStats({
    userId: game.white.id, newRating: ratings.white.rating,
    won: result === '1-0', drawn: result === '1/2-1/2',
  });
  await gameRepo.updatePlayerStats({
    userId: game.black.id, newRating: ratings.black.rating,
    won: result === '0-1', drawn: result === '1/2-1/2',
  });

  const gameOverPayload = {
    type: 'game_over', gameId: game.id,
    result, reason: reason || 'normal', winnerId,
    ratings: {
      white: { new: ratings.white.rating, delta: ratings.white.delta },
      black: { new: ratings.black.rating, delta: ratings.black.delta },
    },
  };
  _sendToUser(game.white.id, gameOverPayload);
  _sendToUser(game.black.id, gameOverPayload);
  _broadcastSpectators(game.id, gameOverPayload);

  // Settle wager if one exists on this game
  if (reason === 'aborted') {
    await credits.refundWager(game.id).catch(console.error);
  } else {
    await credits.settleWager(game.id, winnerId).catch(console.error);
  }

  // Auto-grant platform titles (CG / CS) if newly eligible — non-blocking
  Promise.all([
    titles.checkAndAutoGrant(game.white.id),
    titles.checkAndAutoGrant(game.black.id),
  ]).then(([whiteTitle, blackTitle]) => {
    if (whiteTitle) {
      _sendToUser(game.white.id, { type: 'title_granted', title: whiteTitle });
      console.log(`✓ Platform title ${whiteTitle} auto-granted to ${game.white.username}`);
    }
    if (blackTitle) {
      _sendToUser(game.black.id, { type: 'title_granted', title: blackTitle });
      console.log(`✓ Platform title ${blackTitle} auto-granted to ${game.black.username}`);
    }
  }).catch(console.error);

  // Tournament hook — use pointsFromReason to detect aborted/zero-point games
  if (game.tournamentId) {
    const winnerColor = winnerId === game.white.id ? 'white'
                      : winnerId === game.black.id ? 'black' : null;
    const pts = pointsFromReason(reason, winnerColor);
    const effectiveResult = (pts.white === Points.Zero && pts.black === Points.Zero)
      ? 'aborted'
      : result;
    tournament.onGameEnd(game.tournamentId, game.id, effectiveResult).catch(console.error);
  }
}

module.exports = { init, startGame, endGame };
