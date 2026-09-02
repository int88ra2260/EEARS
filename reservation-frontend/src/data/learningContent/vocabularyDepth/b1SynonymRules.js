/**
 * B1 同義／語意最接近題 — 出題與驗證規則
 */

/** @typedef {{ text: string, textZh: string }} B1SynonymOption */

/** @typedef {{ correct: B1SynonymOption, distractors: B1SynonymOption[] }} B1SynonymEntry */

/** @type {Record<string, B1SynonymEntry>} */
export const B1_SYNONYM_ENTRIES = {
  academic: {
    correct: { text: 'scholarly', textZh: '學術性的' },
    distractors: [
      { text: 'practical', textZh: '實務的' },
      { text: 'vocational', textZh: '職業的' },
      { text: 'technical', textZh: '技術的' },
    ],
  },
  acknowledge: {
    correct: { text: 'admit', textZh: '承認' },
    distractors: [
      { text: 'deny', textZh: '否認' },
      { text: 'ignore', textZh: '忽略' },
      { text: 'reject', textZh: '拒絕' },
    ],
  },
  anxiety: {
    correct: { text: 'worry', textZh: '擔憂' },
    distractors: [
      { text: 'stress', textZh: '壓力' },
      { text: 'fear', textZh: '恐懼' },
      { text: 'tension', textZh: '緊張' },
    ],
  },
  appointment: {
    correct: { text: 'meeting', textZh: '會面' },
    distractors: [
      { text: 'booking', textZh: '預約' },
      { text: 'session', textZh: '場次' },
      { text: 'visit', textZh: '拜訪' },
    ],
  },
  article: {
    correct: { text: 'essay', textZh: '文章' },
    distractors: [
      { text: 'report', textZh: '報告' },
      { text: 'column', textZh: '專欄' },
      { text: 'feature', textZh: '專題' },
    ],
  },
  audience: {
    correct: { text: 'listeners', textZh: '聽眾' },
    distractors: [
      { text: 'viewers', textZh: '觀眾' },
      { text: 'crowd', textZh: '人群' },
      { text: 'public', textZh: '公眾' },
    ],
  },
  border: {
    correct: { text: 'boundary', textZh: '邊界' },
    distractors: [
      { text: 'edge', textZh: '邊緣' },
      { text: 'limit', textZh: '限制' },
      { text: 'margin', textZh: '邊距' },
    ],
  },
  brand: {
    correct: { text: 'trademark', textZh: '商標' },
    distractors: [
      { text: 'logo', textZh: '標誌' },
      { text: 'badge', textZh: '徽章' },
      { text: 'identity', textZh: '識別' },
    ],
  },
  budget: {
    correct: { text: 'allowance', textZh: '預算／津貼' },
    distractors: [
      { text: 'funds', textZh: '資金' },
      { text: 'savings', textZh: '儲蓄' },
      { text: 'expense', textZh: '支出' },
    ],
  },
  campaign: {
    correct: { text: 'drive', textZh: '推動（行動）' },
    distractors: [
      { text: 'effort', textZh: '努力' },
      { text: 'push', textZh: '推進' },
      { text: 'initiative', textZh: '倡議' },
    ],
  },
  capability: {
    correct: { text: 'ability', textZh: '能力' },
    distractors: [
      { text: 'skill', textZh: '技能' },
      { text: 'talent', textZh: '天賦' },
      { text: 'capacity', textZh: '容量' },
    ],
  },
  carbon: {
    correct: { text: 'element', textZh: '元素' },
    distractors: [
      { text: 'mineral', textZh: '礦物' },
      { text: 'gas', textZh: '氣體' },
      { text: 'fuel', textZh: '燃料' },
    ],
  },
  chart: {
    correct: { text: 'graph', textZh: '圖表' },
    distractors: [
      { text: 'diagram', textZh: '圖解' },
      { text: 'table', textZh: '表格' },
      { text: 'figure', textZh: '圖形' },
    ],
  },
  claim: {
    correct: { text: 'statement', textZh: '聲明' },
    distractors: [
      { text: 'demand', textZh: '要求' },
      { text: 'insist', textZh: '堅持' },
      { text: 'argue', textZh: '論證' },
    ],
  },
  climate: {
    correct: { text: 'weather', textZh: '天氣' },
    distractors: [
      { text: 'season', textZh: '季節' },
      { text: 'forecast', textZh: '預報' },
      { text: 'temperature', textZh: '溫度' },
    ],
  },
  colleague: {
    correct: { text: 'coworker', textZh: '同事' },
    distractors: [
      { text: 'partner', textZh: '夥伴' },
      { text: 'teammate', textZh: '隊友' },
      { text: 'associate', textZh: '同仁' },
    ],
  },
  comfortable: {
    correct: { text: 'cozy', textZh: '舒適的' },
    distractors: [
      { text: 'relaxed', textZh: '放鬆的' },
      { text: 'snug', textZh: '溫暖舒適的' },
      { text: 'easy', textZh: '輕鬆的' },
    ],
  },
  comment: {
    correct: { text: 'remark', textZh: '評論' },
    distractors: [
      { text: 'note', textZh: '備註' },
      { text: 'feedback', textZh: '回饋' },
      { text: 'response', textZh: '回應' },
    ],
  },
};

/** 題幹括號內的詞性標記，不算中文釋義洩漏 */
const B1_POS_LABELS = new Set(['名詞', '動詞', '形容詞', '副詞', '片語', 'noun', 'verb', 'adjective', 'adverb']);

/**
 * @param {string} text
 */
export function optionFirstLetter(text) {
  const firstWord = text.trim().split(/\s+/)[0].toLowerCase();
  return firstWord[0] || '';
}

/**
 * @param {string} promptZh
 */
export function extractPromptZhGloss(promptZh) {
  const match = promptZh.match(/（([^）]+)）/);
  if (!match) return '';
  const gloss = match[1].trim();
  if (B1_POS_LABELS.has(gloss)) return '';
  if (!/[\u4e00-\u9fff]/.test(gloss)) return '';
  return gloss;
}

/**
 * @param {{ word: string, options: { id: string, text: string }[], correctOptionId: string }} question
 */
export function validateB1OptionLetterBalance(question) {
  const correct = question.options.find((o) => o.id === question.correctOptionId);
  if (!correct) return;

  const letters = question.options.map((o) => optionFirstLetter(o.text));
  const correctLetter = optionFirstLetter(correct.text);
  const counts = {};
  for (const letter of letters) {
    counts[letter] = (counts[letter] || 0) + 1;
  }

  const correctCount = counts[correctLetter] || 0;
  if (correctCount !== 1) return;

  const otherCounts = Object.entries(counts)
    .filter(([letter]) => letter !== correctLetter)
    .map(([, count]) => count);
  const maxOther = otherCounts.length ? Math.max(...otherCounts) : 0;
  if (maxOther >= 2) {
    throw new Error(`B1 synonym correct option is first-letter outlier: ${question.word}`);
  }

  const target = question.word.toLowerCase().replace(/\s+/g, '');
  for (const prefixLen of [2, 3, 4]) {
    if (target.length < prefixLen) continue;
    const prefix = target.slice(0, prefixLen);
    const distractors = question.options.filter((o) => o.id !== question.correctOptionId);
    const prefixed = distractors.filter((o) => {
      const head = o.text.trim().toLowerCase().split(/\s+/)[0];
      return head.startsWith(prefix);
    });
    const correctHead = correct.text.trim().toLowerCase().split(/\s+/)[0];
    if (prefixed.length >= 2 && !correctHead.startsWith(prefix)) {
      throw new Error(`B1 synonym distractors share target prefix "${prefix}": ${question.word}`);
    }
  }
}

/**
 * @param {{ word: string, promptZh?: string, options: { id: string, text: string, textZh?: string }[], correctOptionId: string, type?: string }} question
 */
export function validateB1SynonymQuestion(question) {
  if (question.type && question.type !== 'synonym') return;

  const glossInPrompt = extractPromptZhGloss(question.promptZh || '');
  if (glossInPrompt) {
    throw new Error(`B1 synonym prompt should not include Chinese gloss: ${question.word}`);
  }

  const correct = question.options.find((o) => o.id === question.correctOptionId);
  if (!correct) {
    throw new Error(`B1 synonym missing correct option: ${question.word}`);
  }

  if (correct.text.startsWith('Related to:') || (correct.textZh || '').startsWith('與「')) {
    throw new Error(`B1 synonym uses leaky option format: ${question.word}`);
  }

  if (correct.text.toLowerCase() === question.word.toLowerCase()) {
    throw new Error(`B1 synonym correct option must not repeat target word: ${question.word}`);
  }

  for (const opt of question.options) {
    if ((opt.textZh || '').includes('相關')) {
      throw new Error(`B1 synonym option must not use 「相關」 pattern: ${question.word}`);
    }
  }

  validateB1OptionLetterBalance(question);
}

/**
 * @param {{ word: string, zh: string }} entry
 * @returns {B1SynonymEntry}
 */
export function getB1SynonymEntry(entry) {
  const mapped = B1_SYNONYM_ENTRIES[entry.word.toLowerCase()];
  if (mapped) return mapped;
  return {
    correct: { text: 'similar term', textZh: entry.zh },
    distractors: [
      { text: 'opposite term', textZh: '相反詞' },
      { text: 'related term', textZh: '相關詞' },
      { text: 'different term', textZh: '不同詞' },
    ],
  };
}

/** @deprecated use getB1SynonymEntry */
export function getB1SynonymAnswer(entry) {
  return getB1SynonymEntry(entry).correct;
}

/** @deprecated use B1_SYNONYM_ENTRIES */
export const B1_SYNONYM_ANSWERS = Object.fromEntries(
  Object.entries(B1_SYNONYM_ENTRIES).map(([word, entry]) => [word, entry.correct]),
);
