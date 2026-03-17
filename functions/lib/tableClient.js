'use strict';

const { TableClient } = require('@azure/data-tables');

const connStr = process.env.AzureWebJobsStorage;

/** @param {string} tableName */
function getTableClient(tableName) {
  return TableClient.fromConnectionString(connStr, tableName);
}

/**
 * テーブルが存在しなければ作成する（初回のみ）
 * @param {string} tableName
 */
async function ensureTable(tableName) {
  const client = getTableClient(tableName);
  try {
    await client.createTable();
  } catch (e) {
    // TableAlreadyExists は無視
    if (e.statusCode !== 409) throw e;
  }
  return client;
}

module.exports = { getTableClient, ensureTable };
