/**
 * CEFR 人工校正：跨題庫衝突、EVP 參考、同形異義。
 * buildCanonicalVocabularyBank.mjs 會套用此表作為 canonical level 權威來源。
 */

/** @type {Record<string, { level: string, note?: string }>} */
export const CEFR_CANONICAL_OVERRIDES = {
  // 跨題庫衝突（audit crossBankConflicts）
  ambiguity: { level: 'B2', note: 'WB B1 / LL B2 → B2' },
  articulate: { level: 'B2', note: 'WB B1 / LL B2 → B2' },
  colleague: { level: 'B1', note: 'WB B2 / LL A2 → B1 workplace' },
  consensus: { level: 'B2', note: 'WB B1 / LL B2 → B2' },
  contribute: { level: 'B1', note: 'WB B2 / LL B1 → B1' },
  corroborate: { level: 'C1', note: 'WB B2 / LL C1 → C1 academic' },
  dichotomy: { level: 'C1', note: 'WB B2 / LL C1 → C1' },
  emphasize: { level: 'B1', note: 'WB B2 / LL B1 → B1' },
  evaluate: { level: 'B1', note: 'WB B2 / LL B1 → B1' },
  facilitate: { level: 'B2', note: 'WB B1 / LL B2 → B2' },
  hypothesis: { level: 'B2', note: 'WB C1 / LL B2 → B2 general academic' },
  implement: { level: 'B1', note: 'WB B2 / LL B1 → B1' },
  interview: { level: 'A2', note: 'WB B1 / LL A2 → A2 Job Talk' },
  maintain: { level: 'B1', note: 'WB B2 / LL B1 → B1' },
  negotiate: { level: 'B2', note: 'WB C1 / LL B2 → B2' },
  perspective: { level: 'B1', note: 'WB B2 / LL B1 → B1' },
  substantiate: { level: 'B2', note: 'WB C1 / LL B2 → B2' },

  // 同形異義：聽力階梯「登記」vs 語彙連橋「語域」（主題已改 sociolect）
  register: { level: 'A2', note: 'verb sign up; sociolinguistics sense → sociolect in WB' },

  // 可疑 A1（EVP 偏 A2）
  library: { level: 'A2', note: 'EVP A2; campus vocabulary' },
  campus: { level: 'A2', note: 'EVP A2' },
  reservation: { level: 'A2', note: 'EEARS domain A2' },
  kitchen: { level: 'A2', note: 'home vocabulary A2' },
  bedroom: { level: 'A2', note: 'home vocabulary A2' },

  // 預期 B1+ 出現在 A2
  appointment: { level: 'B1', note: 'formal scheduling B1' },
  comfortable: { level: 'B1', note: 'abstract adjective B1' },
  discussion: { level: 'B1', note: 'WB A2 theme → canonical B1' },

  // 預期 B2+ 出現在 B1
  abstract: { level: 'B2', note: 'academic noun B2' },
  rhetoric: { level: 'B2', note: 'academic B2' },
  collaborate: { level: 'B2', note: 'WB B1 / academic B2' },
};

/** Word Bridge 主題呈現級別與 canonical 允許差異（主題教學用） */
export const THEME_PRESENTATION_TOLERANCE = 1;
