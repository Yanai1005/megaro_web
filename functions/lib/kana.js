'use strict';

/** カタカナ→ひらがな変換 */
function toHiragana(text) {
  return text.replace(/[\u30A1-\u30F6]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}

/** トークン配列からひらがな読みを取得 */
function getReadingFromTokens(tokens) {
  return toHiragana(tokens.map((t) => t[1] ?? t[0]).join(''));
}

const INVALID_POS = new Set(['助詞', '助動詞', '記号', '接続詞', '連体詞', '形容詞', '形容動詞', '副詞', '感動詞', 'フィラー', 'その他']);

/** しりとりに使える単語か（文章でないか）チェック */
function isValidSiritoriWordFromTokens(tokens) {
  if (tokens.length === 0) return false;
  return !tokens.some((t) =>
    (t.length > 3 && INVALID_POS.has(t[3])) ||
    (t.length > 4 && t[4] === '接尾')
  );
}

/** 辞書に存在するか（単一トークンで読みがある）チェック */
function isKnownWordFromTokens(tokens) {
  if (tokens.length !== 1) return false;
  return tokens[0][1] != null && tokens[0][1] !== '';
}

/** 日本語（ひらがな・カタカナ・漢字）を含む単語か確認 */
const JAPANESE_RE = /[\u3041-\u309E\u30A1-\u30F4\u4E00-\u9FBF]/;

function isJapaneseFromTokens(tokens) {
  if (tokens.length === 0) return false;
  return tokens.some((t) => JAPANESE_RE.test(t[0]));
}

module.exports = {
  toHiragana,
  getReadingFromTokens,
  isValidSiritoriWordFromTokens,
  isKnownWordFromTokens,
  isJapaneseFromTokens,
};
