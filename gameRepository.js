/**
 * gameRepository.js — Single Responsibility: game data persistence
 *
 * Owns:
 *  - All SQL queries related to games, moves, and player stats
 *
 * Does NOT know about: WebSockets, chess rules, matchmaking, ELO logic
 */

const { query } = require('../config/database');

async function insertGame({ whiteId, blackId, timeControl, gameType, timeMs }) {
  const { rows } = await query(
    `INSERT INTO games (white_id, black_id, time_control, game_type, white_time_ms, black_time_ms, status)
     VALUES ($1, $2, $3, $4, $5, $5, 'active')
     RETURNING id`,
    [whiteId, blackId, timeControl, gameType, timeMs]
  );
  return rows[0].id;
}

async function insertMove({ gameId, moveNum, player, san, uci, fenAfter, timeSpentMs }) {
  await query(
    `INSERT INTO moves (game_id, move_num, player, san, uci, fen_after, time_spent_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [gameId, moveNum, player, san, uci, fenAfter, timeSpentMs]
  );
}

async function finaliseGame({ gameId, result, winnerId, pgn, moveCount }) {
  await query(
    `UPDATE games SET status='finished', result=$1, winner_id=$2, pgn=$3,
            move_count=$4, ended_at=NOW()
     WHERE id = $5`,
    [result, winnerId, pgn, moveCount, gameId]
  );
}

async function abortGame(gameId) {
  await query(`UPDATE games SET status = 'aborted' WHERE id = $1`, [gameId]);
}

async function getPlayers(whiteId, blackId) {
  const { rows } = await query(
    'SELECT id, rating, games_played, fide_title, platform_title FROM users WHERE id = ANY($1)',
    [[whiteId, blackId]]
  );
  return rows;
}

async function updatePlayerStats({ userId, newRating, won, drawn }) {
  await query(
    `UPDATE users SET
       rating       = $1,
       games_played = games_played + 1,
       games_won    = games_won    + $2,
       games_drawn  = games_drawn  + $3
     WHERE id = $4`,
    [newRating, won ? 1 : 0, drawn ? 1 : 0, userId]
  );
}

async function getUserById(userId) {
  const { rows } = await query(
    'SELECT id, username, rating, fide_title, platform_title FROM users WHERE id = $1',
    [userId]
  );
  return rows[0] ?? null;
}

module.exports = {
  insertGame,
  insertMove,
  finaliseGame,
  abortGame,
  getPlayers,
  updatePlayerStats,
  getUserById,
};
