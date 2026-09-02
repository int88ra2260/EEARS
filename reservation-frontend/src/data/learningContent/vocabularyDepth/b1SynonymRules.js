/**
 * B1 同義／語意最接近題 — 出題與驗證規則
 */

/** @typedef {{ text: string, textZh: string }} B1SynonymOption */

/** 正確答案：英文同義表述（不可在題幹重複中文釋義） */
/** @type {Record<string, B1SynonymOption>} */
export const B1_SYNONYM_ANSWERS = {
  academic: { text: 'scholarly', textZh: '學術性的' },
  acknowledge: { text: 'admit', textZh: '承認' },
  anxiety: { text: 'worry', textZh: '擔憂' },
  appointment: { text: 'scheduled meeting', textZh: '排定會面' },
  article: { text: 'written piece', textZh: '文章作品' },
  audience: { text: 'listeners', textZh: '聽眾' },
  border: { text: 'boundary', textZh: '邊界' },
  brand: { text: 'trademark', textZh: '商標' },
  budget: { text: 'spending plan', textZh: '支出計畫' },
  campaign: { text: 'promotion effort', textZh: '推廣行動' },
  capability: { text: 'ability', textZh: '能力' },
  carbon: { text: 'element in coal', textZh: '碳元素' },
  chart: { text: 'graph', textZh: '圖表' },
  claim: { text: 'statement', textZh: '聲明' },
  climate: { text: 'weather pattern', textZh: '氣候型態' },
  colleague: { text: 'coworker', textZh: '同事' },
  comfortable: { text: 'at ease', textZh: '自在' },
  comment: { text: 'remark', textZh: '評論' },
};

/** 題幹括號內的詞性標記，不算中文釋義洩漏 */
const B1_POS_LABELS = new Set(['名詞', '動詞', '形容詞', '副詞', '片語', 'noun', 'verb', 'adjective', 'adverb']);

/**
 * @param {string} promptZh
 */
export function extractPromptZhGloss(promptZh) {
  const match = promptZh.match(/（([^）]+)）/);
  if (!match) return '';
  const gloss = match[1].trim();
  if (B1_POS_LABELS.has(gloss)) return '';
  // 只取純中文釋義（至少一個 CJK 字元）
  if (!/[\u4e00-\u9fff]/.test(gloss)) return '';
  return gloss;
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
}

/**
 * @param {{ word: string, zh: string }} entry
 * @returns {B1SynonymOption}
 */
export function getB1SynonymAnswer(entry) {
  const mapped = B1_SYNONYM_ANSWERS[entry.word.toLowerCase()];
  if (mapped) return mapped;
  return { text: `similar to ${entry.word}`, textZh: entry.zh };
}
