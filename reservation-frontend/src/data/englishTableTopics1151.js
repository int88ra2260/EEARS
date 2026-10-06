/**
 * 115-1 English Table 主題與題目（依場次日期）。
 * 來源：115-1 English Table Topics。週二、週三的圖表在活動現場使用，此處只保留主題與文字題目。
 */

import sessions from './englishTableTopics1151.json';

const SESSIONS = sessions;

export const ENGLISH_TABLE_TOPIC_SEMESTER = '115-1';

export function getEnglishTableWarmupTaskKey(dateInput, questionIndex = 0) {
  const key = normalizeEnglishTableTopicDate(dateInput);
  const index = Number(questionIndex);
  if (!key || !Number.isInteger(index) || index < 0) return '';
  return `et-${ENGLISH_TABLE_TOPIC_SEMESTER.toLowerCase()}-${key.replace(/-/g, '')}-q${index + 1}`;
}

export function normalizeEnglishTableTopicDate(value) {
  if (!value) return '';
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slash) {
    return `${slash[1]}-${slash[2].padStart(2, '0')}-${slash[3].padStart(2, '0')}`;
  }
  return '';
}

export function getEnglishTableTopic(dateInput) {
  const key = normalizeEnglishTableTopicDate(dateInput);
  if (!key) return null;
  return SESSIONS[key] || null;
}

export function listEnglishTableTopicDates() {
  return Object.keys(SESSIONS);
}

export function listEnglishTableTopics() {
  return Object.entries(SESSIONS)
    .map(([date, session]) => ({ date, ...session }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function listEnglishTableWarmupLinks(dateInput) {
  const date = normalizeEnglishTableTopicDate(dateInput);
  const session = getEnglishTableTopic(date);
  if (!date || !session?.questions?.length) return [];
  return session.questions.map((question, index) => ({
    date,
    question,
    questionNumber: index + 1,
    taskKey: getEnglishTableWarmupTaskKey(date, index),
    href: `/practice/speaking-diagnostic?source=english-table&taskKey=${encodeURIComponent(getEnglishTableWarmupTaskKey(date, index))}`,
  }));
}
