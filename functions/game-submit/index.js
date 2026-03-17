'use strict';

const { ensureTable } = require('../lib/tableClient');
const { analyzeText } = require('../lib/yahooAnalyze');
const {
  getReadingFromTokens,
  isValidSiritoriWordFromTokens,
  isKnownWordFromTokens,
  isJapaneseFromTokens,
} = require('../lib/kana');
const { compile } = require('../lib/bf');

const chars = (s) => [...s];
const firstChar = (s) => chars(s)[0] ?? '';
const lastChar = (s) => { const c = chars(s); return c[c.length - 1] ?? ''; };
const wordBody = (w) => w.match(/^([^(（]+)/)?.[1]?.trimEnd() ?? w;
const isHiragana = (c) => { const cp = c.codePointAt(0) ?? 0; return cp >= 0x3041 && cp <= 0x309e; };

/** @param {import('@azure/functions').Context} context */
module.exports = async function (context, req) {
  const { roomCode, playerId, word: rawWord } = req.body ?? {};
  if (!roomCode || !playerId || !rawWord) {
    context.res = { status: 400, body: JSON.stringify({ error: 'roomCode, playerId, word are required' }) };
    return;
  }

  const code = roomCode.toUpperCase();

  // ── ルーム・ゲーム状態を取得 ──────────────────────────────────
  const roomsTable = await ensureTable('rooms');
  const gamesTable = await ensureTable('games');

  let room;
  try { room = await roomsTable.getEntity('rooms', code); }
  catch { context.res = { status: 404, body: JSON.stringify({ error: 'Room not found' }) }; return; }

  if (room.status !== 'playing') {
    context.res = { status: 409, body: JSON.stringify({ error: 'Game is not in progress' }) }; return;
  }

  // ── ゲーム状態を取得（初回はデフォルト） ──────────────────────
  let game = null;
  try { game = await gamesTable.getEntity('games', code); }
  catch { /* 初回ターン */ }

  const currentPlayer = game ? Number(game.currentPlayer) : 1;
  const expectedChar = game?.expectedChar ?? '';
  const history = game ? JSON.parse(game.history || '[]') : [];
  const usedWords = new Set(game ? JSON.parse(game.usedWords || '[]') : []);

  // ── ターン権限チェック ────────────────────────────────────────
  const playerSlot = room.player1Id === playerId ? 1 : room.player2Id === playerId ? 2 : null;
  if (playerSlot === null) {
    context.res = { status: 403, body: JSON.stringify({ error: 'Not a player in this room' }) }; return;
  }
  if (playerSlot !== currentPlayer) {
    context.res = { status: 409, body: JSON.stringify({ error: 'Not your turn' }) }; return;
  }

  // ── 単語バリデーション ────────────────────────────────────────
  const word = rawWord.trim();
  if (!word) {
    context.res = { status: 422, body: JSON.stringify({ error: '単語を入力してください' }) }; return;
  }

  const manual = word.match(/[(（]([ぁ-ん]+)[)）]$/);
  const body = wordBody(word);
  if ([...body].length < 2) {
    context.res = { status: 422, body: JSON.stringify({ error: '2文字以上の単語を入力してください' }) }; return;
  }

  let tokens;
  try { tokens = await analyzeText(body); }
  catch {
    context.res = { status: 502, body: JSON.stringify({ error: '解析に失敗しました。もう一度お試しください' }) }; return;
  }

  const reading = manual ? manual[1] : getReadingFromTokens(tokens);

  if (!isJapaneseFromTokens(tokens)) {
    context.res = { status: 422, body: JSON.stringify({ error: '日本語の単語を入力してください' }) }; return;
  }
  if (!isValidSiritoriWordFromTokens(tokens)) {
    context.res = { status: 422, body: JSON.stringify({ error: '文章は使えません。単語を入力してください' }) }; return;
  }
  if (!manual && !isKnownWordFromTokens(tokens)) {
    context.res = { status: 422, body: JSON.stringify({ error: '辞書に見つかりません。実在する単語か「単語(よみ)」の形で入力してください' }) }; return;
  }
  if (expectedChar && firstChar(reading) !== expectedChar) {
    context.res = { status: 422, body: JSON.stringify({ error: `Brainfuck を解読すると… 「${expectedChar}」から始まる単語を入力してください` }) }; return;
  }

  const turn = { player: currentPlayer, word, reading };
  const newHistory = [...history, turn];

  // ── 使用済み単語チェック ──────────────────────────────────────
  if (usedWords.has(body)) {
    await saveGameOver(gamesTable, code, game, currentPlayer, newHistory, usedWords, `「${body}」はすでに使われた単語です`, currentPlayer);
    await roomsTable.updateEntity({ partitionKey: 'rooms', rowKey: code, status: 'finished' }, 'Merge');
    context.bindings.signalRMessages = [{
      target: 'gameOver',
      groupName: code,
      arguments: [{ losingPlayer: currentPlayer, lossReason: `「${body}」はすでに使われた単語です`, finalHistory: newHistory }],
    }];
    context.res = { status: 200, body: JSON.stringify({ result: 'gameOver' }) };
    return;
  }

  const last = lastChar(reading);
  if (!isHiragana(last)) {
    context.res = { status: 422, body: JSON.stringify({ error: '読みを取得できませんでした。「東京(とうきょう)」のように括弧で読みを付けてください' }) }; return;
  }

  // ── ん チェック ───────────────────────────────────────────────
  if (last === 'ん') {
    await saveGameOver(gamesTable, code, game, currentPlayer, newHistory, usedWords, `「${reading}」で終わる単語を言いました`, currentPlayer);
    await roomsTable.updateEntity({ partitionKey: 'rooms', rowKey: code, status: 'finished' }, 'Merge');
    context.bindings.signalRMessages = [{
      target: 'gameOver',
      groupName: code,
      arguments: [{ losingPlayer: currentPlayer, lossReason: `「${reading}」で終わる単語を言いました`, finalHistory: newHistory }],
    }];
    context.res = { status: 200, body: JSON.stringify({ result: 'gameOver' }) };
    return;
  }

  // ── 正常ターン処理 ────────────────────────────────────────────
  const nextPlayer = currentPlayer === 1 ? 2 : 1;
  const newChallengeBf = compile(last);
  const newUsedWords = [...usedWords, body];

  const gameEntity = {
    partitionKey: 'games',
    rowKey: code,
    currentPlayer: String(nextPlayer),
    expectedChar: last,
    challengeBf: newChallengeBf,
    history: JSON.stringify(newHistory),
    usedWords: JSON.stringify(newUsedWords),
  };

  if (game) {
    await gamesTable.updateEntity(gameEntity, 'Replace');
  } else {
    await gamesTable.createEntity(gameEntity);
  }

  context.bindings.signalRMessages = [{
    target: 'turnPlayed',
    groupName: code,
    arguments: [{
      turn,
      nextPlayer,
      expectedChar: last,
      challengeBf: newChallengeBf,
      round: newHistory.length + 1,
    }],
  }];

  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result: 'ok', nextPlayer, challengeBf: newChallengeBf }),
  };
};

async function saveGameOver(gamesTable, code, existingGame, losingPlayer, history, usedWords, lossReason) {
  const entity = {
    partitionKey: 'games',
    rowKey: code,
    currentPlayer: String(losingPlayer),
    expectedChar: '',
    challengeBf: '',
    history: JSON.stringify(history),
    usedWords: JSON.stringify([...usedWords]),
    losingPlayer: String(losingPlayer),
    lossReason,
    finishedAt: new Date().toISOString(),
  };
  if (existingGame) {
    await gamesTable.updateEntity(entity, 'Replace');
  } else {
    await gamesTable.createEntity(entity);
  }
}
