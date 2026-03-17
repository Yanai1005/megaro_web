'use strict';

/** @param {import('@azure/functions').Context} context */
module.exports = async function (context, req, connectionInfo) {
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(connectionInfo),
  };
};
