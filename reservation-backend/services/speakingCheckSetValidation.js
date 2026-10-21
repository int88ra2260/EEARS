const MIN_ITEMS = 2;
const MAX_ITEMS = 8;
const MIN_TEXT = 8;
const MAX_TEXT = 500;

function fail(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function cleanLine(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function parseSetItems(items) {
  if (!Array.isArray(items)) throw fail(400, 'SET_ITEMS_REQUIRED', '請加入題目');
  return items.map((item, index) => ({
    title: cleanLine(item?.title, 40) || `第 ${index + 1} 題`,
    targetText: cleanLine(item?.targetText, MAX_TEXT + 1),
  })).filter((item) => item.targetText);
}

function assertPublishableSet(items) {
  const parsed = parseSetItems(items);
  if (parsed.length < MIN_ITEMS) {
    throw fail(400, 'SET_TOO_SMALL', '題組至少要有 2 題');
  }
  if (parsed.length > MAX_ITEMS) {
    throw fail(400, 'SET_TOO_LARGE', `題組最多 ${MAX_ITEMS} 題`);
  }
  parsed.forEach((item, index) => {
    if (item.targetText.length < MIN_TEXT) {
      throw fail(400, 'ITEM_TEXT_TOO_SHORT', `第 ${index + 1} 題太短，請寫一句完整的英文`);
    }
    if (item.targetText.length > MAX_TEXT) {
      throw fail(400, 'ITEM_TEXT_TOO_LONG', `第 ${index + 1} 題請控制在 ${MAX_TEXT} 字以內`);
    }
  });
  return parsed.map((item, index) => ({
    targetText: item.targetText,
    title: item.title && !/^第 \d+ 題$/.test(item.title) ? item.title : `第 ${index + 1} 題`,
  }));
}

function normalizeJoinCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 6);
}

function normalizeDisplayName(value) {
  const name = cleanLine(value, 30);
  if (name.length < 1) throw fail(400, 'DISPLAY_NAME_REQUIRED', '請填你的名字，同學之間才分得出來');
  return name;
}

function normalizeSetTitle(value) {
  return cleanLine(value, 80) || '未命名題組';
}

module.exports = {
  MIN_ITEMS,
  MAX_ITEMS,
  fail,
  parseSetItems,
  assertPublishableSet,
  normalizeJoinCode,
  normalizeDisplayName,
  normalizeSetTitle,
};
