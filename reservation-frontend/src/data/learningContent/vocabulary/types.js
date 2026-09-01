/**
 * @typedef {Object} CanonicalListeningMeta
 * @property {string} topic
 * @property {string} pos
 * @property {string[]} distractors
 */

/**
 * @typedef {Object} CanonicalVocabEntry
 * @property {string} id
 * @property {string} word
 * @property {string} level — canonical CEFR（各微學習共用）
 * @property {string} zh
 * @property {('word_bridge'|'listening_ladder'|'vocabulary_depth')[]} sources
 * @property {string} [pos]
 * @property {string[]} [topics]
 * @property {string[]} [wbThemes]
 * @property {string} [wbPresentationLevel] — Word Bridge 主題呈現級別（若與 canonical 不同）
 * @property {string} [cefrNote]
 * @property {CanonicalListeningMeta} [listening]
 */

export {};
