'use strict';

const { randomUUID } = require('crypto');
const { ensureTable } = require('../lib/tableClient');
const { generateRoomCode } = require('../lib/roomCode');

/** @param {import('@azure/functions').Context} context */
module.exports = async function (context, req) {
  const playerName = req.body?.playerName;
  if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
    context.res = { status: 400, body: JSON.stringify({ error: 'playerName is required' }) };
    return;
  }

  const roomCode = generateRoomCode();
  const player1Id = randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const roomsTable = await ensureTable('rooms');
  await roomsTable.createEntity({
    partitionKey: 'rooms',
    rowKey: roomCode,
    status: 'waiting',
    player1Id,
    player2Id: '',
    player1Name: playerName.trim(),
    player2Name: '',
    expiresAt,
  });

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomCode, playerId: player1Id, playerSlot: 1 }),
  };
};
