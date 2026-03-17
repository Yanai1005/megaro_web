'use strict';

/**
 * Yahoo! JLP Morphological Analysis API を呼び出す
 * @param {string} q
 * @returns {Promise<string[][]>} tokens
 */
async function analyzeText(q) {
  const res = await fetch('https://jlp.yahooapis.jp/MAService/V2/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `Yahoo AppID: ${process.env.YAHOO_APP_ID}`,
    },
    body: JSON.stringify({
      id: '1',
      jsonrpc: '2.0',
      method: 'jlp.maservice.parse',
      params: { q },
    }),
  });

  if (!res.ok) throw new Error(`Yahoo API error: ${res.status}`);
  const data = await res.json();
  return data.result?.tokens ?? [];
}

module.exports = { analyzeText };
