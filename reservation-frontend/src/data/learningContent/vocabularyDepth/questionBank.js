import { VOCABULARY_DEPTH_LEVELS } from './constants';
import { VOCABULARY_DEPTH_QUESTIONS_EXTENDED } from './questionBankExtended';
import { VOCABULARY_DEPTH_QUESTIONS_GENERATED } from './questionBankGenerated';
import { validateA2ContextQuestion } from './a2ContextRules';
import { validateB1SynonymQuestion } from './b1SynonymRules';

/**
 * @typedef {Object} VocabularyDepthOption
 * @property {string} id
 * @property {string} text
 * @property {string} [textZh]
 */

/**
 * @typedef {Object} VocabularyDepthQuestion
 * @property {string} id
 * @property {string} level
 * @property {string} type
 * @property {string} prompt
 * @property {string} [promptZh]
 * @property {VocabularyDepthOption[]} options
 * @property {string} correctOptionId
 * @property {string} word
 * @property {string} [explanationEn]
 * @property {string} [explanationZh]
 * @property {string[]} [tags]
 */

/** @type {VocabularyDepthQuestion[]} */
export const VOCABULARY_DEPTH_QUESTIONS = [
  // A1 — definition
  {
    id: 'vd_a1_01', level: 'A1', type: 'definition', word: 'breakfast',
    prompt: 'What does "breakfast" mean?',
    promptZh: '「breakfast」是什麼意思？',
    options: [
      { id: 'a', text: 'The first meal of the day', textZh: '一天的第一餐' },
      { id: 'b', text: 'The evening meal', textZh: '晚餐' },
      { id: 'c', text: 'A drink with coffee', textZh: '配咖啡的飲料' },
      { id: 'd', text: 'A type of bread', textZh: '一種麵包' },
    ],
    correctOptionId: 'a',
    explanationEn: 'Breakfast is the meal you eat in the morning.',
    explanationZh: 'Breakfast 是早上吃的那一餐。',
    tags: ['campus_life'],
  },
  {
    id: 'vd_a1_02', level: 'A1', type: 'definition', word: 'teacher',
    prompt: 'What does "teacher" mean?',
    promptZh: '「teacher」是什麼意思？',
    options: [
      { id: 'a', text: 'A person who helps you learn', textZh: '幫你學習的人' },
      { id: 'b', text: 'A school building', textZh: '學校建築' },
      { id: 'c', text: 'A homework assignment', textZh: '作業' },
      { id: 'd', text: 'A type of book', textZh: '一種書' },
    ],
    correctOptionId: 'a',
    explanationEn: 'A teacher is someone who teaches students.',
    explanationZh: 'Teacher 是教學的人。',
    tags: ['campus_life'],
  },
  {
    id: 'vd_a1_03', level: 'A1', type: 'definition', word: 'friend',
    prompt: 'What does "friend" mean?',
    promptZh: '「friend」是什麼意思？',
    options: [
      { id: 'a', text: 'Someone you know and like', textZh: '你認識且喜歡的人' },
      { id: 'b', text: 'A family member only', textZh: '只能是家人' },
      { id: 'c', text: 'A school subject', textZh: '一門科目' },
      { id: 'd', text: 'A kind of food', textZh: '一種食物' },
    ],
    correctOptionId: 'a',
    tags: ['campus_life'],
  },
  {
    id: 'vd_a1_04', level: 'A1', type: 'definition', word: 'water',
    prompt: 'What does "water" mean?',
    promptZh: '「water」是什麼意思？',
    options: [
      { id: 'a', text: 'A clear liquid people drink', textZh: '人們喝的透明液體' },
      { id: 'b', text: 'Hot weather', textZh: '炎熱天氣' },
      { id: 'c', text: 'A classroom', textZh: '教室' },
      { id: 'd', text: 'A number', textZh: '數字' },
    ],
    correctOptionId: 'a',
    tags: ['campus_life'],
  },
  {
    id: 'vd_a1_05', level: 'A1', type: 'definition', word: 'happy',
    prompt: 'What does "happy" mean?',
    promptZh: '「happy」是什麼意思？',
    options: [
      { id: 'a', text: 'Feeling pleased or glad', textZh: '感到開心或愉快' },
      { id: 'b', text: 'Feeling very tired', textZh: '非常疲倦' },
      { id: 'c', text: 'Feeling angry', textZh: '生氣' },
      { id: 'd', text: 'Feeling cold', textZh: '覺得冷' },
    ],
    correctOptionId: 'a',
    tags: ['campus_life'],
  },
  {
    id: 'vd_a1_06', level: 'A1', type: 'definition', word: 'book',
    prompt: 'What does "book" mean?',
    promptZh: '「book」是什麼意思？',
    options: [
      { id: 'a', text: 'Pages bound together for reading', textZh: '裝訂起來供閱讀的頁面' },
      { id: 'b', text: 'A place to sleep', textZh: '睡覺的地方' },
      { id: 'c', text: 'A kind of sport', textZh: '一種運動' },
      { id: 'd', text: 'A color', textZh: '一種顏色' },
    ],
    correctOptionId: 'a',
    tags: ['campus_life'],
  },
  // A2 — context
  {
    id: 'vd_a2_01', level: 'A2', type: 'context', word: 'reservation',
    prompt: 'At EEARS: "I made a ______ for English Table."',
    promptZh: '在 EEARS：「I made a ______ for English Table.」',
    options: [
      { id: 'a', text: 'reservation', textZh: 'reservation（預約）' },
      { id: 'b', text: 'conversation', textZh: 'conversation（對話）' },
      { id: 'c', text: 'celebration', textZh: 'celebration（慶祝）' },
      { id: 'd', text: 'competition', textZh: 'competition（比賽）' },
    ],
    correctOptionId: 'a',
    tags: ['reservation'],
  },
  {
    id: 'vd_a2_02', level: 'A2', type: 'context', word: 'cancel',
    prompt: 'If you cannot come: "I need to ______ my booking."',
    promptZh: '若無法出席：「I need to ______ my booking.」',
    options: [
      { id: 'a', text: 'cancel', textZh: 'cancel（取消）' },
      { id: 'b', text: 'confirm', textZh: 'confirm（確認）' },
      { id: 'c', text: 'collect', textZh: 'collect（收集）' },
      { id: 'd', text: 'create', textZh: 'create（建立）' },
    ],
    correctOptionId: 'a',
    tags: ['reservation'],
  },
  {
    id: 'vd_a2_03', level: 'A2', type: 'context', word: 'schedule',
    prompt: '"Check the activity ______ before you go."',
    promptZh: '「出發前先看 activity ______。」',
    options: [
      { id: 'a', text: 'schedule', textZh: 'schedule（行程）' },
      { id: 'b', text: 'scholar', textZh: 'scholar（學者）' },
      { id: 'c', text: 'sculpture', textZh: 'sculpture（雕塑）' },
      { id: 'd', text: 'scaffold', textZh: 'scaffold（鷹架）' },
    ],
    correctOptionId: 'a',
    tags: ['reservation'],
  },
  {
    id: 'vd_a2_04', level: 'A2', type: 'context', word: 'explain',
    prompt: 'In English Table: "Could you ______ that again?"',
    promptZh: '在 English Table：「Could you ______ that again?」',
    options: [
      { id: 'a', text: 'explain', textZh: 'explain（解釋）' },
      { id: 'b', text: 'explore', textZh: 'explore（探索）' },
      { id: 'c', text: 'export', textZh: 'export（出口）' },
      { id: 'd', text: 'explode', textZh: 'explode（爆炸）' },
    ],
    correctOptionId: 'a',
    tags: ['english_table'],
  },
  {
    id: 'vd_a2_05', level: 'A2', type: 'context', word: 'passport',
    prompt: 'Travel topic: "Don\'t forget your ______."',
    promptZh: '旅行主題：「Don\'t forget your ______.」',
    options: [
      { id: 'a', text: 'passport', textZh: 'passport（護照）' },
      { id: 'b', text: 'password', textZh: 'password（密碼）' },
      { id: 'c', text: 'passage', textZh: 'passage（段落）' },
      { id: 'd', text: 'pastime', textZh: 'pastime（消遣）' },
    ],
    correctOptionId: 'a',
    tags: ['international_forum'],
  },
  {
    id: 'vd_a2_06', level: 'A2', type: 'context', word: 'interview',
    prompt: 'Job Talk: "I have a job ______ tomorrow."',
    promptZh: 'Job Talk：「I have a job ______ tomorrow.」',
    options: [
      { id: 'a', text: 'interview', textZh: 'interview（面試）' },
      { id: 'b', text: 'interval', textZh: 'interval（間隔）' },
      { id: 'c', text: 'internal', textZh: 'internal（內部的）' },
      { id: 'd', text: 'internet', textZh: 'internet（網路）' },
    ],
    correctOptionId: 'a',
    tags: ['job_talk'],
  },
  // B1 — synonym
  {
    id: 'vd_b1_01', level: 'B1', type: 'synonym', word: 'participate',
    prompt: 'Which is closest in meaning to "participate"?',
    promptZh: '哪個詞與 participate 意思最接近？',
    options: [
      { id: 'a', text: 'take part', textZh: '參與' },
      { id: 'b', text: 'particular', textZh: '特定的' },
      { id: 'c', text: 'depart', textZh: '離開' },
      { id: 'd', text: 'predict', textZh: '預測' },
    ],
    correctOptionId: 'a',
    tags: ['english_table'],
  },
  {
    id: 'vd_b1_02', level: 'B1', type: 'synonym', word: 'clarify',
    prompt: 'Which is closest in meaning to "clarify"?',
    promptZh: '哪個詞與 clarify 意思最接近？',
    options: [
      { id: 'a', text: 'make clear', textZh: '釐清' },
      { id: 'b', text: 'classify', textZh: '分類' },
      { id: 'c', text: 'celebrate', textZh: '慶祝' },
      { id: 'd', text: 'calculate', textZh: '計算' },
    ],
    correctOptionId: 'a',
    tags: ['english_club'],
  },
  {
    id: 'vd_b1_03', level: 'B1', type: 'synonym', word: 'recommend',
    prompt: 'Which is closest in meaning to "recommend"?',
    promptZh: '哪個詞與 recommend 意思最接近？',
    options: [
      { id: 'a', text: 'suggest', textZh: '建議' },
      { id: 'b', text: 'recover', textZh: '恢復' },
      { id: 'c', text: 'record', textZh: '記錄' },
      { id: 'd', text: 'reduce', textZh: '減少' },
    ],
    correctOptionId: 'a',
    tags: ['job_talk'],
  },
  {
    id: 'vd_b1_04', level: 'B1', type: 'synonym', word: 'deadline',
    prompt: 'Which phrase is closest to "deadline"?',
    promptZh: '哪個片語與 deadline 最接近？',
    options: [
      { id: 'a', text: 'due date', textZh: '截止日期' },
      { id: 'b', text: 'headline', textZh: '標題' },
      { id: 'c', text: 'timeline', textZh: '時間軸' },
      { id: 'd', text: 'guideline', textZh: '指引' },
    ],
    correctOptionId: 'a',
    tags: ['campus_life'],
  },
  {
    id: 'vd_b1_05', level: 'B1', type: 'synonym', word: 'demonstrate',
    prompt: 'Which is closest in meaning to "demonstrate"?',
    promptZh: '哪個詞與 demonstrate 意思最接近？',
    options: [
      { id: 'a', text: 'show how', textZh: '示範' },
      { id: 'b', text: 'demolish', textZh: '拆除' },
      { id: 'c', text: 'demote', textZh: '降職' },
      { id: 'd', text: 'deny', textZh: '否認' },
    ],
    correctOptionId: 'a',
    tags: ['english_club'],
  },
  {
    id: 'vd_b1_06', level: 'B1', type: 'synonym', word: 'perspective',
    prompt: 'Which is closest in meaning to "perspective"?',
    promptZh: '哪個詞與 perspective 意思最接近？',
    options: [
      { id: 'a', text: 'point of view', textZh: '觀點' },
      { id: 'b', text: 'prospectus', textZh: '簡章' },
      { id: 'c', text: 'prospect', textZh: '前景' },
      { id: 'd', text: 'protein', textZh: '蛋白質' },
    ],
    correctOptionId: 'a',
    tags: ['international_forum'],
  },
  // B2 — collocation
  {
    id: 'vd_b2_01', level: 'B2', type: 'collocation', word: 'raise',
    prompt: 'In "raise an issue", "raise" means…',
    promptZh: '在 "raise an issue" 中，raise 意為…',
    options: [
      { id: 'a', text: 'bring up for discussion', textZh: '提出討論' },
      { id: 'b', text: 'lift physically', textZh: ' physically 舉起' },
      { id: 'c', text: 'increase a price only', textZh: '只指漲價' },
      { id: 'd', text: 'raise a child', textZh: '撫養小孩' },
    ],
    correctOptionId: 'a',
    tags: ['english_club'],
  },
  {
    id: 'vd_b2_02', level: 'B2', type: 'collocation', word: 'deadline',
    prompt: 'Which collocation is correct?',
    promptZh: '哪個搭配正確？',
    options: [
      { id: 'a', text: 'meet a deadline', textZh: 'meet a deadline（趕上截止）' },
      { id: 'b', text: 'eat a deadline', textZh: 'eat a deadline' },
      { id: 'c', text: 'sleep a deadline', textZh: 'sleep a deadline' },
      { id: 'd', text: 'paint a deadline', textZh: 'paint a deadline' },
    ],
    correctOptionId: 'a',
    tags: ['campus_life'],
  },
  {
    id: 'vd_b2_03', level: 'B2', type: 'collocation', word: 'research',
    prompt: 'Which collocation is correct?',
    promptZh: '哪個搭配正確？',
    options: [
      { id: 'a', text: 'conduct research', textZh: 'conduct research（進行研究）' },
      { id: 'b', text: 'cook research', textZh: 'cook research' },
      { id: 'c', text: 'drive research', textZh: 'drive research' },
      { id: 'd', text: 'swim research', textZh: 'swim research' },
    ],
    correctOptionId: 'a',
    tags: ['academic'],
  },
  {
    id: 'vd_b2_04', level: 'B2', type: 'collocation', word: 'consensus',
    prompt: 'Which collocation is correct?',
    promptZh: '哪個搭配正確？',
    options: [
      { id: 'a', text: 'reach consensus', textZh: 'reach consensus（達成共識）' },
      { id: 'b', text: 'reach homework', textZh: 'reach homework' },
      { id: 'c', text: 'reach furniture', textZh: 'reach furniture' },
      { id: 'd', text: 'reach weather', textZh: 'reach weather' },
    ],
    correctOptionId: 'a',
    tags: ['english_club'],
  },
  {
    id: 'vd_b2_05', level: 'B2', type: 'collocation', word: 'conclusion',
    prompt: 'In a discussion: "Let me draw a ______."',
    promptZh: '討論中：「Let me draw a ______.」',
    options: [
      { id: 'a', text: 'conclusion', textZh: 'conclusion（結論）' },
      { id: 'b', text: 'confusion', textZh: 'confusion（困惑）' },
      { id: 'c', text: 'collision', textZh: 'collision（碰撞）' },
      { id: 'd', text: 'concert', textZh: 'concert（音樂會）' },
    ],
    correctOptionId: 'a',
    tags: ['english_club'],
  },
  {
    id: 'vd_b2_06', level: 'B2', type: 'collocation', word: 'hypothesis',
    prompt: 'Which collocation fits academic writing?',
    promptZh: '哪個搭配適合學術寫作？',
    options: [
      { id: 'a', text: 'test a hypothesis', textZh: 'test a hypothesis（檢驗假設）' },
      { id: 'b', text: 'sing a hypothesis', textZh: 'sing a hypothesis' },
      { id: 'c', text: 'dance a hypothesis', textZh: 'dance a hypothesis' },
      { id: 'd', text: 'paint a hypothesis', textZh: 'paint a hypothesis' },
    ],
    correctOptionId: 'a',
    tags: ['international_forum'],
  },
  // C1 — nuance
  {
    id: 'vd_c1_01', level: 'C1', type: 'nuance', word: 'give up',
    prompt: 'What does "give up" mean in "Don\'t give up"?',
    promptZh: '在 "Don\'t give up" 中，give up 意為？',
    options: [
      { id: 'a', text: 'stop trying', textZh: '放棄努力' },
      { id: 'b', text: 'hand something upward', textZh: '向上遞東西' },
      { id: 'c', text: 'offer a gift', textZh: '送禮' },
      { id: 'd', text: 'stand up', textZh: '站起來' },
    ],
    correctOptionId: 'a',
    tags: ['english_club'],
  },
  {
    id: 'vd_c1_02', level: 'C1', type: 'nuance', word: 'take for granted',
    prompt: '"Take something for granted" means…',
    promptZh: '「Take something for granted」意為…',
    options: [
      { id: 'a', text: 'assume it will always be there', textZh: '視為理所當然' },
      { id: 'b', text: 'borrow it temporarily', textZh: '暫借' },
      { id: 'c', text: 'sell it cheaply', textZh: '廉價出售' },
      { id: 'd', text: 'translate it literally', textZh: '逐字翻譯' },
    ],
    correctOptionId: 'a',
    tags: ['international_forum'],
  },
  {
    id: 'vd_c1_03', level: 'C1', type: 'nuance', word: 'in light of',
    prompt: '"In light of the new data" means…',
    promptZh: '「In light of the new data」意為…',
    options: [
      { id: 'a', text: 'considering the new data', textZh: '考量到新數據' },
      { id: 'b', text: 'inside a lamp', textZh: '在燈裡面' },
      { id: 'c', text: 'despite the new data', textZh: '儘管有新數據' },
      { id: 'd', text: 'before any data existed', textZh: '在有任何數據之前' },
    ],
    correctOptionId: 'a',
    tags: ['academic'],
  },
  {
    id: 'vd_c1_04', level: 'C1', type: 'nuance', word: 'fall short of',
    prompt: '"Fall short of expectations" means…',
    promptZh: '「Fall short of expectations」意為…',
    options: [
      { id: 'a', text: 'fail to meet expectations', textZh: '未達期望' },
      { id: 'b', text: 'exceed expectations', textZh: '超越期望' },
      { id: 'c', text: 'ignore expectations', textZh: '忽略期望' },
      { id: 'd', text: 'create expectations', textZh: '創造期望' },
    ],
    correctOptionId: 'a',
    tags: ['job_talk'],
  },
  {
    id: 'vd_c1_05', level: 'C1', type: 'nuance', word: 'on the grounds that',
    prompt: '"On the grounds that it was unfair" means…',
    promptZh: '「On the grounds that it was unfair」意為…',
    options: [
      { id: 'a', text: 'because it was unfair', textZh: '因為那不公平' },
      { id: 'b', text: 'on a sports field', textZh: '在運動場上' },
      { id: 'c', text: 'without any reason', textZh: '毫無理由' },
      { id: 'd', text: 'in the future', textZh: '在未來' },
    ],
    correctOptionId: 'a',
    tags: ['english_club'],
  },
  {
    id: 'vd_c1_06', level: 'C1', type: 'nuance', word: 'a far cry from',
    prompt: '"A far cry from the truth" means…',
    promptZh: '「A far cry from the truth」意為…',
    options: [
      { id: 'a', text: 'very different from the truth', textZh: '與真相相去甚遠' },
      { id: 'b', text: 'exactly the truth', textZh: '就是真相' },
      { id: 'c', text: 'shouted loudly', textZh: '大聲喊叫' },
      { id: 'd', text: 'whispered quietly', textZh: '小聲耳語' },
    ],
    correctOptionId: 'a',
    tags: ['international_forum'],
  },
];

const ALL_VOCABULARY_DEPTH_QUESTIONS = [
  ...VOCABULARY_DEPTH_QUESTIONS,
  ...VOCABULARY_DEPTH_QUESTIONS_EXTENDED,
  ...VOCABULARY_DEPTH_QUESTIONS_GENERATED,
];

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * 隨機排列選項，避免正確答案固定在第一項。
 * @param {VocabularyDepthQuestion} question
 * @returns {VocabularyDepthQuestion}
 */
export function shuffleQuestionOptions(question) {
  return {
    ...question,
    options: shuffleArray(question.options),
  };
}

/**
 * @param {string} level
 * @param {number} [count]
 */
export function getQuestionsForLevel(level, count = 6) {
  const pool = ALL_VOCABULARY_DEPTH_QUESTIONS.filter((q) => q.level === level);
  const shuffled = shuffleArray(pool);
  return shuffled
    .slice(0, Math.min(count, shuffled.length))
    .map(shuffleQuestionOptions);
}

/**
 * @param {string} level
 */
export function countQuestionsByLevel(level) {
  return ALL_VOCABULARY_DEPTH_QUESTIONS.filter((q) => q.level === level).length;
}

export function validateQuestionBank() {
  for (const level of VOCABULARY_DEPTH_LEVELS) {
    const n = countQuestionsByLevel(level);
    if (n < 30) {
      throw new Error(`Vocabulary Depth: level ${level} has only ${n} questions (need ≥30)`);
    }
  }
  for (const question of ALL_VOCABULARY_DEPTH_QUESTIONS) {
    if (question.level === 'A2' && question.type === 'context') {
      validateA2ContextQuestion(question);
    }
    if (question.level === 'B1' && question.type === 'synonym') {
      validateB1SynonymQuestion(question);
    }
  }
}
