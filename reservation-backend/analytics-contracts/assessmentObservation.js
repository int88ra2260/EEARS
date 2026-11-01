'use strict';

const { normalizeFlags } = require('./assessmentQualityFlags');

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return Object.freeze(value);
}

function studentReference(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { studentId: null, matchKey: null, identityRisk: null };
  }
  const studentId = String(raw).trim().toUpperCase();
  const folded = studentId.normalize('NFKC');
  return {
    studentId,
    matchKey: studentId,
    identityRisk: folded === studentId ? null : 'nfkc_fold_differs',
  };
}

function interpretCefr(value) {
  if (value == null || String(value).trim() === '') {
    return { original: null, normalized: null, loss: false, missing: true };
  }
  const text = String(value).trim().replace(/＋/g, '+').replace(/\s+/g, '').toUpperCase();
  const match = text.match(/^(A1|A2|B1|B2|C1|C2)(\+)?$/);
  if (!match) {
    return { original: text, normalized: null, loss: false, missing: true };
  }
  const plus = Boolean(match[2]);
  return {
    original: plus ? `${match[1]}+` : null,
    normalized: match[1],
    loss: plus,
    missing: false,
  };
}

function interpretScore(value) {
  if (value == null || value === '') return { score: null, missing: true };
  const score = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
  if (!Number.isFinite(score)) return { score: null, missing: true };
  return { score, missing: false };
}

/**
 * 不呼叫 Temporal Builder，也不把學期補成日期。
 * 本函式不把 1970-01-01 當成哨兵。哨兵只在 exam_attempts adapter 看到已確認的培力投影時才套用。
 */
function interpretAssessmentDate(value, options) {
  const semester = options && options.semester;
  const hinted = options && options.dateProvenance;
  if (hinted === 'inferred') {
    const text = value == null ? null : String(value).slice(0, 10);
    return {
      assessmentDate: /^\d{4}-\d{2}-\d{2}$/.test(text || '') ? text : null,
      datePrecision: 'inferred',
      dateProvenance: 'caller_marked_inferred',
      flags: ['INFERRED_ASSESSMENT_DATE'],
    };
  }
  if (value == null || String(value).trim() === '') {
    const flags = ['MISSING_ASSESSMENT_DATE'];
    if (semester) flags.push('SEMESTER_ONLY_DATE');
    return {
      assessmentDate: null,
      datePrecision: semester ? 'semester' : 'unknown',
      dateProvenance: semester ? 'semester_label' : 'unknown',
      flags,
    };
  }
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return {
      assessmentDate: null,
      datePrecision: 'unknown',
      dateProvenance: 'unparsed',
      flags: ['MISSING_ASSESSMENT_DATE'],
    };
  }
  return {
    assessmentDate: text,
    datePrecision: 'date',
    dateProvenance: (options && options.statedProvenance) || 'stated_column',
    flags: [],
  };
}

function createObservation(parts) {
  const flags = normalizeFlags(parts.qualityFlags);
  return deepFreeze({
    observationId: parts.observationId,
    sourceIdentity: parts.sourceIdentity,
    studentReference: parts.studentReference,
    assessment: parts.assessment,
    result: {
      skill: parts.result.skill,
      rawScore: parts.result.rawScore,
      normalizedScore: null,
      cefrLevel: parts.result.cefrLevel,
      originalCefrLevel: parts.result.originalCefrLevel,
    },
    qualityFlags: flags,
    provenance: parts.provenance,
  });
}

module.exports = {
  deepFreeze,
  studentReference,
  interpretCefr,
  interpretScore,
  interpretAssessmentDate,
  createObservation,
};
