const COMPONENT_BY_TYPE = {
  definition: 'basic_meaning',
  context: 'contextual_word_choice',
  synonym: 'synonym_discrimination',
  collocation: 'collocation_and_phrase_use',
  nuance: 'idiom_and_nuance',
};

const SKILL_BY_TYPE = {
  definition: 'vocabulary_breadth',
  context: 'vocabulary_in_context',
  synonym: 'vocabulary_depth',
  collocation: 'lexical_collocation',
  nuance: 'idiomatic_meaning',
};

const ACTIVITY_TAGS = new Set([
  'english_table',
  'english_club',
  'international_forum',
  'job_talk',
  'writing_workshop',
  'phrasebook',
]);

function normalizeActivityTag(tag) {
  const normalized = String(tag || '').trim().toLowerCase().replace(/-/g, '_');
  return ACTIVITY_TAGS.has(normalized) ? normalized : null;
}

/**
 * Builds item metadata for analytics and future adaptive selection.
 * These fields are intentionally descriptive, not formal calibration claims.
 *
 * @param {object} question
 * @param {object} options
 * @param {string} options.source
 * @param {string} [options.reviewStatus]
 */
export function buildVocabularyDepthItemMetadata(
  question,
  { source, reviewStatus = 'reviewed' } = {},
) {
  const activityTags = (question.tags || [])
    .map(normalizeActivityTag)
    .filter(Boolean);

  return {
    itemId: question.id,
    gameId: 'vocabulary_depth',
    skillDimension: SKILL_BY_TYPE[question.type] || 'vocabulary',
    componentProcess: COMPONENT_BY_TYPE[question.type] || question.type || 'unknown',
    cefrLevel: question.level,
    itemType: question.type || 'mcq',
    activityTags,
    source: source || 'unknown',
    reviewStatus,
  };
}

/**
 * @param {object} question
 * @param {object} options
 */
export function attachVocabularyDepthItemMetadata(question, options = {}) {
  return {
    ...question,
    metadata: buildVocabularyDepthItemMetadata(question, options),
  };
}

