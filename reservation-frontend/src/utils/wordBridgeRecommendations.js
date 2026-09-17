import { computeWordBridgeResult } from '../data/wordBridgePuzzles';
import { WRITING_WORKSHOP_URL } from '../constants/activityCatalog';

export const WRITING_WORKSHOP_KEY = 'writing-workshop';

/** @type {{ density: 'high' | 'balanced' | 'low', focus: 'speaking' | 'balanced' | 'writing' }} */
export const DEFAULT_WORD_BRIDGE_PREFERENCES = {
  density: 'balanced',
  focus: 'balanced',
};

/**
 * @typedef {{ density: 'high' | 'balanced' | 'low', focus: 'speaking' | 'balanced' | 'writing' }} WordBridgeStylePreferences
 */

function scorePreferenceActivities(preferences) {
  const scores = new Map();
  const add = (key, weight) => {
    scores.set(key, (scores.get(key) || 0) + weight);
  };

  if (preferences.density === 'high') {
    add('english-club', 5);
    add('job-talk', 3);
  } else if (preferences.density === 'low') {
    add('english-table', 6);
  } else {
    add('english-table', 3);
    add('english-club', 3);
    add('job-talk', 2);
  }

  if (preferences.focus === 'speaking') {
    add('english-club', 6);
    add('english-table', 4);
    add('job-talk', 2);
  } else if (preferences.focus === 'writing') {
    add(WRITING_WORKSHOP_KEY, 10);
    add('job-talk', 4);
  } else {
    add('english-club', 2);
    add('english-table', 2);
    add('job-talk', 2);
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
    .slice(0, 4);
}

/**
 * 僅依學習偏好產生活動建議（與 CEFR 推估並列，不寫入後端）。
 * @param {WordBridgeStylePreferences | null} preferences
 */
export function buildPreferenceRecommendations(preferences = DEFAULT_WORD_BRIDGE_PREFERENCES) {
  const activities = scorePreferenceActivities(preferences || DEFAULT_WORD_BRIDGE_PREFERENCES);
  return { activities };
}

/**
 * 合併 CEFR 推估與學習偏好（向後相容；新 UI 請分開呼叫 computeWordBridgeResult 與 buildPreferenceRecommendations）。
 * @param {object} summary - useWordBridgeGame 的 gameSummary
 * @param {WordBridgeStylePreferences | null} preferences
 */
export function buildWordBridgeRecommendations(summary, preferences = null) {
  const base = computeWordBridgeResult(summary);
  if (!preferences) {
    return base;
  }

  const preferenceActivities = buildPreferenceRecommendations(preferences).activities;
  const merged = [...new Set([...base.activities, ...preferenceActivities])].slice(0, 4);

  return {
    ...base,
    activities: merged.length ? merged : base.activities,
  };
}

export function isExternalRecommendation(key) {
  return key === WRITING_WORKSHOP_KEY;
}

export function getExternalRecommendationUrl(key) {
  if (key === WRITING_WORKSHOP_KEY) return WRITING_WORKSHOP_URL;
  return null;
}

/** @param {string} estimatedLevel CEFR A1–C2 */
export function getActivityKeysForCefrLevel(estimatedLevel) {
  if (estimatedLevel === 'A1') return ['english-table'];
  if (estimatedLevel === 'A2') return ['english-table', 'english-club'];
  if (estimatedLevel === 'B1') return ['english-club', 'english-table', 'job-talk'];
  if (estimatedLevel === 'B2') return ['job-talk', 'english-club', 'english-table'];
  return ['job-talk', 'english-club', 'english-table'];
}

const ACTIVITY_TITLE_KEYS = {
  'english-table': 'activities.englishTable',
  'english-club': 'activities.englishClub',
  'job-talk': 'activities.jobTalk',
};

/** @param {string} estimatedLevel */
export function getRecommendedActivitiesForLevel(estimatedLevel) {
  return getActivityKeysForCefrLevel(estimatedLevel).map((key) => ({
    key,
    labelKey: ACTIVITY_TITLE_KEYS[key] || key,
  }));
}
