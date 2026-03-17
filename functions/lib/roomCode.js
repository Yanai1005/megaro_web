'use strict';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** @returns {string} 6文字のランダムルームコード */
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

module.exports = { generateRoomCode };
