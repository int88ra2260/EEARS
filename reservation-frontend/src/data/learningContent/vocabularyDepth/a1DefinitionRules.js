/**
 * A1 定義題 — 英文釋義選項（選項不得含中文或 meaning: 模板）
 */

/** @typedef {{ text: string, textZh: string }} A1DefinitionOption */

/** @typedef {{ correct: A1DefinitionOption, distractors: A1DefinitionOption[] }} A1DefinitionEntry */

/** @type {Record<string, A1DefinitionEntry>} */
export const A1_DEFINITIONS = {
  art: {
    correct: { text: 'Creative work like drawing or painting', textZh: '繪畫等創作' },
    distractors: [
      { text: 'A very young child', textZh: '嬰兒' },
      { text: 'Something you carry books in', textZh: '書包' },
      { text: 'A round object used in games', textZh: '球' },
    ],
  },
  baby: {
    correct: { text: 'A very young child', textZh: '嬰兒' },
    distractors: [
      { text: 'Creative work like drawing or painting', textZh: '美術' },
      { text: 'Something you carry books in', textZh: '書包' },
      { text: 'A yellow fruit you peel and eat', textZh: '香蕉' },
    ],
  },
  bag: {
    correct: { text: 'Something you carry things in', textZh: '袋子／書包' },
    distractors: [
      { text: 'A vehicle with many seats', textZh: '公車' },
      { text: 'A place to sleep at night', textZh: '床' },
      { text: 'A common color of the sky', textZh: '藍色' },
    ],
  },
  ball: {
    correct: { text: 'A round object used in games', textZh: '球' },
    distractors: [
      { text: 'Food made from flour and baked', textZh: '麵包' },
      { text: 'A small animal that says meow', textZh: '貓' },
      { text: 'A word you say when leaving', textZh: '再見' },
    ],
  },
  banana: {
    correct: { text: 'A yellow fruit you peel and eat', textZh: '香蕉' },
    distractors: [
      { text: 'Something you carry books in', textZh: '書包' },
      { text: 'A very young child', textZh: '嬰兒' },
      { text: 'Creative work like drawing or painting', textZh: '美術' },
    ],
  },
  bank: {
    correct: { text: 'A place that keeps money for people', textZh: '銀行' },
    distractors: [
      { text: 'A room where you wash your body', textZh: '浴室' },
      { text: 'A small shop that serves drinks', textZh: '咖啡館' },
      { text: 'A two-wheeled vehicle you ride', textZh: '腳踏車' },
    ],
  },
  bath: {
    correct: { text: 'A wash in a tub or shower', textZh: '洗澡' },
    distractors: [
      { text: 'A vehicle with four wheels', textZh: '汽車' },
      { text: 'Food made from flour and baked', textZh: '麵包' },
      { text: 'An animal with wings that flies', textZh: '鳥' },
    ],
  },
  bed: {
    correct: { text: 'A piece of furniture for sleeping', textZh: '床' },
    distractors: [
      { text: 'A vehicle with many seats', textZh: '公車' },
      { text: 'A young male person', textZh: '男孩' },
      { text: 'A place that keeps money for people', textZh: '銀行' },
    ],
  },
  bike: {
    correct: { text: 'A two-wheeled vehicle you ride', textZh: '腳踏車' },
    distractors: [
      { text: 'A small animal that says meow', textZh: '貓' },
      { text: 'A round object used in games', textZh: '球' },
      { text: 'A word you say when leaving', textZh: '再見' },
    ],
  },
  bird: {
    correct: { text: 'An animal with wings that flies', textZh: '鳥' },
    distractors: [
      { text: 'A small animal that says meow', textZh: '貓' },
      { text: 'A young male person', textZh: '男孩' },
      { text: 'Food made from flour and baked', textZh: '麵包' },
    ],
  },
  blue: {
    correct: { text: 'A common color of the sky', textZh: '藍色' },
    distractors: [
      { text: 'A yellow fruit you peel and eat', textZh: '香蕉' },
      { text: 'A piece of furniture for sleeping', textZh: '床' },
      { text: 'Creative work like drawing or painting', textZh: '美術' },
    ],
  },
  boy: {
    correct: { text: 'A young male person', textZh: '男孩' },
    distractors: [
      { text: 'A very young child', textZh: '嬰兒' },
      { text: 'An animal with wings that flies', textZh: '鳥' },
      { text: 'A small shop that serves drinks', textZh: '咖啡館' },
    ],
  },
  bread: {
    correct: { text: 'Food made from flour and baked', textZh: '麵包' },
    distractors: [
      { text: 'A round object used in games', textZh: '球' },
      { text: 'A wash in a tub or shower', textZh: '洗澡' },
      { text: 'A vehicle with four wheels', textZh: '汽車' },
    ],
  },
  bus: {
    correct: { text: 'A large vehicle that carries many people', textZh: '公車' },
    distractors: [
      { text: 'A two-wheeled vehicle you ride', textZh: '腳踏車' },
      { text: 'A piece of furniture for sleeping', textZh: '床' },
      { text: 'A place that keeps money for people', textZh: '銀行' },
    ],
  },
  bye: {
    correct: { text: 'A short word said when leaving', textZh: '再見' },
    distractors: [
      { text: 'A common color of the sky', textZh: '藍色' },
      { text: 'Something you carry things in', textZh: '書包' },
      { text: 'A small animal that says meow', textZh: '貓' },
    ],
  },
  cafe: {
    correct: { text: 'A small place that serves coffee and snacks', textZh: '咖啡館' },
    distractors: [
      { text: 'A room where you wash your body', textZh: '浴室' },
      { text: 'A young male person', textZh: '男孩' },
      { text: 'An animal with wings that flies', textZh: '鳥' },
    ],
  },
  car: {
    correct: { text: 'A vehicle with four wheels for roads', textZh: '汽車' },
    distractors: [
      { text: 'A large vehicle that carries many people', textZh: '公車' },
      { text: 'A two-wheeled vehicle you ride', textZh: '腳踏車' },
      { text: 'A yellow fruit you peel and eat', textZh: '香蕉' },
    ],
  },
  cat: {
    correct: { text: 'A small pet animal that says meow', textZh: '貓' },
    distractors: [
      { text: 'An animal with wings that flies', textZh: '鳥' },
      { text: 'A very young child', textZh: '嬰兒' },
      { text: 'Food made from flour and baked', textZh: '麵包' },
    ],
  },
};

const LEAKY_A1_PATTERNS = [
  /[\u4e00-\u9fff]/,
  /\(meaning:/i,
  /meaning:/i,
];

/**
 * @param {{ word: string, options: { id: string, text: string, textZh?: string }[], correctOptionId: string, type?: string }} question
 */
export function validateA1DefinitionQuestion(question) {
  if (question.type && question.type !== 'definition') return;

  for (const opt of question.options) {
    for (const re of LEAKY_A1_PATTERNS) {
      if (re.test(opt.text)) {
        throw new Error(`A1 definition option text leaks answer: ${question.word} → ${opt.text}`);
      }
    }
  }

  const texts = question.options.map((o) => o.text.trim());
  const unique = new Set(texts.map((t) => t.toLowerCase()));
  if (unique.size !== texts.length) {
    throw new Error(`A1 definition duplicate option text: ${question.word}`);
  }
}

/**
 * @param {{ word: string, zh: string }} entry
 * @returns {A1DefinitionEntry}
 */
export function getA1Definition(entry) {
  const mapped = A1_DEFINITIONS[entry.word.toLowerCase()];
  if (mapped) return mapped;
  return {
    correct: { text: `A basic English word`, textZh: entry.zh },
    distractors: [
      { text: 'A type of building', textZh: '建築物' },
      { text: 'An action you do daily', textZh: '日常動作' },
      { text: 'Something found in nature', textZh: '自然事物' },
    ],
  };
}
