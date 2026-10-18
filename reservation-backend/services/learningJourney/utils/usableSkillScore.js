'use strict';

/**
 * 技能原始分必須大於此值，才算進前後測成長。
 * 0 與 1 是缺考占位（培力 no-show 常把分數欄寫成 0）。
 * BESTEP 錨點把 0 分成 GSE 22 或 30，前測若在 B1/B2，成長會變成大約 -30。
 */
const MIN_EXCLUSIVE_SKILL_RAW_SCORE = 1;

function isUsableSkillRawScore(rawScore) {
  if (rawScore == null || rawScore === '') return false;
  const score = Number(rawScore);
  return Number.isFinite(score) && score > MIN_EXCLUSIVE_SKILL_RAW_SCORE;
}

/** 欄位缺席時不剔除；有填而且不大於 1 才視為無效成績。 */
function isPlaceholderSkillScore(rawScore) {
  if (rawScore == null || rawScore === '') return false;
  return !isUsableSkillRawScore(rawScore);
}

function isUsableGrowthPair(exam) {
  if (!exam) return false;
  return !isPlaceholderSkillScore(exam.rawScore)
    && !isPlaceholderSkillScore(exam.previousRawScore);
}

function partitionGrowthExams(exams) {
  const usable = [];
  let excludedPlaceholderScoreRows = 0;
  for (const exam of exams || []) {
    if (!exam || !exam.retestFlag) continue;
    if (isPlaceholderSkillScore(exam.rawScore) || isPlaceholderSkillScore(exam.previousRawScore)) {
      excludedPlaceholderScoreRows += 1;
      continue;
    }
    if (exam.deltaRawScore == null) continue;
    usable.push(exam);
  }
  return { usable, excludedPlaceholderScoreRows };
}

module.exports = {
  MIN_EXCLUSIVE_SKILL_RAW_SCORE,
  isUsableSkillRawScore,
  isPlaceholderSkillScore,
  isUsableGrowthPair,
  partitionGrowthExams,
};
