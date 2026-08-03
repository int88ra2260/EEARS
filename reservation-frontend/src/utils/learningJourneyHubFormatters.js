export const EMPTY = '—';
export const HISTORY_KEY = 'learning-journey-v3-history';
export const TAB_IDS = ['student', 'overview', 'students', 'diagnostics'];
export const SKILL_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
};
export const SKILL_KEYS = Object.keys(SKILL_LABELS);

export function pickDefaultSemesterId(list, fallback = '114-1') {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  const active = list.find((s) => s && s.isActive === true);
  return String((active || list[0]).id || (active || list[0]).code || fallback);
}

export function fmtRate(value) {
  if (value == null) return EMPTY;
  const n = Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  return `${(Math.max(0, Math.min(1, n)) * 100).toFixed(1)}%`;
}

export function text(value) {
  if (value === null || value === undefined || value === '') return EMPTY;
  return String(value);
}

export function formatDate(value) {
  if (!value) return EMPTY;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('zh-TW', { hour12: false });
}

export function buildSkillMap(skillScores = []) {
  const map = { listening: null, reading: null, speaking: null, writing: null };
  skillScores.forEach((score) => {
    const key = String(score?.skill || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      map[key] = score;
    }
  });
  return map;
}

export function getAttemptSkillText(skillScore) {
  if (!skillScore) return EMPTY;
  const raw = skillScore.rawScore ?? skillScore.score ?? EMPTY;
  const cefr = skillScore.cefr || skillScore.cefrLevel || EMPTY;
  return `${raw} / ${cefr}`;
}

export function getReadableError(error, fallback) {
  const message = String(error?.message || fallback || '資料取得失敗，請稍後再試。');
  return message.replace(/（Request-ID:.*?）/g, '').trim();
}
