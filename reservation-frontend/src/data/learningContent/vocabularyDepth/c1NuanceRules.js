/**
 * C1 細微語意題 — 四個選項使用相同英文片語結構，避免正解句型不同
 */

/** @typedef {{ text: string, textZh: string }} C1NuanceOption */

/** @typedef {{ prompt: string, promptZh: string, correct: C1NuanceOption, distractors: C1NuanceOption[] }} C1NuanceEntry */

/** @type {Record<string, C1NuanceEntry>} */
export const C1_NUANCES = {
  accreditation: {
    prompt: 'In higher education, "accreditation" refers to…',
    promptZh: '在高等教育中，「accreditation」指的是…',
    correct: { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
    distractors: [
      { text: 'gradual adjustment to new conditions', textZh: '對新環境的逐步調適' },
      { text: 'public support for a policy or cause', textZh: '對政策或理念的公開支持' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  adaptation: {
    prompt: 'In climate science, "adaptation" refers to…',
    promptZh: '在氣候科學中，「adaptation」指的是…',
    correct: { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'public support for a policy or cause', textZh: '對政策或理念的公開支持' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  advocacy: {
    prompt: 'In policy debate, "advocacy" refers to…',
    promptZh: '在政策辯論中，「advocacy」指的是…',
    correct: { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  algorithm: {
    prompt: 'In computer science, "algorithm" refers to…',
    promptZh: '在電腦科學中，「algorithm」指的是…',
    correct: { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
    ],
  },
  assimilation: {
    prompt: 'In sociology, "assimilation" refers to…',
    promptZh: '在社會學中，「assimilation」指的是…',
    correct: { text: 'integration into a wider cultural group', textZh: '融入較大的文化群體' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  asylum: {
    prompt: 'In international law, "asylum" refers to…',
    promptZh: '在國際法中，「asylum」指的是…',
    correct: { text: 'protection granted to refugees', textZh: '授予難民的法律保護' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  automation: {
    prompt: 'In industry, "automation" refers to…',
    promptZh: '在產業中，「automation」指的是…',
    correct: { text: 'use of machines to perform tasks', textZh: '以機器執行工作' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
      { text: 'protection granted to refugees', textZh: '授予難民的法律保護' },
    ],
  },
  bias: {
    prompt: 'In research ethics, "bias" refers to…',
    promptZh: '在研究倫理中，「bias」指的是…',
    correct: { text: 'systematic distortion of results or judgment', textZh: '對結果或判斷的系統性偏差' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  biodiversity: {
    prompt: 'In ecology, "biodiversity" refers to…',
    promptZh: '在生態學中，「biodiversity」指的是…',
    correct: { text: 'variety of life in an ecosystem', textZh: '生態系中的生物多樣性' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  breach: {
    prompt: 'In contract law, "breach" refers to…',
    promptZh: '在契約法中，「breach」指的是…',
    correct: { text: 'violation of a legal obligation', textZh: '違反法律義務' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'protection granted to refugees', textZh: '授予難民的法律保護' },
    ],
  },
  chronic: {
    prompt: 'In medicine, "chronic" describes…',
    promptZh: '在醫學中，「chronic」描述…',
    correct: { text: 'a condition lasting for a long time', textZh: '長期持續的狀況' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  citation: {
    prompt: 'In academic writing, "citation" refers to…',
    promptZh: '在學術寫作中，「citation」指的是…',
    correct: { text: 'a reference to a source of information', textZh: '引用資訊來源' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  clinical: {
    prompt: 'In healthcare, "clinical" relates to…',
    promptZh: '在醫療領域中，「clinical」與…相關',
    correct: { text: 'direct observation and treatment of patients', textZh: '對病人的直接診察與治療' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  cognitive: {
    prompt: 'In psychology, "cognitive" relates to…',
    promptZh: '在心理學中，「cognitive」與…相關',
    correct: { text: 'mental processes like thinking and memory', textZh: '思考與記憶等心智歷程' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'protection granted to refugees', textZh: '授予難民的法律保護' },
    ],
  },
  coherent: {
    prompt: 'In argumentation, "coherent" describes…',
    promptZh: '在論證中，「coherent」描述…',
    correct: { text: 'logical and easy to follow', textZh: '邏輯清楚、易於理解' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  compliance: {
    prompt: 'In regulation, "compliance" refers to…',
    promptZh: '在法規遵循中，「compliance」指的是…',
    correct: { text: 'acting according to rules or laws', textZh: '依規則或法律行事' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
  compromise: {
    prompt: 'In negotiation, "compromise" refers to…',
    promptZh: '在協商中，「compromise」指的是…',
    correct: { text: 'a settlement where each side gives up something', textZh: '雙方各讓一步的協議' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'active support for a policy or cause', textZh: '對政策或理念的積極支持' },
      { text: 'protection granted to refugees', textZh: '授予難民的法律保護' },
    ],
  },
  concession: {
    prompt: 'In diplomacy, "concession" refers to…',
    promptZh: '在外交中，「concession」指的是…',
    correct: { text: 'something given up to reach agreement', textZh: '為達成協議而讓步的事項' },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  },
};

const LEAKY_C1_PATTERNS = [
  /^a term meaning/i,
  /^something connected to/i,
  /^a concept related to/i,
  /意為「/,
  /與「.*」相關/,
];

/**
 * @param {{ word: string, options: { id: string, text: string, textZh?: string }[], correctOptionId: string, type?: string }} question
 */
export function validateC1NuanceQuestion(question) {
  if (question.type && question.type !== 'nuance') return;

  for (const opt of question.options) {
    for (const re of LEAKY_C1_PATTERNS) {
      if (re.test(opt.text) || re.test(opt.textZh || '')) {
        throw new Error(`C1 nuance leaky option pattern: ${question.word}`);
      }
    }
    if (/[\u4e00-\u9fff]/.test(opt.text)) {
      throw new Error(`C1 nuance option text has CJK: ${question.word}`);
    }
  }
}

/**
 * @param {{ word: string, zh: string }} entry
 * @returns {C1NuanceEntry}
 */
export function getC1Nuance(entry) {
  const mapped = C1_NUANCES[entry.word.toLowerCase()];
  if (mapped) return mapped;
  return {
    prompt: `"${entry.word}" most nearly means…`,
    promptZh: `「${entry.word}」最接近的意思是…`,
    correct: { text: 'a specialized concept in formal discourse', textZh: entry.zh },
    distractors: [
      { text: 'official recognition of quality standards', textZh: '對品質標準的正式認可' },
      { text: 'adjustment to changing environmental conditions', textZh: '對環境變化的調適' },
      { text: 'a step-by-step computational procedure', textZh: '逐步運算的程序' },
    ],
  };
}
