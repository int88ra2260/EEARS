'use strict';

const { adaptBestepScore, adaptExamAttempt, adaptEtExamAttempt } = require('../assessmentAdapters');
const { compareAssessmentObservationsDetailed } = require('../assessmentComparison');
const { interpretAssessmentDate, interpretCefr, interpretScore } = require('../assessmentObservation');
const {
  BESTEP_SCORE_IMPORT_TYPE,
  BESTEP_FILE_QUALITY_PILOT_ID,
  parseBestepFileQualityInput,
} = require('./bestepFileQualityContract');
const { getBestepFileQualityFinding } = require('./bestepFileQualityFindings');

const SKILLS = Object.freeze(['listening', 'reading', 'speaking', 'writing']);
const SCAN_LIMIT = 200;

function countBucket(availability, value, denominator) {
  return {
    value: availability === 'provided' ? value : null,
    availability,
    denominator,
  };
}

function createCollector() {
  const buckets = new Map();
  return {
    add(code, rowRef) {
      const spec = getBestepFileQualityFinding(code);
      const bucket = buckets.get(code) || {
        code,
        severity: spec.severity,
        dimension: spec.dimension,
        count: 0,
        rowRefs: [],
        verificationStatus: 'contract_only',
      };
      bucket.count += 1;
      if (rowRef && bucket.rowRefs.length < 20 && !bucket.rowRefs.includes(rowRef)) {
        bucket.rowRefs.push(rowRef);
      }
      buckets.set(code, bucket);
    },
    has(code) {
      return buckets.has(code);
    },
    list() {
      return [...buckets.values()];
    },
  };
}

function classifySkill(row, skill) {
  const rawScore = row[`${skill}Score`];
  const rawLevel = row[`${skill}Level`];
  const scoreEmpty = rawScore == null || rawScore === '';
  const levelEmpty = rawLevel == null || String(rawLevel).trim() === '';
  const score = interpretScore(rawScore);
  const cefr = interpretCefr(rawLevel);
  if (!scoreEmpty && score.missing) {
    return { state: 'invalid_value', plusPresent: false };
  }
  if (!levelEmpty && cefr.original && cefr.normalized == null) {
    return { state: 'invalid_value', plusPresent: false };
  }
  if (scoreEmpty && levelEmpty) return { state: 'skill_missing', plusPresent: false };
  if (score.missing) return { state: 'score_missing', plusPresent: cefr.loss };
  if (cefr.missing) return { state: 'cefr_missing', plusPresent: false };
  return { state: 'skill_present', plusPresent: cefr.loss };
}

function skillFindings(state) {
  if (state === 'invalid_value') return ['SKILL_VALUE_INVALID'];
  if (state === 'skill_missing') return ['SKILL_SCORE_MISSING', 'SKILL_CEFR_MISSING'];
  if (state === 'score_missing') return ['SKILL_SCORE_MISSING'];
  if (state === 'cefr_missing') return ['SKILL_CEFR_MISSING'];
  return [];
}

function inspectScoreRows(rows, prefix, collector) {
  const skillRows = [];
  let validSkillCount = 0;
  rows.slice(0, SCAN_LIMIT).forEach((row, index) => {
    const rowRef = `${prefix}[${index}]`;
    const skills = {};
    SKILLS.forEach((skill) => {
      const classified = classifySkill(row, skill);
      skills[skill] = classified.state;
      if (classified.state === 'skill_present') validSkillCount += 1;
      skillFindings(classified.state).forEach((code) => collector.add(code, `${rowRef}.${skill}`));
    });
    const date = interpretAssessmentDate(row.examDate, { semester: row.semester || null });
    if (!date.assessmentDate) collector.add('SOURCE_EXAM_DATE_MISSING', rowRef);
    skillRows.push({
      rowRef,
      skills,
      sourceAssessmentDate: date.assessmentDate,
    });
  });
  return { skillRows, validSkillCount };
}

function plusLost(rawRow, acceptedRow) {
  return SKILLS.some((skill) => {
    const raw = classifySkill(rawRow, skill);
    const accepted = classifySkill(acceptedRow, skill);
    return raw.plusPresent && !accepted.plusPresent && accepted.state !== 'invalid_value';
  });
}

function rowIdentity(row) {
  if (row.id != null && String(row.id).trim()) return `id:${String(row.id)}`;
  if (row.rowKey != null && String(row.rowKey).trim()) return `key:${String(row.rowKey)}`;
  return null;
}

function knownStudentCount(rows) {
  const keys = new Set();
  let missing = 0;
  rows.forEach((row) => {
    const text = row.studentId == null ? '' : String(row.studentId).trim();
    if (!text) {
      missing += 1;
      return;
    }
    keys.add(text.toUpperCase());
  });
  return { count: keys.size, missing };
}

function projectObservations(record) {
  const table = record.targetTable || 'exam_attempts';
  const metadata = {
    skillScores: record.skillScores || null,
    dateProvenance: record.dateProvenance,
  };
  if (table === 'et_exam_attempts') return adaptEtExamAttempt(record.row, metadata);
  return adaptExamAttempt(record.row, metadata);
}

function dateClass(record, observations) {
  const sample = observations[0];
  const flags = new Set(observations.flatMap((obs) => obs.qualityFlags));
  const intraConflict = observations.some((obs) => obs.provenance && obs.provenance.intraRecordDateConflict);
  if (intraConflict) return { kind: 'date_conflict', projectedExamDate: null };
  if (record.dateProvenance === 'inferred'
    || flags.has('INFERRED_ASSESSMENT_DATE')
    || sample.assessment.dateProvenance === 'caller_marked_inferred'
    || sample.assessment.dateProvenance === 'sync_fallback_sentinel') {
    return {
      kind: 'projection_date_inferred',
      projectedExamDate: sample.assessment.assessmentDate,
    };
  }
  if (record.dateProvenance === 'stated' && sample.assessment.assessmentDate) {
    return {
      kind: 'projection_date_present',
      projectedExamDate: sample.assessment.assessmentDate,
    };
  }
  if (sample.assessment.assessmentDate) {
    return {
      kind: 'date_provenance_unknown',
      projectedExamDate: sample.assessment.assessmentDate,
    };
  }
  return { kind: 'projection_date_missing', projectedExamDate: null };
}

function sameSkillObservations(leftRows, rightRows) {
  const right = new Map();
  rightRows.forEach((obs) => {
    if (obs.result.skill) right.set(obs.result.skill, obs);
  });
  return leftRows
    .filter((obs) => obs.result.skill && right.has(obs.result.skill))
    .map((obs) => compareAssessmentObservationsDetailed(obs, right.get(obs.result.skill)));
}

function rollupComparison(pairs) {
  if (!pairs.length) {
    return { relationship: 'undetermined', consistency: 'insufficient_data' };
  }
  const conflict = pairs.find((pair) => pair.identity.relationship === 'confirmed_projection'
    && pair.consistency.status === 'conflicting');
  if (conflict) return { relationship: 'confirmed_projection', consistency: 'conflicting' };
  const confirmed = pairs.find((pair) => pair.identity.relationship === 'confirmed_projection');
  if (confirmed) {
    const weak = pairs.find((pair) => pair.consistency.status !== 'consistent');
    return {
      relationship: 'confirmed_projection',
      consistency: weak ? weak.consistency.status : 'consistent',
    };
  }
  const possible = pairs.find((pair) => pair.identity.relationship === 'possible_same_assessment');
  if (possible) return { relationship: 'possible_same_assessment', consistency: possible.consistency.status };
  return {
    relationship: pairs[0].identity.relationship,
    consistency: pairs[0].consistency.status,
  };
}

function findLinkedScore(observations, accepted, current) {
  const upstream = observations
    .map((obs) => obs.sourceIdentity.upstreamSource)
    .find((link) => link && link.sourceTable === 'bestep_exam_scores' && link.sourceRecordId != null);
  if (!upstream) return null;
  const id = String(upstream.sourceRecordId);
  return [...accepted, ...current].find((row) => row.id != null && String(row.id) === id) || null;
}

function inspectProjections(parsed, collector) {
  const availability = parsed.lists.projectionRecords.availability;
  if (availability !== 'provided') {
    collector.add('PROJECTION_UNVERIFIED', 'projectionRecords');
    return { checks: [], dates: [] };
  }
  const checks = [];
  const dates = [];
  const accepted = parsed.lists.acceptedScoreRows.rows;
  const current = parsed.lists.currentScoreRecords.rows;
  parsed.lists.projectionRecords.rows.slice(0, SCAN_LIMIT).forEach((record, index) => {
    const rowRef = `projection[${index}]`;
    const projected = projectObservations(record);
    const date = dateClass(record, projected);
    dates.push({ rowRef, ...date });
    if (date.kind === 'projection_date_inferred') collector.add('PROJECTED_DATE_INFERRED', rowRef);
    if (date.kind === 'date_provenance_unknown') collector.add('DATE_PROVENANCE_UNKNOWN', rowRef);
    if (date.kind === 'date_conflict') collector.add('DATE_CONFLICT', rowRef);

    const linked = findLinkedScore(projected, accepted, current);
    const sourceRows = linked ? adaptBestepScore(linked) : [];
    const pairs = linked ? sameSkillObservations(sourceRows, projected) : [];
    if (!linked) {
      accepted.slice(0, SCAN_LIMIT).forEach((row) => {
        sameSkillObservations(adaptBestepScore(row), projected).forEach((pair) => pairs.push(pair));
      });
    }
    const rolled = rollupComparison(pairs);
    if (rolled.relationship === 'confirmed_projection' && rolled.consistency === 'conflicting') {
      collector.add('PROJECTION_CONTENT_CONFLICT', rowRef);
    } else if (rolled.relationship === 'possible_same_assessment') {
      collector.add('POSSIBLE_DUPLICATE_UNMERGED', rowRef);
      collector.add('PROJECTION_UNVERIFIED', rowRef);
    } else if (rolled.relationship !== 'confirmed_projection' || rolled.consistency !== 'consistent') {
      collector.add('PROJECTION_UNVERIFIED', rowRef);
    }
    if (linked && date.kind === 'projection_date_present') {
      const sourceDate = interpretAssessmentDate(linked.examDate, { semester: linked.semester || null });
      if (sourceDate.assessmentDate && date.projectedExamDate
        && sourceDate.assessmentDate !== date.projectedExamDate) {
        collector.add('DATE_CONFLICT', rowRef);
        date.kind = 'date_conflict';
      }
    }
    checks.push({
      rowRef,
      relationship: rolled.relationship,
      consistency: rolled.consistency,
      mergePerformed: false,
      sourcePriorityApplied: false,
    });
  });
  const confirmed = checks.some((row) => row.relationship === 'confirmed_projection'
    && row.consistency === 'consistent');
  if (!confirmed && listsProvided(parsed, 'acceptedScoreRows') && !collector.has('PROJECTION_CONTENT_CONFLICT')) {
    collector.add('PROJECTION_UNVERIFIED', 'projectionRecords');
  }
  return { checks, dates };
}

function listsProvided(parsed, key) {
  return parsed.lists[key].availability === 'provided' && parsed.lists[key].rows.length > 0;
}

function dimensionStatus(collector, codes, ready) {
  if (!ready) return 'unknown';
  if (codes.some((code) => collector.has(code) && getBestepFileQualityFinding(code).severity === 'error')) {
    return 'unknown';
  }
  const open = codes.some((code) => collector.has(code)
    && getBestepFileQualityFinding(code).severity !== 'informational');
  return open ? 'partial' : 'complete';
}

function evaluateBestepFileQuality(input) {
  const parsed = parseBestepFileQualityInput(input);
  const collector = createCollector();
  const limitations = [
    { code: 'NOT_L3_VALIDATED', detail: '此報告只評估呼叫端提供的合成或離線輸入。' },
    { code: 'SKILL_OBSERVATIONS_ARE_NOT_SITTINGS', detail: '一列成績的四個技能 observation 不是四次測驗，也不是四位學生。' },
    { code: 'STORED_CEFR_PLUS_NOT_RESTORABLE', detail: '已存成基底等級的 CEFR 不能還原成帶加號的原值。' },
    { code: 'MISSING_ATTENDANCE_IS_NOT_NO_SHOW', detail: '沒有出席證據是未知，不是缺考。' },
    { code: 'HISTORICAL_IMPORT_NOT_RECONSTRUCTED', detail: '單次檔案品質不表示歷次匯入或覆蓋歷史已經還原。' },
    { code: 'UNPROVIDED_PROJECTION_CHANNEL_NOT_CHECKED', detail: '未放入輸入的 exam_attempts 或 et_exam_attempts 通道沒有被檢查。' },
    { code: 'SYNC_DATE_IS_NOT_SOURCE_DATE', detail: '投影或同步日期不能填回 bestep_exam_scores.examDate。' },
  ];

  if (!parsed.fileSemester) collector.add('FILE_SEMESTER_MISSING', 'fileSemester');
  if (parsed.source.importType !== BESTEP_SCORE_IMPORT_TYPE) collector.add('IMPORT_TYPE_UNKNOWN', 'source.importType');
  if (!parsed.source.sourceFileId) collector.add('SOURCE_FILE_UNKNOWN', 'source.sourceFileId');
  if (!parsed.source.importRunId) collector.add('IMPORT_RUN_UNKNOWN', 'source.importRunId');

  const lists = parsed.lists;
  const scanned = {};
  ['rawFileRows', 'acceptedScoreRows', 'skippedImportRows', 'currentScoreRecords', 'attendanceRows', 'projectionRecords']
    .forEach((key) => {
      if (lists[key].rows.length > SCAN_LIMIT) {
        limitations.push({ code: 'ROW_SCAN_TRUNCATED', detail: `${key} 只檢查前 ${SCAN_LIMIT} 列。` });
      }
      scanned[key] = lists[key].rows.slice(0, SCAN_LIMIT);
    });

  const accepted = lists.acceptedScoreRows.availability === 'provided'
    ? inspectScoreRows(scanned.acceptedScoreRows, 'accepted', collector)
    : { skillRows: [], validSkillCount: 0 };
  const current = lists.currentScoreRecords.availability === 'provided'
    ? inspectScoreRows(scanned.currentScoreRecords, 'current', collector)
    : { skillRows: [], validSkillCount: 0 };

  scanned.rawFileRows.forEach((raw) => {
    const identity = rowIdentity(raw);
    if (!identity) return;
    const acceptedRow = scanned.acceptedScoreRows.find((row) => rowIdentity(row) === identity);
    if (acceptedRow && plusLost(raw, acceptedRow)) {
      collector.add('SOURCE_INFORMATION_LOSS', `raw:${identity}`);
    }
  });

  scanned.skippedImportRows.forEach((row, index) => {
    if (row.code === 'STUDENT_NOT_FOUND') {
      collector.add('IMPORT_ROW_SKIPPED_UNMATCHED', `skipped[${index}]`);
    }
  });

  const attendanceProvided = lists.attendanceRows.availability === 'provided';
  let confirmedAbsent = 0;
  let confirmedPresent = 0;
  if (!attendanceProvided) {
    collector.add('ATTENDANCE_UNKNOWN', 'attendanceRows');
  } else {
    scanned.attendanceRows.forEach((row, index) => {
      const rowRef = `attendance[${index}]`;
      if (row.attended == null) collector.add('ATTENDANCE_UNKNOWN', rowRef);
      if (row.attended === false) {
        confirmedAbsent += 1;
        collector.add('ATTENDANCE_CONFIRMED_ABSENT', rowRef);
      }
      if (row.attended === true) confirmedPresent += 1;
    });
    scanned.acceptedScoreRows.forEach((row, index) => {
      const linked = scanned.attendanceRows.some((item) => item.sourceRecordId != null
        && row.id != null
        && String(item.sourceRecordId) === String(row.id));
      if (!linked) collector.add('ATTENDANCE_UNKNOWN', `accepted[${index}]`);
    });
  }

  if (parsed.registration.availability !== 'provided') {
    collector.add('REGISTRATION_POPULATION_NOT_OBSERVED', 'registrationPopulation');
  }
  if (parsed.history.availability !== 'provided') {
    collector.add('REIMPORT_HISTORY_UNKNOWN', 'importHistory');
  }

  const projections = inspectProjections(parsed, collector);
  const students = lists.acceptedScoreRows.availability === 'provided'
    ? knownStudentCount(scanned.acceptedScoreRows)
    : { count: 0, missing: 0 };

  const coverage = parsed.registration.availability === 'provided'
    && lists.acceptedScoreRows.availability === 'provided'
    ? {
      calculated: true,
      numerator: scanned.acceptedScoreRows.length,
      denominator: parsed.registration.successRegistrationCount,
      denominatorDefinition: '本次輸入的 accepted score rows / 本次提供的 successRegistrationCount。不是全校學生，也不是不重複人數。',
      rate: parsed.registration.successRegistrationCount > 0
        ? scanned.acceptedScoreRows.length / parsed.registration.successRegistrationCount
        : null,
    }
    : {
      calculated: false,
      numerator: null,
      denominator: null,
      denominatorDefinition: '報名母體未提供，不計算覆蓋率。',
      rate: null,
    };

  const anyList = ['rawFileRows', 'acceptedScoreRows', 'skippedImportRows', 'currentScoreRecords', 'attendanceRows', 'projectionRecords']
    .some((key) => lists[key].availability === 'provided');
  const blocking = collector.list().some((row) => row.severity === 'error' || row.severity === 'warning' || row.severity === 'unknown');
  const conflicting = collector.has('PROJECTION_CONTENT_CONFLICT') || collector.has('DATE_CONFLICT');
  let status = 'complete';
  if (!anyList && !parsed.fileSemester) status = 'insufficient_evidence';
  else if (!anyList) status = 'insufficient_evidence';
  else if (conflicting) status = 'conflicting';
  else if (!parsed.fileSemester || blocking) status = 'partial';

  const sourceReady = Boolean(parsed.fileSemester)
    && parsed.source.importType === BESTEP_SCORE_IMPORT_TYPE
    && Boolean(parsed.source.sourceFileId)
    && Boolean(parsed.source.importRunId);
  const skillReady = lists.acceptedScoreRows.availability === 'provided'
    || lists.currentScoreRecords.availability === 'provided';
  const attendanceReady = attendanceProvided && lists.acceptedScoreRows.availability === 'provided';
  const projectionReady = lists.projectionRecords.availability === 'provided';
  const lossReady = lists.rawFileRows.availability === 'provided'
    && lists.acceptedScoreRows.availability === 'provided'
    && parsed.history.availability === 'provided';

  return {
    pilotId: BESTEP_FILE_QUALITY_PILOT_ID,
    evaluationScope: 'batch',
    fileSemester: parsed.fileSemester,
    status,
    verificationStatus: 'contract_only',
    batchQuality: lists.acceptedScoreRows.availability === 'provided'
      || lists.rawFileRows.availability === 'provided'
      || lists.skippedImportRows.availability === 'provided'
      ? status
      : 'not_observed',
    currentStateQuality: lists.currentScoreRecords.availability === 'provided' ? 'observed' : 'not_observed',
    historicalImportQuality: parsed.history.availability === 'provided' ? 'not_claimed' : 'not_observed',
    dimensions: {
      sourceCompleteness: {
        status: dimensionStatus(collector, [
          'FILE_SEMESTER_MISSING', 'IMPORT_TYPE_UNKNOWN', 'SOURCE_FILE_UNKNOWN', 'IMPORT_RUN_UNKNOWN',
        ], sourceReady || Boolean(parsed.fileSemester)),
      },
      skillCompleteness: {
        status: dimensionStatus(collector, [
          'SKILL_SCORE_MISSING', 'SKILL_CEFR_MISSING', 'SKILL_VALUE_INVALID',
        ], skillReady),
        skillRows: accepted.skillRows,
      },
      dateProvenance: {
        status: dimensionStatus(collector, [
          'SOURCE_EXAM_DATE_MISSING', 'PROJECTED_DATE_INFERRED', 'DATE_PROVENANCE_UNKNOWN', 'DATE_CONFLICT',
        ], skillReady || projectionReady),
        rows: accepted.skillRows.map((row) => ({
          rowRef: row.rowRef,
          sourceAssessmentDate: row.sourceAssessmentDate,
        })),
        projections: projections.dates,
      },
      registrationAttendance: {
        status: dimensionStatus(collector, [
          'ATTENDANCE_UNKNOWN', 'IMPORT_ROW_SKIPPED_UNMATCHED', 'REGISTRATION_POPULATION_NOT_OBSERVED',
        ], attendanceReady && parsed.registration.availability === 'provided'),
        confirmedPresent,
        confirmedAbsent: attendanceProvided ? confirmedAbsent : null,
        coverage,
      },
      projectionConsistency: {
        status: dimensionStatus(collector, [
          'PROJECTION_UNVERIFIED', 'PROJECTION_CONTENT_CONFLICT',
        ], projectionReady),
        checks: projections.checks,
      },
      informationLoss: {
        status: dimensionStatus(collector, [
          'SOURCE_INFORMATION_LOSS', 'REIMPORT_HISTORY_UNKNOWN',
        ], lossReady),
        restoredCefrPlus: false,
      },
    },
    counts: {
      rawFileRows: countBucket(lists.rawFileRows.availability, scanned.rawFileRows.length, '提供的 rawFileRows'),
      acceptedScoreRows: countBucket(lists.acceptedScoreRows.availability, scanned.acceptedScoreRows.length, '提供的 acceptedScoreRows'),
      skippedScoreRows: countBucket(lists.skippedImportRows.availability, scanned.skippedImportRows.length, '提供的 skippedImportRows'),
      currentScoreRecords: countBucket(lists.currentScoreRecords.availability, scanned.currentScoreRecords.length, '提供的 currentScoreRecords'),
      attendanceItems: countBucket(lists.attendanceRows.availability, scanned.attendanceRows.length, '提供的 attendanceRows；一列是一個出席項目'),
      uniqueStudentsInAcceptedRows: lists.acceptedScoreRows.availability === 'provided'
        ? {
          value: students.count,
          availability: students.missing ? 'partial' : 'provided',
          denominator: 'acceptedScoreRows 內可讀的學號鍵。報告不輸出學號。',
        }
        : countBucket('not_observed', null, 'acceptedScoreRows 未提供'),
      skillObservations: countBucket(
        lists.acceptedScoreRows.availability,
        scanned.acceptedScoreRows.length * SKILLS.length,
        '每一筆 accepted score row 固定展開四個技能 observation',
      ),
      validSkillResults: {
        value: lists.acceptedScoreRows.availability === 'provided' ? accepted.validSkillCount : null,
        availability: lists.acceptedScoreRows.availability,
        denominator: 'acceptedScoreRows 中 state 為 skill_present 的技能數。空值不是 0 分。',
      },
      examSittings: {
        value: null,
        availability: 'not_inferred',
        denominator: '不由技能 observation 反推測驗次數',
      },
      registrationPopulation: countBucket(
        parsed.registration.availability,
        parsed.registration.successRegistrationCount,
        '呼叫端提供的 successRegistrationCount',
      ),
    },
    currentState: {
      skillRows: current.skillRows,
      validSkillCount: lists.currentScoreRecords.availability === 'provided' ? current.validSkillCount : null,
    },
    findings: collector.list(),
    limitations,
    governance: {
      officialUseAllowed: false,
      causalClaimAllowed: false,
      sourcePriorityApplied: false,
      mergePerformed: false,
    },
  };
}

module.exports = {
  evaluateBestepFileQuality,
};
