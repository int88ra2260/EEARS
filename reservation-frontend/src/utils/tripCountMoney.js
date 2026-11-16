export function parseTwdToCents(input) {
  const text = String(input ?? '').trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number((`${frac}00`).slice(0, 2));
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export function formatTwd(cents) {
  const value = Number(cents) || 0;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(value));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole.toLocaleString('zh-TW')}.${frac}`;
}

/** 把分轉成表單可填的金額字串（例如 110450 → "1104.50"） */
export function centsToInput(cents) {
  const abs = Math.abs(Math.trunc(Number(cents) || 0));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0')}`;
}
