'use strict';

const { randomUUID } = require('crypto');
const { ensureTable } = require('../lib/tableClient');

/** @param {import('@azure/functions').Context} context */
module.exports = async function (context, req) {
  const { roomCode, playerName } = req.body ?? {};
  if (!roomCode || !playerName) {
    context.res = { status: 400, body: JSON.stringify({ error: 'roomCode and playerName are required' }) };
    return;
  }

  const roomsTable = await ensureTable('rooms');
  let room;
  try {
    room = await roomsTable.getEntity('rooms', roomCode.toUpperCase());
  } catch {
    context.res = { status: 404, body: JSON.stringify({ error: 'Room not found' }) };
    return;
  }

  if (room.status === 'finished') {
    context.res = { status: 410, body: JSON.stringify({ error: 'Room is finished' }) };
    return;
  }

  // Spectator join (room already has 2 players or is playing)
  if (room.status === 'playing' || (room.player2Id && room.player2Id !== '')) {
    // Spectatorとして参加 — ゲーム状態を返すだけ
    const gamesTable = await ensureTable('games');
    let gameState = null;
    try {
      gameState = await gamesTable.getEntity('games', roomCode.toUpperCase());
    } catch { /* no game started yet */ }

    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerSlot: 'spectator',
        roomCode: roomCode.toUpperCase(),
        roomState: buildRoomState(room, gameState),
      }),
    };
    return;
  }

  // Player 2 join
  const player2Id = randomUUID();
  await roomsTable.updateEntity({
    partitionKey: 'rooms',
    rowKey: roomCode.toUpperCase(),
    status: 'playing',
    player2Id,
    player2Name: playerName.trim(),
  }, 'Merge');

  const updatedRoom = await roomsTable.getEntity('rooms', roomCode.toUpperCase());

  // Broadcast gameStarted to room group
  context.bindings.signalRMessages = [
    {
      target: 'gameStarted',
      groupName: roomCode.toUpperCase(),
      arguments: [{
        player1Name: updatedRoom.player1Name,
        player2Name: updatedRoom.player2Name,
        currentPlayer: 1,
      }],
    },
  ];

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      playerSlot: 2,
      playerId: player2Id,
      roomCode: roomCode.toUpperCase(),
      roomState: buildRoomState(updatedRoom, null),
    }),
  };
};

function buildRoomState(room, game) {
  return {
    status: room.status,
    player1Name: room.player1Name,
    player2Name: room.player2Name,
    currentPlayer: game ? Number(game.currentPlayer) : 1,
    expectedChar: game?.expectedChar ?? '',
    challengeBf: game?.challengeBf ?? '',
    history: game ? JSON.parse(game.history || '[]') : [],
    usedWords: game ? JSON.parse(game.usedWords || '[]') : [],
  };
}
