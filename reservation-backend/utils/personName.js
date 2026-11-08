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

/**
 * 單一入口回傳的姓名。比自行填寫的表單多接受：
 * 擴充區漢字，以及校園造字用的私人使用區（U+E000–U+F8FF）。
 * 不含數字、@、句點，避免學號或信箱被分號拆錯欄後當成姓名。
 */
const campusPersonNameRegex = /^[\p{Script=Han}A-Za-z\uE000-\uF8FF][\p{Script=Han}A-Za-z\uE000-\uF8FF\s·・'’ʼ-]*$/u;

function isCampusPersonName(value) {
  const name = compactPersonName(value);
  return name.length > 0 && name.length <= 100 && campusPersonNameRegex.test(name);
}

module.exports = {
  compactPersonName,
  normalizePersonName,
  personNamesMatch,
  isCampusPersonName,
};
