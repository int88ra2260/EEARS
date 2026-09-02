/**
 * B2 搭配題 — 四個選項使用相同「動詞 + 名詞」句型，避免正解動詞明顯不同
 */

/** @typedef {{ text: string, textZh: string }} B2CollocationOption */

/** @typedef {{ correct: B2CollocationOption, distractors: B2CollocationOption[] }} B2CollocationEntry */

/** @type {Record<string, B2CollocationEntry>} */
export const B2_COLLOCATIONS = {
  abstract: {
    correct: { text: 'write an abstract', textZh: 'write an abstract（寫摘要）' },
    distractors: [
      { text: 'sign an abstract', textZh: 'sign an abstract' },
      { text: 'fold an abstract', textZh: 'fold an abstract' },
      { text: 'water an abstract', textZh: 'water an abstract' },
    ],
  },
  administer: {
    correct: { text: 'administer a survey', textZh: 'administer a survey（施行問卷）' },
    distractors: [
      { text: 'administer a sandwich', textZh: 'administer a sandwich' },
      { text: 'administer a hallway', textZh: 'administer a hallway' },
      { text: 'administer a melody', textZh: 'administer a melody' },
    ],
  },
  advance: {
    correct: { text: 'advance a proposal', textZh: 'advance a proposal（推進提案）' },
    distractors: [
      { text: 'advance a sandwich', textZh: 'advance a sandwich' },
      { text: 'advance a pillow', textZh: 'advance a pillow' },
      { text: 'advance a shadow', textZh: 'advance a shadow' },
    ],
  },
  agenda: {
    correct: { text: 'set the agenda', textZh: 'set the agenda（設定議程）' },
    distractors: [
      { text: 'drink the agenda', textZh: 'drink the agenda' },
      { text: 'fold the agenda', textZh: 'fold the agenda' },
      { text: 'melt the agenda', textZh: 'melt the agenda' },
    ],
  },
  agreement: {
    correct: { text: 'reach an agreement', textZh: 'reach an agreement（達成協議）' },
    distractors: [
      { text: 'reach a sandwich', textZh: 'reach a sandwich' },
      { text: 'reach a hallway', textZh: 'reach a hallway' },
      { text: 'reach a melody', textZh: 'reach a melody' },
    ],
  },
  ambiguity: {
    correct: { text: 'reduce ambiguity', textZh: 'reduce ambiguity（減少歧義）' },
    distractors: [
      { text: 'reduce a sandwich', textZh: 'reduce a sandwich' },
      { text: 'reduce a hallway', textZh: 'reduce a hallway' },
      { text: 'reduce a melody', textZh: 'reduce a melody' },
    ],
  },
  analyze: {
    correct: { text: 'analyze the data', textZh: 'analyze the data（分析資料）' },
    distractors: [
      { text: 'analyze a sandwich', textZh: 'analyze a sandwich' },
      { text: 'analyze a hallway', textZh: 'analyze a hallway' },
      { text: 'analyze a melody', textZh: 'analyze a melody' },
    ],
  },
  archaeology: {
    correct: { text: 'study archaeology', textZh: 'study archaeology（研究考古）' },
    distractors: [
      { text: 'study a sandwich', textZh: 'study a sandwich' },
      { text: 'study a hallway', textZh: 'study a hallway' },
      { text: 'study a melody', textZh: 'study a melody' },
    ],
  },
  articulate: {
    correct: { text: 'articulate an idea', textZh: 'articulate an idea（清楚表達想法）' },
    distractors: [
      { text: 'articulate a sandwich', textZh: 'articulate a sandwich' },
      { text: 'articulate a hallway', textZh: 'articulate a hallway' },
      { text: 'articulate a melody', textZh: 'articulate a melody' },
    ],
  },
  authority: {
    correct: { text: 'challenge authority', textZh: 'challenge authority（挑戰權威）' },
    distractors: [
      { text: 'challenge a sandwich', textZh: 'challenge a sandwich' },
      { text: 'challenge a hallway', textZh: 'challenge a hallway' },
      { text: 'challenge a melody', textZh: 'challenge a melody' },
    ],
  },
  average: {
    correct: { text: 'calculate the average', textZh: 'calculate the average（計算平均）' },
    distractors: [
      { text: 'calculate a sandwich', textZh: 'calculate a sandwich' },
      { text: 'calculate a hallway', textZh: 'calculate a hallway' },
      { text: 'calculate a melody', textZh: 'calculate a melody' },
    ],
  },
  background: {
    correct: { text: 'check your background', textZh: 'check your background（查核背景）' },
    distractors: [
      { text: 'check a sandwich', textZh: 'check a sandwich' },
      { text: 'check a hallway', textZh: 'check a hallway' },
      { text: 'check a melody', textZh: 'check a melody' },
    ],
  },
  bargain: {
    correct: { text: 'drive a hard bargain', textZh: 'drive a hard bargain（強硬議價）' },
    distractors: [
      { text: 'drive a soft sandwich', textZh: 'drive a soft sandwich' },
      { text: 'drive a long hallway', textZh: 'drive a long hallway' },
      { text: 'drive a loud melody', textZh: 'drive a loud melody' },
    ],
  },
  behavior: {
    correct: { text: 'change your behavior', textZh: 'change your behavior（改變行為）' },
    distractors: [
      { text: 'change a sandwich', textZh: 'change a sandwich' },
      { text: 'change a hallway', textZh: 'change a hallway' },
      { text: 'change a melody', textZh: 'change a melody' },
    ],
  },
  belonging: {
    correct: { text: 'foster a sense of belonging', textZh: 'foster a sense of belonging（培養歸屬感）' },
    distractors: [
      { text: 'foster a sense of sandwich', textZh: 'foster a sense of sandwich' },
      { text: 'foster a sense of hallway', textZh: 'foster a sense of hallway' },
      { text: 'foster a sense of melody', textZh: 'foster a sense of melody' },
    ],
  },
  browser: {
    correct: { text: 'open a browser', textZh: 'open a browser（開啟瀏覽器）' },
    distractors: [
      { text: 'open a sandwich', textZh: 'open a sandwich' },
      { text: 'open a hallway', textZh: 'open a hallway' },
      { text: 'open a melody', textZh: 'open a melody' },
    ],
  },
  burnout: {
    correct: { text: 'prevent burnout', textZh: 'prevent burnout（預防倦怠）' },
    distractors: [
      { text: 'prevent a sandwich', textZh: 'prevent a sandwich' },
      { text: 'prevent a hallway', textZh: 'prevent a hallway' },
      { text: 'prevent a melody', textZh: 'prevent a melody' },
    ],
  },
  calorie: {
    correct: { text: 'count calories', textZh: 'count calories（計算卡路里）' },
    distractors: [
      { text: 'count sandwiches', textZh: 'count sandwiches' },
      { text: 'count hallways', textZh: 'count hallways' },
      { text: 'count melodies', textZh: 'count melodies' },
    ],
  },
};

const LEAKY_B2_MARKERS = ['（自然搭配）', 'natural collocation'];

/**
 * @param {{ word: string, options: { id: string, text: string, textZh?: string }[], correctOptionId: string, type?: string }} question
 */
export function validateB2CollocationQuestion(question) {
  if (question.type && question.type !== 'collocation') return;

  for (const opt of question.options) {
    for (const marker of LEAKY_B2_MARKERS) {
      if ((opt.textZh || '').includes(marker) || opt.text.includes(marker)) {
        throw new Error(`B2 collocation leaky marker: ${question.word}`);
      }
    }
    if (/[\u4e00-\u9fff]/.test(opt.text)) {
      throw new Error(`B2 collocation option text has CJK: ${question.word}`);
    }
  }

  const wordCounts = question.options.map((o) => o.text.trim().split(/\s+/).length);
  const minWords = Math.min(...wordCounts);
  const maxWords = Math.max(...wordCounts);
  if (maxWords - minWords > 2) {
    throw new Error(`B2 collocation uneven option length: ${question.word}`);
  }
}

/**
 * @param {{ word: string, zh: string }} entry
 * @returns {B2CollocationEntry}
 */
export function getB2Collocation(entry) {
  const mapped = B2_COLLOCATIONS[entry.word.toLowerCase()];
  if (mapped) return mapped;
  const w = entry.word;
  return {
    correct: { text: `discuss ${w}`, textZh: `discuss ${w}` },
    distractors: [
      { text: `sign ${w}`, textZh: `sign ${w}` },
      { text: `fold ${w}`, textZh: `fold ${w}` },
      { text: `water ${w}`, textZh: `water ${w}` },
    ],
  };
}
