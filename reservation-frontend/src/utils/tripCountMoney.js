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
