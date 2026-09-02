/**
 * A2 情境填空出題規則（生成器與測試共用）
 */

/** @typedef {'verb'|'noun'|'adjective'} A2Pos */

/** @type {Record<string, A2Pos>} */
export const A2_INFERRED_POS = {
  account: 'noun',
  activity: 'noun',
  agree: 'verb',
  airport: 'noun',
  answer: 'noun',
  attach: 'verb',
  balance: 'noun',
  battery: 'noun',
  bedroom: 'noun',
  boil: 'verb',
  boots: 'noun',
  borrow: 'verb',
  bunk: 'noun',
  button: 'noun',
  campus: 'noun',
  career: 'noun',
  celebrate: 'verb',
  charity: 'noun',
  chat: 'verb',
  check: 'verb',
  choose: 'verb',
  clean: 'verb',
  click: 'verb',
  climb: 'verb',
  collect: 'verb',
  comb: 'verb',
  connect: 'verb',
  cook: 'verb',
  copy: 'verb',
  count: 'verb',
  cover: 'verb',
  cross: 'verb',
  cry: 'verb',
  cut: 'verb',
};

/**
 * @typedef {Object} A2Template
 * @property {string} prompt
 * @property {string} promptZh
 * @property {A2Pos} pos
 */

/** @type {Record<string, A2Template>} */
export const A2_WORD_TEMPLATES = {
  available: {
    prompt: '"Is this seat still ______?"',
    promptZh: '「Is this seat still ______?」（詢問這個座位是否尚可使用。）',
    pos: 'adjective',
  },
  account: {
    prompt: '"I opened a bank ______ yesterday."',
    promptZh: '「I opened a bank ______ yesterday.」（我昨天開了一個銀行______。）',
    pos: 'noun',
  },
  activity: {
    prompt: '"The EEARS ______ starts at noon."',
    promptZh: '「The EEARS ______ starts at noon.」（EEARS 的______中午開始。）',
    pos: 'noun',
  },
  agree: {
    prompt: '"I ______ with your opinion."',
    promptZh: '「I ______ with your opinion.」（我______你的看法。）',
    pos: 'verb',
  },
  airport: {
    prompt: '"We arrived at the ______ early."',
    promptZh: '「We arrived at the ______ early.」（我們提早到了______。）',
    pos: 'noun',
  },
  answer: {
    prompt: '"Please write your ______ on the line."',
    promptZh: '「Please write your ______ on the line.」（請在橫線上寫下你的______。）',
    pos: 'noun',
  },
  attach: {
    prompt: '"Please ______ the file to your email."',
    promptZh: '「Please ______ the file to your email.」（請把檔案______到電子郵件。）',
    pos: 'verb',
  },
  balance: {
    prompt: '"The ______ on my card is zero."',
    promptZh: '「The ______ on my card is zero.」（我卡片上的______是零。）',
    pos: 'noun',
  },
  battery: {
    prompt: '"My phone ______ is low."',
    promptZh: '「My phone ______ is low.」（我的手機______快沒電了。）',
    pos: 'noun',
  },
  bedroom: {
    prompt: '"My ______ is on the second floor."',
    promptZh: '「My ______ is on the second floor.」（我的______在二樓。）',
    pos: 'noun',
  },
  boil: {
    prompt: '"______ the water before you cook."',
    promptZh: '「______ the water before you cook.」（料理前先把水______。）',
    pos: 'verb',
  },
  boots: {
    prompt: '"Wear your ______ on rainy days."',
    promptZh: '「Wear your ______ on rainy days.」（下雨天要穿______。）',
    pos: 'noun',
  },
  borrow: {
    prompt: '"Can I ______ your pen?"',
    promptZh: '「Can I ______ your pen?」（我可以______你的筆嗎？）',
    pos: 'verb',
  },
  bunk: {
    prompt: '"He sleeps on the top ______."',
    promptZh: '「He sleeps on the top ______.」（他睡上鋪______。）',
    pos: 'noun',
  },
  button: {
    prompt: '"Press the ______ to start."',
    promptZh: '「Press the ______ to start.」（按______開始。）',
    pos: 'noun',
  },
  campus: {
    prompt: '"The EEARS office is on ______."',
    promptZh: '「The EEARS office is on ______.」（EEARS 辦公室在______。）',
    pos: 'noun',
  },
  career: {
    prompt: '"Job Talk helped us plan our ______."',
    promptZh: '「Job Talk helped us plan our ______.」（Job Talk 幫助我們規劃______。）',
    pos: 'noun',
  },
  celebrate: {
    prompt: '"We ______ after the event ended."',
    promptZh: '「We ______ after the event ended.」（活動結束後我們______。）',
    pos: 'verb',
  },
  charity: {
    prompt: '"They donated money to a local ______."',
    promptZh: '「They donated money to a local ______.」（他們捐款給本地______。）',
    pos: 'noun',
  },
};

/** @type {Record<A2Pos, A2Template[]>} */
export const A2_POS_TEMPLATES = {
  verb: [
    {
      prompt: '"Please ______ before you leave."',
      promptZh: '「Please ______ before you leave.」（離開前請先______。）',
      pos: 'verb',
    },
    {
      prompt: '"I want to ______ my English at EEARS."',
      promptZh: '「I want to ______ my English at EEARS.」（我想在 EEARS ______英文。）',
      pos: 'verb',
    },
    {
      prompt: '"Could you ______ that again, please?"',
      promptZh: '「Could you ______ that again, please?」（可以請你再______一次嗎？）',
      pos: 'verb',
    },
  ],
  noun: [
    {
      prompt: '"Don\'t forget your ______."',
      promptZh: '「Don\'t forget your ______.」（別忘了你的______。）',
      pos: 'noun',
    },
    {
      prompt: '"The ______ is on the first floor."',
      promptZh: '「The ______ is on the first floor.」（______在一樓。）',
      pos: 'noun',
    },
    {
      prompt: '"I left my ______ at home."',
      promptZh: '「I left my ______ at home.」（我把______忘在家裡了。）',
      pos: 'noun',
    },
  ],
  adjective: [
    {
      prompt: '"Is this seat still ______?"',
      promptZh: '「Is this seat still ______?」（詢問這個座位是否尚可使用。）',
      pos: 'adjective',
    },
    {
      prompt: '"The instructions look very ______."',
      promptZh: '「The instructions look very ______.」（描述說明是否清楚易懂。）',
      pos: 'adjective',
    },
  ],
};

/**
 * @param {{ listening?: { pos?: string }, pos?: string, word: string }} entry
 * @returns {A2Pos}
 */
export function inferA2Pos(entry) {
  const fromMeta = entry.listening?.pos || entry.pos;
  if (fromMeta === 'verb' || fromMeta === 'noun' || fromMeta === 'adjective') {
    return fromMeta;
  }
  return A2_INFERRED_POS[entry.word.toLowerCase()] || 'noun';
}

/**
 * 檢查答案是否已在題幹中露出（含常見字根／複數）
 * @param {string} word
 * @param {string} text
 */
export function wordLeaksIntoPrompt(word, text) {
  if (!word || !text) return false;
  const w = word.toLowerCase().replace(/-/g, '');
  const haystack = text.toLowerCase();
  if (w.length >= 4 && haystack.includes(w)) return true;
  if (haystack.includes(`${w}s`)) return true;
  if (w.endsWith('y') && haystack.includes(`${w.slice(0, -1)}ies`)) return true;
  return false;
}

/**
 * 從選項中文釋義取出可能洩漏的片段
 * @param {string} textZh
 */
export function extractZhGlossSegments(textZh) {
  if (!textZh) return [];
  const inner = textZh.match(/（([^）]+)）/);
  const raw = inner ? inner[1] : textZh;
  return raw
    .split(/[／/、,|]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

/**
 * @param {string} promptZh
 */
export function extractPromptZhAnnotation(promptZh) {
  if (!promptZh) return '';
  return [...promptZh.matchAll(/（([^）]+)）/g)].map((m) => m[1]).join(' ');
}

/**
 * 中文提示是否直接露出正確答案（如「有空」↔「有空／可取得」）
 * @param {string} correctTextZh
 * @param {string} promptZh
 */
export function zhGlossLeaksIntoPromptZh(correctTextZh, promptZh) {
  const annotation = extractPromptZhAnnotation(promptZh);
  if (!annotation) return false;
  return extractZhGlossSegments(correctTextZh).some((segment) => annotation.includes(segment));
}

/**
 * @param {{ word: string, prompt: string, promptZh?: string, options: { id: string, text: string }[], correctOptionId: string, type?: string }} question
 */
export function validateA2ContextQuestion(question) {
  if (question.type && question.type !== 'context') return;

  if (wordLeaksIntoPrompt(question.word, question.prompt)) {
    throw new Error(`A2 leak in prompt: ${question.word} → ${question.prompt}`);
  }
  if (question.promptZh && wordLeaksIntoPrompt(question.word, question.promptZh)) {
    throw new Error(`A2 leak in promptZh: ${question.word} → ${question.promptZh}`);
  }

  const correct = question.options.find((o) => o.id === question.correctOptionId);
  if (!correct || correct.text.toLowerCase() !== question.word.toLowerCase()) {
    throw new Error(`A2 correct option mismatch: ${question.word}`);
  }
  if (correct.textZh && question.promptZh && zhGlossLeaksIntoPromptZh(correct.textZh, question.promptZh)) {
    throw new Error(`A2 zh gloss leak: ${question.word} → ${question.promptZh}`);
  }

  for (const opt of question.options) {
    if (wordLeaksIntoPrompt(opt.text, question.prompt)) {
      throw new Error(`A2 distractor "${opt.text}" appears in prompt for ${question.word}`);
    }
  }
}

/**
 * @param {{ word: string, zh: string, listening?: { pos?: string }, pos?: string }} entry
 * @param {number} [seq]
 * @returns {A2Template}
 */
export function selectA2Template(entry, seq = 0) {
  const override = A2_WORD_TEMPLATES[entry.word.toLowerCase()];
  if (override && !wordLeaksIntoPrompt(entry.word, override.prompt)) {
    return override;
  }

  const pos = inferA2Pos(entry);
  const candidates = A2_POS_TEMPLATES[pos] || A2_POS_TEMPLATES.noun;
  const start = seq % candidates.length;
  for (let i = 0; i < candidates.length; i += 1) {
    const tpl = candidates[(start + i) % candidates.length];
    if (!wordLeaksIntoPrompt(entry.word, tpl.prompt)) {
      return tpl;
    }
  }

  throw new Error(`No valid A2 template for word: ${entry.word}`);
}
