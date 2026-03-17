'use strict';

/**
 * SignalR のクライアントをルームグループに追加する。
 * フロントエンドは SignalR 接続確立後にこのエンドポイントを呼び出す。
 * @param {import('@azure/functions').Context} context
 */
module.exports = async function (context, req) {
  const { connectionId, roomCode } = req.body ?? {};
  if (!connectionId || !roomCode) {
    context.res = { status: 400, body: JSON.stringify({ error: 'connectionId and roomCode are required' }) };
    return;
  }

  context.bindings.signalRMessages = [
    {
      connectionId,
      groupName: roomCode.toUpperCase(),
      action: 'add',
    },
  ];

  context.res = { status: 200, body: JSON.stringify({ ok: true }) };
};
