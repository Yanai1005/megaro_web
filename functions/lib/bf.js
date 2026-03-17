'use strict';

// MoonBit bf_moon.mbt のJSポート (CommonJS)

/** @param {string} c @param {number} n @returns {string} */
function repeatChar(c, n) {
  return c.repeat(n);
}

/** @param {string} c @returns {number[]} UTF-8 bytes */
function charToUtf8(c) {
  const cp = c.codePointAt(0);
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xC0 | (cp >> 6), 0x80 | (cp & 0x3F)];
  if (cp < 0x10000) return [0xE0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F)];
  return [
    0xF0 | (cp >> 18),
    0x80 | ((cp >> 12) & 0x3F),
    0x80 | ((cp >> 6) & 0x3F),
    0x80 | (cp & 0x3F),
  ];
}

/** @param {string} s @returns {number[]} */
function stringToBytes(s) {
  const result = [];
  for (const c of s) {
    for (const b of charToUtf8(c)) result.push(b);
  }
  return result;
}

/** @param {number} n @returns {[number, string]} */
function bestFromZero(n) {
  if (n === 0) return [0, ''];
  const directCost = n <= 128 ? n : 256 - n;
  const directCode = n <= 128 ? repeatChar('+', n) : repeatChar('-', 256 - n);
  let bestCost = directCost;
  let bestCode = directCode;
  for (let a = 2; a < 17; a++) {
    for (let db = 0; db < 2; db++) {
      const b = Math.floor(n / a) + db;
      if (b > 0) {
        const r = n - a * b;
        const absR = r >= 0 ? r : -r;
        const cost = a + b + 7 + absR;
        if (cost < bestCost) {
          bestCost = cost;
          const adj = r > 0 ? repeatChar('+', r) : r < 0 ? repeatChar('-', -r) : '';
          bestCode = '>' + repeatChar('+', a) + '[<' + repeatChar('+', b) + '>-]<' + adj;
        }
      }
    }
  }
  return [bestCost, bestCode];
}

/** @param {number} target @param {number} current @returns {string} */
function genByte(target, current) {
  const forward = (target - current + 256) % 256;
  const backward = (current - target + 256) % 256;
  const deltaCost = forward <= backward ? forward : backward;
  const deltaCode = forward <= backward ? repeatChar('+', forward) : repeatChar('-', backward);
  const [zeroCost, zeroCode] = bestFromZero(target);
  const resetCost = current === 0 ? 0 : 3;
  const resetCode = current === 0 ? '' : '[-]';
  const strat2Cost = resetCost + zeroCost;
  const strat2Code = resetCode + zeroCode;
  return (deltaCost <= strat2Cost ? deltaCode : strat2Code) + '.';
}

/**
 * ひらがな1文字をBrainfuckコードにコンパイルする
 * @param {string} input
 * @returns {string}
 */
function compile(input) {
  const bytes = stringToBytes(input);
  let code = '';
  let current = 0;
  for (const b of bytes) {
    code += genByte(b, current);
    current = b;
  }
  return code;
}

/**
 * Brainfuckコードを実行して出力文字列を返す
 * @param {string} code
 * @returns {string}
 */
function execute(code) {
  const mem = new Uint8Array(30000);
  const codeLen = code.length;

  // [ のジャンプ先を事前計算
  const jumps = new Int32Array(codeLen).fill(-1);
  const stack = [];
  for (let i = 0; i < codeLen; i++) {
    const c = code.charCodeAt(i);
    if (c === 91) {
      stack.push(i);
    } else if (c === 93) {
      if (stack.length > 0) {
        const open = stack.pop();
        jumps[open] = i;
        jumps[i] = open;
      }
    }
  }

  const outBytes = [];
  let ptr = 0;
  let ip = 0;
  const maxSteps = 1000000;
  let steps = 0;

  while (ip < codeLen && steps < maxSteps) {
    const c = code.charCodeAt(ip);
    if (c === 43) mem[ptr] = (mem[ptr] + 1) % 256;          // '+'
    else if (c === 45) mem[ptr] = (mem[ptr] + 255) % 256;   // '-'
    else if (c === 62) ptr = (ptr + 1) % 30000;              // '>'
    else if (c === 60) ptr = (ptr + 29999) % 30000;          // '<'
    else if (c === 46) outBytes.push(mem[ptr]);              // '.'
    else if (c === 91) { if (mem[ptr] === 0) ip = jumps[ip]; }  // '['
    else if (c === 93) { if (mem[ptr] !== 0) ip = jumps[ip]; }  // ']'
    ip++;
    steps++;
  }

  return new TextDecoder('utf-8').decode(new Uint8Array(outBytes));
}

module.exports = { compile, execute };
