const STORAGE_KEY = 'eears-speaking-portfolio-v1';
const EVENT_NAME = 'eears-speaking-portfolio-updated';

function nowIso() {
  return new Date().toISOString();
}

function safeId(prefix = 'sp') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStore(value) {
  return {
    cards: Array.isArray(value?.cards) ? value.cards : [],
    attempts: Array.isArray(value?.attempts) ? value.attempts : [],
  };
}

export function loadSpeakingPortfolio() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return normalizeStore(parsed);
  } catch {
    return normalizeStore({});
  }
}

function saveStore(next) {
  const normalized = normalizeStore(next);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: normalized }));
  return normalized;
}

export function subscribeSpeakingPortfolio(listener) {
  const handler = () => listener(loadSpeakingPortfolio());
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}

export function saveSpeakingPortfolioCard(card) {
  const store = loadSpeakingPortfolio();
  const stableKey = card.stableKey || `${card.type || 'card'}:${card.source || ''}:${card.title || ''}:${card.prompt || ''}`;
  const existingIndex = store.cards.findIndex((item) => item.stableKey === stableKey);
  const nextCard = {
    id: existingIndex >= 0 ? store.cards[existingIndex].id : safeId('card'),
    stableKey,
    type: card.type || 'guide',
    source: card.source || 'Speaking',
    title: card.title || 'Speaking card',
    prompt: card.prompt || '',
    sample: card.sample || '',
    level: card.level || '',
    tags: Array.isArray(card.tags) ? card.tags.slice(0, 12) : [],
    href: card.href || '',
    createdAt: existingIndex >= 0 ? store.cards[existingIndex].createdAt : nowIso(),
    updatedAt: nowIso(),
  };
  const cards = existingIndex >= 0
    ? store.cards.map((item, index) => (index === existingIndex ? nextCard : item))
    : [nextCard, ...store.cards].slice(0, 120);
  return saveStore({ ...store, cards });
}

export function saveSpeakingPortfolioAttempt(attempt) {
  if (!attempt?.attemptUid) return loadSpeakingPortfolio();
  const store = loadSpeakingPortfolio();
  const existingIndex = store.attempts.findIndex((item) => item.attemptUid === attempt.attemptUid);
  const nextAttempt = {
    attemptUid: attempt.attemptUid,
    taskKey: attempt.taskKey || '',
    title: attempt.title || 'Speaking practice',
    source: attempt.source || 'Speaking',
    activityPhase: attempt.activityPhase || 'diagnostic',
    submittedAt: attempt.submittedAt || nowIso(),
    overallPercent: attempt.overallPercent ?? null,
    fluencyPercent: attempt.fluencyPercent ?? null,
    vocabularyPercent: attempt.vocabularyPercent ?? null,
    taskAchievementPercent: attempt.taskAchievementPercent ?? null,
    ideaDevelopmentPercent: attempt.ideaDevelopmentPercent ?? null,
    transcriptWordCount: attempt.transcriptWordCount ?? null,
    speechRateWpm: attempt.speechRateWpm ?? null,
    advice: attempt.advice || '',
    href: attempt.href || '',
  };
  const attempts = existingIndex >= 0
    ? store.attempts.map((item, index) => (index === existingIndex ? nextAttempt : item))
    : [nextAttempt, ...store.attempts].slice(0, 160);
  return saveStore({ ...store, attempts });
}

export function removeSpeakingPortfolioCard(id) {
  const store = loadSpeakingPortfolio();
  return saveStore({ ...store, cards: store.cards.filter((item) => item.id !== id) });
}

export function clearSpeakingPortfolio() {
  return saveStore({ cards: [], attempts: [] });
}
