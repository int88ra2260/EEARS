'use strict';

const { ASSESSMENT_SOURCES } = require('./assessmentSourceRegistry');
const {
  studentReference,
  interpretCefr,
  interpretScore,
  interpretAssessmentDate,
  createObservation,
} = require('./assessmentObservation');

const BESTEP_SKILLS = ['listening', 'reading', 'speaking', 'writing'];

function batchFlags(importBatchId) {
  return importBatchId ? [] : ['UNKNOWN_IMPORT_BATCH'];
}

function sourceId(value) {
  if (value == null || String(value).trim() === '') return null;
  return String(value);
}

function stampIdentity(identity) {
  const version = identity.sourceVersion;
  return {
    ...identity,
    recordNamespace: identity.sourceRecordId
      ? `${identity.sourceTable}:${identity.sourceRecordId}`
      : null,
    sourceRecordVersion: version == null || String(version).trim() === ''
      ? 'unknown'
      : String(version),
  };
}

function calendarText(value) {
  if (value == null || String(value).trim() === '') return null;
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function readProjection(row) {
  const payload = row.rawPayload && typeof row.rawPayload === 'object' ? row.rawPayload : {};
  const fromPayload = payload.bestepExamScoreId != null ? String(payload.bestepExamScoreId) : null;
  const refMatch = typeof row.sourceRef === 'string'
    ? row.sourceRef.match(/^bestep_exam_scores:(\d+)$/)
    : null;
  const fromRef = refMatch ? refMatch[1] : null;
  if (fromPayload && fromRef && fromPayload !== fromRef) {
    return { status: 'conflict' };
  }
  const sourceRecordId = fromPayload || fromRef;
  if (sourceRecordId) {
    return {
      status: 'confirmed',
      upstreamSource: {
        sourceTable: 'bestep_exam_scores',
        sourceRecordId,
        linkType: 'explicit_source_ref',
      },
    };
  }
  if (String(row.sourceType || '').toUpperCase() === 'BESTEP') {
    return { status: 'unverified' };
  }
  return { status: 'none' };
}

function skillObservation(base, skill, rawScore, rawLevel) {
  const cefr = interpretCefr(rawLevel);
  const score = interpretScore(rawScore);
  const flags = [...base.flags];
  if (cefr.missing) flags.push('MISSING_CEFR_LEVEL');
  if (cefr.loss) flags.push('NORMALIZED_CEFR_LOSS');
  if (score.missing) flags.push('MISSING_RAW_SCORE');
  if (!base.sourceIdentity.sourceRecordId) flags.push('UNKNOWN_SOURCE_IDENTITY');
  return createObservation({
    observationId: `obs:${base.sourceIdentity.sourceTable}:${base.sourceIdentity.sourceRecordId || 'none'}:${skill || 'none'}`,
    sourceIdentity: base.sourceIdentity,
    studentReference: base.studentReference,
    assessment: base.assessment,
    result: {
      skill: skill || null,
      rawScore: score.score,
      cefrLevel: cefr.normalized,
      originalCefrLevel: cefr.original,
    },
    qualityFlags: flags,
    provenance: {
      ...base.provenance,
      skill,
      normalizedScorePolicy: 'no_cross_instrument_scale',
    },
  });
}

function adaptBestepScore(row, metadata) {
  const source = structuredClone(row || {});
  const meta = structuredClone(metadata || {});
  const spec = ASSESSMENT_SOURCES.bestep_exam_scores;
  const date = interpretAssessmentDate(source.examDate, {
    semester: source.semester,
    dateProvenance: meta.dateProvenance,
  });
  const identity = stampIdentity({
    sourceSystem: spec.sourceSystem,
    sourceTable: spec.sourceTable,
    sourceRecordId: sourceId(source.id),
    importBatchId: source.importBatchId || null,
    upstreamSource: null,
    sourceVersion: meta.sourceVersion || null,
    originClass: 'external_import',
  });
  const base = {
    sourceIdentity: identity,
    studentReference: studentReference(source.studentId),
    assessment: {
      instrument: 'BESTEP',
      sessionId: null,
      assessmentDate: date.assessmentDate,
      datePrecision: date.datePrecision,
      dateProvenance: date.dateProvenance,
      fileSemester: source.semester || null,
    },
    flags: [...date.flags, ...batchFlags(source.importBatchId)],
    provenance: {
      fieldMap: 'bestep_exam_scores listening/reading/speaking/writing score+level',
      nameIgnored: true,
    },
  };
  return BESTEP_SKILLS.map((skill) => skillObservation(
    base,
    skill,
    source[`${skill}Score`],
    source[`${skill}Level`],
  ));
}

function adaptSkillRows(base, skillRows) {
  if (!Array.isArray(skillRows) || skillRows.length === 0) {
    return [skillObservation(base, null, null, null)];
  }
  return skillRows.map((skillRow) => skillObservation(
    base,
    skillRow.skill,
    skillRow.rawScore,
    skillRow.rawLevel != null ? skillRow.rawLevel : skillRow.cefr,
  ));
}

function adaptExamAttempt(row, metadata) {
  const source = structuredClone(row || {});
  const meta = structuredClone(metadata || {});
  const spec = ASSESSMENT_SOURCES.exam_attempts;
  const projection = readProjection(source);
  const date = interpretAssessmentDate(source.examDate, {
    semester: source.semesterId,
    dateProvenance: meta.dateProvenance,
    statedProvenance: 'exam_attempts.exam_date',
  });
  const examDateText = source.examDate == null ? '' : String(source.examDate).slice(0, 10);
  if (meta.dateProvenance !== 'inferred' && examDateText === '1970-01-01' && projection.status === 'confirmed') {
    date.assessmentDate = null;
    date.datePrecision = 'unknown';
    date.dateProvenance = 'sync_fallback_sentinel';
    date.flags = ['MISSING_ASSESSMENT_DATE', 'INFERRED_ASSESSMENT_DATE'];
    if (source.semesterId) date.flags.push('SEMESTER_ONLY_DATE');
  }
  const flags = [...date.flags];
  let upstreamSource = null;
  let originClass = 'unknown';
  if (projection.status === 'confirmed') {
    upstreamSource = projection.upstreamSource;
    originClass = 'projection';
  } else if (projection.status === 'unverified') {
    flags.push('UNVERIFIED_PROJECTION');
    originClass = 'unknown';
  } else if (projection.status === 'conflict') {
    flags.push('SOURCE_CONFLICT');
    originClass = 'unknown';
  } else if (String(source.sourceType || '').toUpperCase() === 'MANUAL') {
    originClass = 'native_record';
  } else if (String(source.sourceType || '').toUpperCase() === 'EXTERNAL') {
    originClass = 'external_import';
  }
  const vendor = source.examVendor || (String(source.sourceType || '').toUpperCase() === 'BESTEP' ? 'BESTEP' : null);
  const base = {
    sourceIdentity: stampIdentity({
      sourceSystem: spec.sourceSystem,
      sourceTable: spec.sourceTable,
      sourceRecordId: sourceId(source.id),
      importBatchId: meta.importBatchId || null,
      upstreamSource,
      sourceVersion: meta.sourceVersion || null,
      originClass,
    }),
    studentReference: studentReference(source.studentId),
    assessment: {
      instrument: vendor || 'UNKNOWN',
      sessionId: null,
      assessmentDate: date.assessmentDate,
      datePrecision: date.datePrecision,
      dateProvenance: date.dateProvenance,
      fileSemester: source.semesterId || null,
    },
    flags: [...flags, ...batchFlags(meta.importBatchId)],
    provenance: {
      fieldMap: 'exam_attempts plus exam_attempt_skill_scores',
      projectionStatus: projection.status,
      studentPk: source.studentPk != null ? String(source.studentPk) : null,
      nameIgnored: true,
    },
  };
  return adaptSkillRows(base, meta.skillScores);
}

function etAssessmentDate(source, meta) {
  const testDate = calendarText(source.testDate);
  const examDate = calendarText(source.examDate);
  if (meta.dateProvenance === 'inferred') {
    return {
      ...interpretAssessmentDate(source.testDate || source.examDate, { dateProvenance: 'inferred' }),
      testDate,
      examDate,
      intraRecordDateConflict: Boolean(testDate && examDate && testDate !== examDate),
    };
  }
  if (testDate && examDate && testDate !== examDate) {
    return {
      assessmentDate: null,
      datePrecision: 'unknown',
      dateProvenance: 'columns_disagree',
      flags: [],
      testDate,
      examDate,
      intraRecordDateConflict: true,
    };
  }
  const stated = testDate && examDate
    ? 'both_date_columns_agree'
    : testDate ? 'et_test_date' : 'et_exam_date_fallback';
  return {
    ...interpretAssessmentDate(testDate || examDate, { statedProvenance: stated }),
    testDate,
    examDate,
    intraRecordDateConflict: false,
  };
}

function adaptEtExamAttempt(row, metadata) {
  const source = structuredClone(row || {});
  const meta = structuredClone(metadata || {});
  const spec = ASSESSMENT_SOURCES.et_exam_attempts;
  const date = etAssessmentDate(source, meta);
  const instrument = source.examType || source.testType || 'UNKNOWN';
  const payload = source.rawPayload && typeof source.rawPayload === 'object' ? source.rawPayload : {};
  const linkedId = payload.bestepExamScoreId != null ? String(payload.bestepExamScoreId) : null;
  const base = {
    sourceIdentity: stampIdentity({
      sourceSystem: spec.sourceSystem,
      sourceTable: spec.sourceTable,
      sourceRecordId: sourceId(source.id),
      importBatchId: source.importBatchId || null,
      upstreamSource: linkedId ? {
        sourceTable: 'bestep_exam_scores',
        sourceRecordId: linkedId,
        linkType: 'raw_payload_bestepExamScoreId',
      } : null,
      sourceVersion: meta.sourceVersion || null,
      originClass: source.importBatchId ? 'external_import' : 'unknown',
    }),
    studentReference: studentReference(source.studentId),
    assessment: {
      instrument: String(instrument).trim() || 'UNKNOWN',
      sessionId: null,
      assessmentDate: date.assessmentDate,
      datePrecision: date.datePrecision,
      dateProvenance: date.dateProvenance,
      fileSemester: null,
    },
    flags: [...date.flags, ...batchFlags(source.importBatchId)],
    provenance: {
      fieldMap: 'et_exam_attempts keeps both date columns; disagreeing columns are not collapsed',
      testDate: date.testDate,
      examDate: date.examDate,
      intraRecordDateConflict: date.intraRecordDateConflict,
      officialAssessmentDate: 'unknown',
      alternateAssessmentDate: date.intraRecordDateConflict ? date.examDate : null,
      nameIgnored: true,
    },
  };
  return adaptSkillRows(base, meta.skillScores);
}

module.exports = {
  adaptBestepScore,
  adaptExamAttempt,
  adaptEtExamAttempt,
};
