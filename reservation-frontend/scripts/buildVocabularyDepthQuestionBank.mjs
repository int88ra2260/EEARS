/**
 * 從 canonical 單字庫 + EEARS 活動情境生成 Vocabulary Depth 題目
 *
 * Usage: node scripts/buildVocabularyDepthQuestionBank.mjs [--check]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_VOCABULARY } from '../src/data/learningContent/vocabulary/canonicalVocabulary.js';
import { VOCABULARY_DEPTH_QUESTIONS_EXTENDED } from '../src/data/learningContent/vocabularyDepth/questionBankExtended.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '../src/data/learningContent/vocabularyDepth/questionBankGenerated.js');
const HANDCRAFTED_BASE_PATH = path.join(__dirname, '../src/data/learningContent/vocabularyDepth/questionBank.js');

function extractHandcraftedFromSource(content) {
  /** @type {{ id: string, level: string, word: string }[]} */
  const items = [];
  const re = /id: '(vd_[^']+)'[\s\S]*?level: '(A1|A2|B1|B2|C1)'[\s\S]*?word: '([^']+)'/g;
  let m = re.exec(content);
  while (m) {
    items.push({ id: m[1], level: m[2], word: m[3] });
    m = re.exec(content);
  }
  return items;
}

function loadHandcrafted() {
  const baseContent = fs.readFileSync(HANDCRAFTED_BASE_PATH, 'utf8');
  const base = extractHandcraftedFromSource(baseContent);
  const extended = VOCABULARY_DEPTH_QUESTIONS_EXTENDED.map((q) => ({
    id: q.id,
    level: q.level,
    word: q.word,
  }));
  return [...base, ...extended];
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];
const MIN_PER_LEVEL = 30;
const OPTION_IDS = ['a', 'b', 'c', 'd'];

const TOPIC_PREFIX = {
  reservation: 'At EEARS',
  english_table: 'In English Table',
  english_club: 'In English Club',
  international_forum: 'International Forum',
  job_talk: 'Job Talk',
  campus_life: 'On campus',
};

const TOPIC_PREFIX_ZH = {
  reservation: 'EEARS 預約',
  english_table: 'English Table',
  english_club: 'English Club',
  international_forum: 'International Forum',
  job_talk: 'Job Talk',
  campus_life: '校園生活',
};

function hashWord(word) {
  let h = 0;
  for (let i = 0; i < word.length; i += 1) {
    h = (h * 31 + word.charCodeAt(i)) >>> 0;
  }
  return h;
}

function getPosCategory(entry) {
  const raw = (entry.pos || entry.listening?.pos || 'noun').toLowerCase();
  if (raw.startsWith('verb')) return 'verb';
  if (raw.startsWith('adj')) return 'adjective';
  if (raw.startsWith('adv')) return 'adverb';
  if (raw.startsWith('inter')) return 'interjection';
  return 'noun';
}

/**
 * 依 EEARS 活動情境 + 詞性選句；每題含英文填空句與中文提示。
 * @type {Record<string, Record<string, { en: string, zh: string }[]>>}
 */
const A2_PATTERNS = {
  reservation: {
    noun: [
      { en: 'I made a ______ for English Table.', zh: '我為 English Table 預約了 ______。' },
      { en: 'Please check the activity ______.', zh: '請查看 activity ______。' },
    ],
    verb: [
      { en: 'Please ______ before the session starts.', zh: '活動開始前請先 ______。' },
      { en: "Don't forget to ______ online.", zh: '別忘了線上 ______。' },
      { en: 'I need to ______ my booking.', zh: '我需要 ______ 我的預約。' },
    ],
    adjective: [
      { en: 'Is this seat still ______?', zh: '這個座位還 ______ 嗎？' },
      { en: 'Is this time slot still ______?', zh: '這個時段還 ______ 嗎？' },
    ],
  },
  english_table: {
    noun: [
      { en: 'That was a helpful ______.', zh: '那是個很有幫助的 ______。' },
      { en: 'Could you clarify this ______?', zh: '可以說明這個 ______ 嗎？' },
    ],
    verb: [
      { en: 'Could you ______ that again?', zh: '可以請你再 ______ 一次嗎？' },
      { en: 'Let me ______ myself.', zh: '讓我先 ______ 自己。' },
      { en: "I didn't ______ the question.", zh: '我沒 ______ 那個問題。' },
      { en: 'We ______ about travel today.', zh: '今天我們 ______ 旅行。' },
    ],
  },
  english_club: {
    noun: [
      { en: 'We shared our ______ on the topic.', zh: '我們分享了對這個主題的 ______。' },
      { en: 'That was a lively ______.', zh: '那是一場很熱絡的 ______。' },
    ],
    verb: [
      { en: "Let's ______ the main points.", zh: '讓我們 ______ 重點。' },
      { en: 'Please ______ your idea clearly.', zh: '請清楚 ______ 你的想法。' },
    ],
  },
  international_forum: {
    noun: [
      { en: 'We discussed ______ and customs.', zh: '我們討論了 ______ 與習俗。' },
      { en: "Don't forget your ______ when you travel.", zh: '旅行時別忘了你的 ______。' },
      { en: 'Students from each ______ introduced themselves.', zh: '來自各 ______ 的學生做了自我介紹。' },
      { en: 'It was a great cultural ______.', zh: '那是一次很棒的文化 ______。' },
    ],
    verb: [
      { en: 'We ______ ideas with students abroad.', zh: '我們與海外學生 ______ 想法。' },
    ],
  },
  job_talk: {
    noun: [
      { en: 'I have a job ______ tomorrow.', zh: '我明天有一場 job ______。' },
      { en: 'Please bring your ______ to the session.', zh: '請帶你的 ______ 來參加。' },
      { en: 'What ______ are you interested in?', zh: '你對哪種 ______ 有興趣？' },
      { en: 'My ______ gave me useful feedback.', zh: '我的 ______ 給了我有用的回饋。' },
    ],
    verb: [
      { en: 'Please ______ your resume.', zh: '請 ______ 你的履歷。' },
      { en: 'I need to ______ for the interview.', zh: '我需要為面試做 ______。' },
    ],
  },
  campus_life: {
    noun: [
      { en: "Don't forget your ______.", zh: '別忘了你的 ______。' },
      { en: 'We talked about ______ in class.', zh: '我們在課上談到了 ______。' },
      { en: 'Every student needs a ______.', zh: '每位學生都需要 ______。' },
      { en: 'Our ______ starts at ten.', zh: '我們的 ______ 十點開始。' },
    ],
    verb: [
      { en: 'I want to ______ after class.', zh: '下課後我想 ______。' },
      { en: 'Please ______ before you leave.', zh: '離開前請 ______。' },
      { en: 'I need to ______ the library after class.', zh: '下課後我需要 ______ 圖書館。' },
    ],
    adjective: [
      { en: 'Are you ______ with this schedule?', zh: '你對這個行程感到 ______ 嗎？' },
    ],
  },
};

/** @type {Record<string, Record<string, { en: string, zh: string }[]>>} */
const B1_PATTERNS = {
  reservation: {
    noun: [
      { en: 'Students must complete the ______ before booking.', zh: '學生預約前需完成 ______。' },
    ],
    verb: [
      { en: 'Students must ______ in advance to join the activity.', zh: '學生必須提前 ______ 才能參加活動。' },
    ],
  },
  english_table: {
    verb: [
      { en: 'Try to ______ actively in the conversation.', zh: '試著在對話中積極 ______。' },
      { en: 'Could you ______ your answer more clearly?', zh: '你能更清楚地 ______ 你的回答嗎？' },
    ],
    noun: [
      { en: 'Share your ______ with the group.', zh: '與小組分享你的 ______。' },
    ],
  },
  english_club: {
    verb: [
      { en: 'We need to ______ the discussion before we finish.', zh: '結束前我們需要 ______ 討論。' },
    ],
    noun: [
      { en: 'She made a strong ______ during the debate.', zh: '她在辯論中提出了有力的 ______。' },
    ],
  },
  international_forum: {
    noun: [
      { en: 'Each speaker offered a different ______ on the issue.', zh: '每位發言者對此議題提出了不同的 ______。' },
    ],
    verb: [
      { en: 'We should ______ different cultural views.', zh: '我們應該 ______ 不同的文化觀點。' },
    ],
  },
  job_talk: {
    verb: [
      { en: 'Can you ______ a colleague who knows this industry?', zh: '你能 ______ 一位了解這個產業的同事嗎？' },
    ],
    noun: [
      { en: 'Highlight your relevant ______ in the interview.', zh: '在面試中強調你相關的 ______。' },
    ],
  },
  campus_life: {
    noun: [
      { en: 'This ______ helped me become more confident.', zh: '這個 ______ 讓我更有自信。' },
    ],
    verb: [
      { en: 'This course helped me ______ new skills.', zh: '這門課幫助我 ______ 新技能。' },
    ],
  },
};

function pickPattern(patternsByTopic, topic, pos, word, seq) {
  const topicPatterns = patternsByTopic[topic] || patternsByTopic.campus_life;
  const pool = topicPatterns[pos] || topicPatterns.noun || patternsByTopic.campus_life.noun;
  return pool[(hashWord(word) + seq) % pool.length];
}

function buildContextPrompts(entry, topic, patterns, seq) {
  const pos = getPosCategory(entry);
  const prefix = TOPIC_PREFIX[topic] || TOPIC_PREFIX.campus_life;
  const prefixZh = TOPIC_PREFIX_ZH[topic] || TOPIC_PREFIX_ZH.campus_life;
  const pattern = pickPattern(patterns, topic, pos, entry.word, seq);
  const hint = entry.zh;
  return {
    prompt: `${prefix}: "${pattern.en}" (${hint})`,
    promptZh: `${prefixZh}：「${pattern.en}」（提示：${hint}）`,
  };
}

/** @deprecated — replaced by A2_PATTERNS */
const A2_SENTENCE_TEMPLATES = {
  reservation: [
    '______: "I made a ______ for {activity}."',
    '______: "Please ______ before the session starts."',
    '______: "Is there still a seat ______?"',
    '______: "Don\'t forget to ______ online."',
  ],
  english_table: [
    '______: "Could you ______ that again?"',
    '______: "Let me ______ myself."',
    '______: "I didn\'t ______ the question."',
    '______: "We ______ about travel today."',
  ],
  english_club: [
    '______: "We shared our ______ on the topic."',
    '______: "Let\'s ______ the main points."',
    '______: "That was a lively ______."',
    '______: "Please ______ your idea clearly."',
  ],
  international_forum: [
    '______: "We discussed ______ and customs."',
    '______: "Students from each ______ introduced themselves."',
    '______: "Don\'t forget your ______ when you travel."',
    '______: "It was a great cultural ______."',
  ],
  job_talk: [
    '______: "I have a job ______ tomorrow."',
    '______: "Please ______ your resume."',
    '______: "What ______ are you interested in?"',
    '______: "My ______ gave me useful feedback."',
  ],
  campus_life: [
    '______: "I need to ______ the library after class."',
    '______: "Our ______ starts at ten."',
    '______: "Are you free ______ afternoon?"',
    '______: "Every ______ helps me improve."',
  ],
};

/** @deprecated — replaced by B1_PATTERNS */
const B1_SENTENCE_TEMPLATES = {
  reservation: '______: "Students must ______ in advance to join the activity."',
  english_table: '______: "Try to ______ actively in the conversation."',
  english_club: '______: "We need to ______ the discussion before we finish."',
  international_forum: '______: "Each speaker offered a different ______ on the issue."',
  job_talk: '______: "Can you ______ a colleague who knows this industry?"',
  campus_life: '______: "This ______ helped me become more confident."',
};

/** @type {Record<string, string[]>} */
const B2_COLLOCATION_TEMPLATES = {
  verb: [
    'Which collocation is correct?',
    'In academic writing, which phrase fits?',
    'Which phrase do native speakers use?',
  ],
  noun: [
    'Which collocation is correct?',
    'In a discussion, which phrase fits best?',
  ],
};

/** @type {{ id: string, prompt: string, promptZh: string, answer: string, answerZh: string, distractors: string[], distractorsZh: string[], tags: string[] }[]} */
const C1_NUANCE_SEEDS = [
  {
    id: 'vd_c1_idiom_01',
    prompt: '"Give someone the benefit of the doubt" means…',
    promptZh: '「Give someone the benefit of the doubt」意為…',
    answer: 'assume they are innocent until proven otherwise',
    answerZh: '在沒有證據前先往好處想',
    distractors: ['pay them money', 'cancel their reservation', 'speak louder'],
    distractorsZh: ['付錢給對方', '取消對方預約', '大聲說話'],
    tags: ['english_club'],
  },
  {
    id: 'vd_c1_idiom_02',
    prompt: '"On the same page" means…',
    promptZh: '「On the same page」意為…',
    answer: 'in agreement about the plan or idea',
    answerZh: '對計畫或想法有一致理解',
    distractors: ['reading the same book', 'sitting together', 'writing homework'],
    distractorsZh: ['讀同一本書', '坐在一起', '寫作業'],
    tags: ['english_table'],
  },
  {
    id: 'vd_c1_idiom_03',
    prompt: '"Back to the drawing board" means…',
    promptZh: '「Back to the drawing board」意為…',
    answer: 'start planning again after failure',
    answerZh: '失敗後重新規劃',
    distractors: ['go to art class', 'draw a map', 'leave the meeting early'],
    distractorsZh: ['去上美術課', '畫地圖', '提早離開會議'],
    tags: ['job_talk'],
  },
  {
    id: 'vd_c1_idiom_04',
    prompt: '"Read between the lines" means…',
    promptZh: '「Read between the lines」意為…',
    answer: 'understand the hidden meaning',
    answerZh: '理解言外之意',
    distractors: ['read faster', 'skip a paragraph', 'translate literally'],
    distractorsZh: ['讀快一點', '跳過一段', '逐字翻譯'],
    tags: ['international_forum'],
  },
  {
    id: 'vd_c1_idiom_05',
    prompt: '"Cut to the chase" means…',
    promptZh: '「Cut to the chase」意為…',
    answer: 'get to the main point quickly',
    answerZh: '直接講重點',
    distractors: ['run away', 'watch a movie', 'change the topic slowly'],
    distractorsZh: ['跑開', '看電影', '慢慢轉題'],
    tags: ['english_club'],
  },
];

const HANDCRAFTED = loadHandcrafted();
const HANDCRAFTED_KEYS = new Set(
  HANDCRAFTED.map((q) => `${q.level}:${q.word.toLowerCase()}`),
);
const HANDCRAFTED_IDS = new Set(HANDCRAFTED.map((q) => q.id));

function pickTopic(entry) {
  return entry.listening?.topic || entry.topics?.[0] || 'campus_life';
}

function pickDistractorWords(level, excludeWord, count = 3) {
  const pool = CANONICAL_VOCABULARY.filter(
    (e) => e.level === level && e.word.toLowerCase() !== excludeWord.toLowerCase(),
  );
  const picked = [];
  const used = new Set([excludeWord.toLowerCase()]);
  let i = 0;
  while (picked.length < count && i < pool.length * 3) {
    const candidate = pool[i % pool.length];
    const key = candidate.word.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      picked.push(candidate);
    }
    i += 1;
  }
  return picked;
}

function buildOptions(correct, distractors) {
  const items = [
    { text: correct.text, textZh: correct.textZh, isCorrect: true },
    ...distractors.map((d) => ({ text: d.text, textZh: d.textZh, isCorrect: false })),
  ].slice(0, 4);
  while (items.length < 4) {
    items.push({ text: '—', textZh: '—', isCorrect: false });
  }
  return items.map((item, index) => ({
    id: OPTION_IDS[index],
    text: item.text,
    textZh: item.textZh,
    ...(item.isCorrect ? { _correct: true } : {}),
  }));
}

function finalizeQuestion(raw) {
  const correctIndex = raw.options.findIndex((o) => o._correct);
  const options = raw.options.map(({ _correct, ...opt }) => opt);
  return {
    ...raw,
    options,
    correctOptionId: options[Math.max(0, correctIndex)].id,
  };
}

function makeA1Definition(entry, seq) {
  const distractors = pickDistractorWords('A1', entry.word, 3);
  const options = buildOptions(
    { text: entry.word, textZh: entry.word },
    distractors.map((d) => ({ text: d.word, textZh: d.word })),
  );
  return finalizeQuestion({
    id: `vd_gen_a1_${String(seq).padStart(3, '0')}`,
    level: 'A1',
    type: 'definition',
    word: entry.word,
    prompt: `What is the English word for 「${entry.zh}」?`,
    promptZh: `「${entry.zh}」的英文單字是？`,
    options,
    explanationEn: `"${entry.word}" means ${entry.zh}.`,
    explanationZh: `${entry.word} 的意思是「${entry.zh}」。`,
    tags: [pickTopic(entry)],
  });
}

function makeA2Context(entry, seq) {
  const topic = pickTopic(entry);
  const { prompt, promptZh } = buildContextPrompts(entry, topic, A2_PATTERNS, seq);
  const listeningD = entry.listening?.distractors || [];
  const fallback = pickDistractorWords('A2', entry.word, 3).map((d) => d.word);
  const distractorWords = [...new Set([...listeningD, ...fallback])].slice(0, 3);
  const options = buildOptions(
    { text: entry.word, textZh: entry.word },
    distractorWords.map((w) => ({ text: w, textZh: w })),
  );
  return finalizeQuestion({
    id: `vd_gen_a2_${String(seq).padStart(3, '0')}`,
    level: 'A2',
    type: 'context',
    word: entry.word,
    prompt,
    promptZh,
    options,
    explanationEn: `"${entry.word}" (${entry.zh}) best completes: ${prompt}`,
    explanationZh: `此句應填 ${entry.word}（${entry.zh}）。`,
    tags: [topic],
  });
}

function makeB1Synonym(entry, seq) {
  const topic = pickTopic(entry);
  const { prompt, promptZh } = buildContextPrompts(entry, topic, B1_PATTERNS, seq);
  const listeningD = entry.listening?.distractors || [];
  const fallback = pickDistractorWords('B1', entry.word, 3).map((d) => d.word);
  const distractorWords = [...new Set([...listeningD, ...fallback])].slice(0, 3);
  const options = buildOptions(
    { text: entry.word, textZh: entry.word },
    distractorWords.map((w) => ({ text: w, textZh: w })),
  );
  return finalizeQuestion({
    id: `vd_gen_b1_${String(seq).padStart(3, '0')}`,
    level: 'B1',
    type: 'synonym',
    word: entry.word,
    prompt,
    promptZh,
    options,
    explanationEn: `"${entry.word}" (${entry.zh}) best completes the sentence.`,
    explanationZh: `此句應使用 ${entry.word}（${entry.zh}）。`,
    tags: [topic],
  });
}

const B2_VERB_OBJECTS = {
  analyze: 'the data',
  demonstrate: 'your skills',
  facilitate: 'the discussion',
  prioritize: 'your tasks',
  summarize: 'the main points',
  negotiate: 'a solution',
  collaborate: 'with peers',
  acknowledge: 'the concern',
  clarify: 'your point',
  influence: 'the outcome',
};

function makeB2Collocation(entry, seq) {
  const topic = pickTopic(entry);
  const pos = entry.pos || entry.listening?.pos || 'noun';
  const verbObj = B2_VERB_OBJECTS[entry.word.toLowerCase()];
  let prompt;
  let correctText;
  if (verbObj) {
    prompt = 'Which collocation is correct?';
    correctText = `${entry.word} ${verbObj}`;
  } else if (pos.startsWith('verb')) {
    prompt = B2_COLLOCATION_TEMPLATES.verb[seq % B2_COLLOCATION_TEMPLATES.verb.length];
    correctText = `${entry.word} effectively`;
  } else {
    prompt = B2_COLLOCATION_TEMPLATES.noun[seq % B2_COLLOCATION_TEMPLATES.noun.length];
    correctText = `a clear ${entry.word}`;
  }
  const distractors = pickDistractorWords('B2', entry.word, 3).map((d) => {
    if (verbObj) return `${d.word} ${verbObj}`;
    if (pos.startsWith('verb')) return `${d.word} effectively`;
    return `a clear ${d.word}`;
  });
  const options = buildOptions(
    { text: correctText, textZh: correctText },
    distractors.map((text) => ({ text, textZh: text })),
  );
  return finalizeQuestion({
    id: `vd_gen_b2_${String(seq).padStart(3, '0')}`,
    level: 'B2',
    type: 'collocation',
    word: entry.word,
    prompt,
    promptZh: '哪個搭配正確？',
    options,
    explanationEn: `"${correctText}" is a natural collocation with "${entry.word}".`,
    explanationZh: `${entry.word}（${entry.zh}）的自然搭配是 "${correctText}"。`,
    tags: [topic],
  });
}

function makeC1NuanceFromSeed(seed) {
  const options = buildOptions(
    { text: seed.answer, textZh: seed.answerZh },
    seed.distractors.map((text, i) => ({ text, textZh: seed.distractorsZh[i] || text })),
  );
  return finalizeQuestion({
    id: seed.id,
    level: 'C1',
    type: 'nuance',
    word: seed.id,
    prompt: seed.prompt,
    promptZh: seed.promptZh,
    options,
    tags: seed.tags,
  });
}

function makeC1Academic(entry, seq) {
  const topic = pickTopic(entry);
  const prefix = TOPIC_PREFIX[topic] || 'In discussion';
  const prefixZh = TOPIC_PREFIX_ZH[topic] || TOPIC_PREFIX_ZH.campus_life;
  const enSentence = `The term "${entry.word}" refers to…`;
  const prompt = `${prefix}: ${enSentence}`;
  const promptZh = `${prefixZh}：「${enSentence}」（提示：${entry.zh}）`;
  const distractors = pickDistractorWords('C1', entry.word, 3);
  const options = buildOptions(
    { text: entry.zh, textZh: entry.zh },
    distractors.map((d) => ({ text: d.zh, textZh: d.zh })),
  );
  return finalizeQuestion({
    id: `vd_gen_c1_${String(seq).padStart(3, '0')}`,
    level: 'C1',
    type: 'nuance',
    word: entry.word,
    prompt,
    promptZh,
    options,
    explanationEn: `"${entry.word}" relates to: ${entry.zh}.`,
    explanationZh: `${entry.word} 與「${entry.zh}」相關。`,
    tags: [topic],
  });
}

function generateForLevel(level) {
  /** @type {ReturnType<typeof finalizeQuestion>[]} */
  const generated = [];
  const entries = CANONICAL_VOCABULARY.filter((e) => e.level === level);

  let seq = 1;
  for (const entry of entries) {
    const key = `${level}:${entry.word.toLowerCase()}`;
    if (HANDCRAFTED_KEYS.has(key)) continue;

    let question;
    if (level === 'A1') question = makeA1Definition(entry, seq);
    else if (level === 'A2') question = makeA2Context(entry, seq);
    else if (level === 'B1') question = makeB1Synonym(entry, seq);
    else if (level === 'B2') question = makeB2Collocation(entry, seq);
    else if (level === 'C1') question = makeC1Academic(entry, seq);
    else continue;

    if (HANDCRAFTED_IDS.has(question.id)) continue;
    generated.push(question);
    seq += 1;
  }

  if (level === 'C1') {
    for (const seed of C1_NUANCE_SEEDS) {
      if (!HANDCRAFTED_IDS.has(seed.id)) {
        generated.push(makeC1NuanceFromSeed(seed));
      }
    }
  }

  return generated;
}

function generateAll() {
  /** @type {ReturnType<typeof finalizeQuestion>[]} */
  const all = [];
  for (const level of LEVELS) {
    all.push(...generateForLevel(level));
  }
  return all;
}

function validateGeneratedPrompts(questions) {
  for (const q of questions) {
    if (q.type === 'context' || q.type === 'synonym') {
      if (!q.prompt?.includes('______')) {
        throw new Error(`${q.id}: prompt missing blank`);
      }
      if (!q.promptZh?.includes('______') || !q.promptZh?.includes('提示：')) {
        throw new Error(`${q.id}: promptZh incomplete (${q.promptZh})`);
      }
      if (/情境填空$/.test(q.promptZh) || q.promptZh.length < 20) {
        throw new Error(`${q.id}: promptZh too generic (${q.promptZh})`);
      }
    }
  }
}

function validateCounts(questions) {
  validateGeneratedPrompts(questions);
  for (const level of LEVELS) {
    const hand = HANDCRAFTED.filter((q) => q.level === level).length;
    const gen = questions.filter((q) => q.level === level).length;
    const total = hand + gen;
    if (total < MIN_PER_LEVEL) {
      throw new Error(`Level ${level}: only ${total} questions (hand ${hand} + gen ${gen}); need ≥${MIN_PER_LEVEL}`);
    }
  }
}

function renderModule(questions) {
  const counts = LEVELS.map((level) => {
    const hand = HANDCRAFTED.filter((q) => q.level === level).length;
    const gen = questions.filter((q) => q.level === level).length;
    return `  ${level}: hand ${hand} + generated ${gen} = ${hand + gen}`;
  }).join('\n');

  return `/**
 * Vocabulary Depth — AUTO-GENERATED from canonical vocabulary + EEARS contexts
 * Run: npm run build:vocabulary-depth-bank
 * Per-level totals (with hand-crafted):
${counts}
 * Do not edit manually.
 */

/** @type {import('./questionBank').VocabularyDepthQuestion[]} */
export const VOCABULARY_DEPTH_QUESTIONS_GENERATED = ${JSON.stringify(questions, null, 2)};
`;
}

const isCheck = process.argv.includes('--check');
const generated = generateAll();
validateCounts(generated);

if (isCheck) {
  console.log('Vocabulary Depth question bank OK');
  for (const level of LEVELS) {
    const hand = HANDCRAFTED.filter((q) => q.level === level).length;
    const gen = generated.filter((q) => q.level === level).length;
    console.log(`  ${level}: ${hand + gen} (${hand} hand + ${gen} generated)`);
  }
  process.exit(0);
}

fs.writeFileSync(OUT_PATH, renderModule(generated), 'utf8');
console.log(`Wrote ${generated.length} generated questions → ${path.relative(process.cwd(), OUT_PATH)}`);
for (const level of LEVELS) {
  const hand = HANDCRAFTED.filter((q) => q.level === level).length;
  const gen = generated.filter((q) => q.level === level).length;
  console.log(`  ${level}: ${hand + gen} total`);
}
