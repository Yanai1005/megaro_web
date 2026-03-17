'use strict';

const { ensureTable } = require('../lib/tableClient');

/** @param {import('@azure/functions').Context} context */
module.exports = async function (context, req) {
  const roomCode = (req.params.code ?? '').toUpperCase();
  if (!roomCode) {
    context.res = { status: 400, body: JSON.stringify({ error: 'code is required' }) };
    return;
  }

  const roomsTable = await ensureTable('rooms');
  let room;
  try {
    room = await roomsTable.getEntity('rooms', roomCode);
  } catch {
    context.res = { status: 404, body: JSON.stringify({ error: 'Room not found' }) };
    return;
  }

  const gamesTable = await ensureTable('games');
  let game = null;
  try {
    game = await gamesTable.getEntity('games', roomCode);
  } catch { /* not started yet */ }

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: room.status,
      player1Name: room.player1Name,
      player2Name: room.player2Name,
      currentPlayer: game ? Number(game.currentPlayer) : 1,
      expectedChar: game?.expectedChar ?? '',
      challengeBf: game?.challengeBf ?? '',
      history: game ? JSON.parse(game.history || '[]') : [],
      usedWords: game ? JSON.parse(game.usedWords || '[]') : [],
      losingPlayer: game?.losingPlayer ?? null,
      lossReason: game?.lossReason ?? '',
    }),
  };
};
