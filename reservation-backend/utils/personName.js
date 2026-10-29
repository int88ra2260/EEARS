'use strict';

/**
 * 姓名比對用正規化。
 * 名冊匯入常在漢字之間插入空白（例如兩個字的「杜 威」），
 * 與學生自行填寫的「杜威」應視為同一人。
 * 英文姓名保留單字之間的空白，只摺疊連續空白。
 */

function compactPersonName(value) {
  const text = String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  return text.replace(/([\u3400-\u9FFF\uF900-\uFAFF])\s+(?=[\u3400-\u9FFF\uF900-\uFAFF])/g, '$1');
}

function normalizePersonName(value) {
  return compactPersonName(value).toLowerCase();
}

function personNamesMatch(left, right) {
  return normalizePersonName(left) === normalizePersonName(right);
}

module.exports = {
  compactPersonName,
  normalizePersonName,
  personNamesMatch,
};
