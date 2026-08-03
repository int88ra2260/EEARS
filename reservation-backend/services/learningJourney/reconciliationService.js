'use strict';

const { Op } = require('sequelize');
const { sequelize } = require('../../models');
const {
  EtEnrollmentSnapshot,
  StudentSemesterProfile,
  EnglishTestRegistration,
  ExamRegistration,
  BestepExamScore,
  ExamAttempt,
  EtExamAttempt,
  ActivityParticipation
} = require('../../models');
const { buildSemesterEventFilter } = require('./utils/semesterEventFilter');

const MAX_DIFF_LIST = 200;

function isValidSemesterId(s) {
  return /^[0-9]{2,4}-[0-9]{1,2}$/.test(String(s || '').trim());
}

function normId(s) {
  return String(s || '').trim().toUpperCase();
}

function toStudentSet(rows, key = 'studentId') {
  const set = new Set();
  for (const r of rows || []) {
    const v = r && (r[key] ?? r.dataValues?.[key]);
    const n = normId(v);
    if (n) set.add(n);
  }
  return set;
}

function setDiff(a, b) {
  const sourceOnly = [];
  const aggregateOnly = [];
  for (const x of a) {
    if (!b.has(x)) sourceOnly.push(x);
  }
  for (const x of b) {
    if (!a.has(x)) aggregateOnly.push(x);
  }
  sourceOnly.sort();
  aggregateOnly.sort();
  return {
    sourceOnlyStudents: sourceOnly.slice(0, MAX_DIFF_LIST),
    aggregateOnlyStudents: aggregateOnly.slice(0, MAX_DIFF_LIST),
    matchedCount: [...a].filter((x) => b.has(x)).length
  };
}

function sectionStatus(sourceCount, aggregateCount, sourceOnlyLen, aggregateOnlyLen, queryError) {
  if (queryError) return 'error';
  if (sourceOnlyLen === 0 && aggregateOnlyLen === 0 && sourceCount === aggregateCount) return 'ok';
  return 'warning';
}

async function safe(labelOrFn, fnOrLabel, errors) {
  const label = typeof labelOrFn === 'string' ? labelOrFn : fnOrLabel;
  const fn = typeof labelOrFn === 'function' ? labelOrFn : fnOrLabel;
  try {
    return await fn();
  } catch (e) {
    errors.push({ label, message: (e && e.message) || String(e) });
    return null;
  }
}

/**
 * GET /api/v3/learning-journey/admin/reconciliation 資料對帳
 */
async function getSemesterReconciliation(semesterIdRaw) {
  const semesterId = String(semesterIdRaw || '').trim();
  const errors = [];

  if (!isValidSemesterId(semesterId)) {
    return {
      semesterId,
      sections: [],
      queryErrors: [{ label: 'semesterId', message: 'semesterId 格式不正確（須如 114-2）' }]
    };
  }

  /* ---------- A. 名冊 ---------- */
  const snapRows = await safe(
    'roster_et_snapshots',
    () =>
      EtEnrollmentSnapshot.findAll({
        where: { semesterId, isActive: true },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const sspRows = await safe(
    'roster_student_semester_profiles',
    () =>
      StudentSemesterProfile.findAll({
        where: { semesterId },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const setA_source = snapRows ? toStudentSet(snapRows) : new Set();
  const setA_agg = sspRows ? toStudentSet(sspRows) : new Set();
  const diffA = setDiff(setA_source, setA_agg);
  const secA = {
    key: 'roster',
    label: '名冊（et_enrollment_snapshots active vs student_semester_profiles）',
    sourceCount: setA_source.size,
    aggregateCount: setA_agg.size,
    matchedCount: diffA.matchedCount,
    sourceOnlyStudents: diffA.sourceOnlyStudents,
    aggregateOnlyStudents: diffA.aggregateOnlyStudents,
    status: sectionStatus(
      setA_source.size,
      setA_agg.size,
      diffA.sourceOnlyStudents.length,
      diffA.aggregateOnlyStudents.length,
      !snapRows || !sspRows
    )
  };

  /* ---------- B. 英檢報名 ---------- */
  const engRows = await safe(
    'exam_english_test_registrations',
    () =>
      EnglishTestRegistration.findAll({
        where: { semester: semesterId },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const exRegRows = await safe(
    'exam_exam_registrations',
    () =>
      ExamRegistration.findAll({
        where: { semesterId },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const setB_source = engRows ? toStudentSet(engRows) : new Set();
  const setB_agg = exRegRows ? toStudentSet(exRegRows) : new Set();
  const diffB = setDiff(setB_source, setB_agg);
  const secB = {
    key: 'exam_registration',
    label: '英檢報名（english_test_registrations vs exam_registrations）',
    sourceCount: setB_source.size,
    aggregateCount: setB_agg.size,
    matchedCount: diffB.matchedCount,
    sourceOnlyStudents: diffB.sourceOnlyStudents,
    aggregateOnlyStudents: diffB.aggregateOnlyStudents,
    status: sectionStatus(
      setB_source.size,
      setB_agg.size,
      diffB.sourceOnlyStudents.length,
      diffB.aggregateOnlyStudents.length,
      !engRows || !exRegRows
    )
  };

  /* ---------- C. BESTEP 成績 ---------- */
  const bestepRows = await safe(
    'bestep_exam_scores',
    () =>
      BestepExamScore.findAll({
        where: { semester: semesterId },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const ljsBestepRows = await safe(
    'exam_attempts_bestep',
    () =>
      ExamAttempt.findAll({
        where: {
          semesterId,
          sourceType: 'BESTEP',
          status: { [Op.ne]: 'invalid' }
        },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const setC_source = bestepRows ? toStudentSet(bestepRows) : new Set();
  const setC_agg = ljsBestepRows ? toStudentSet(ljsBestepRows) : new Set();
  const diffC = setDiff(setC_source, setC_agg);
  const secC = {
    key: 'bestep_scores',
    label: 'BESTEP 成績（bestep_exam_scores vs exam_attempts BESTEP）',
    sourceCount: setC_source.size,
    aggregateCount: setC_agg.size,
    matchedCount: diffC.matchedCount,
    sourceOnlyStudents: diffC.sourceOnlyStudents,
    aggregateOnlyStudents: diffC.aggregateOnlyStudents,
    status: sectionStatus(
      setC_source.size,
      setC_agg.size,
      diffC.sourceOnlyStudents.length,
      diffC.aggregateOnlyStudents.length,
      !bestepRows || !ljsBestepRows
    )
  };

  /* ---------- D. 長期追蹤（et vs LJS exam_attempts） ---------- */
  const rosterForSem = snapRows || [];
  const rosterStudentIds = rosterForSem.map((r) => normId(r.studentId)).filter(Boolean);
  const etAttemptStudentSet = new Set();
  if (rosterStudentIds.length) {
    const uniq = [...new Set(rosterStudentIds)];
    const etAttRows = await safe(
      'et_exam_attempts',
      () =>
        EtExamAttempt.findAll({
          where: {
            studentId: { [Op.in]: uniq },
            status: { [Op.ne]: 'invalid' }
          },
          attributes: ['studentId'],
          raw: true
        }),
      errors
    );
    if (etAttRows) {
      const rosterSet = new Set(rosterStudentIds);
      for (const row of etAttRows) {
        const sid = normId(row.studentId);
        if (sid && rosterSet.has(sid)) etAttemptStudentSet.add(sid);
      }
    }
  }

  const ljsEtRows = await safe(
    'exam_attempts_et_tracking',
    () =>
      ExamAttempt.findAll({
        where: {
          semesterId,
          sourceType: { [Op.in]: ['LEGACY_ET', 'MANUAL'] },
          status: { [Op.ne]: 'invalid' }
        },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const setD_source = etAttemptStudentSet;
  const setD_agg = ljsEtRows ? toStudentSet(ljsEtRows) : new Set();
  const diffD = setDiff(setD_source, setD_agg);
  const secD = {
    key: 'et_long_term_tracking',
    label:
      '長期追蹤（本學期名冊內且有 et_exam_attempts 之學生 vs exam_attempts 中 LEGACY_ET／MANUAL；ENUM 尚無 ET_TRACKING，MANUAL 可能含未細分之同步列）',
    sourceCount: setD_source.size,
    aggregateCount: setD_agg.size,
    matchedCount: diffD.matchedCount,
    sourceOnlyStudents: diffD.sourceOnlyStudents,
    aggregateOnlyStudents: diffD.aggregateOnlyStudents,
    status: sectionStatus(
      setD_source.size,
      setD_agg.size,
      diffD.sourceOnlyStudents.length,
      diffD.aggregateOnlyStudents.length,
      ljsEtRows === null
    )
  };

  /* ---------- E. 活動（reservations+events vs activity_participations） ---------- */
  const semesterFilter = buildSemesterEventFilter(semesterId);
  const resStudentRows = await safe(
    'reservations_events_by_semester',
    () =>
      sequelize.query(
        `
        SELECT DISTINCT UPPER(TRIM(r.studentId)) AS studentId
        FROM reservations r
        INNER JOIN events e ON r.eventId = e.id
        ${semesterFilter.join}
        WHERE 1=1
        ${semesterFilter.where}
        `,
        { replacements: semesterFilter.replacements, type: sequelize.QueryTypes.SELECT }
      ),
    errors
  );

  const setE_source = new Set();
  if (Array.isArray(resStudentRows)) {
    for (const row of resStudentRows) {
      const sid = normId(row.studentId);
      if (sid) setE_source.add(sid);
    }
  }

  const apRows = await safe(
    'activity_participations',
    () =>
      ActivityParticipation.findAll({
        where: { semesterId },
        attributes: ['studentId'],
        raw: true
      }),
    errors
  );
  const setE_agg = apRows ? toStudentSet(apRows) : new Set();
  const diffE = setDiff(setE_source, setE_agg);
  const secE = {
    key: 'activities',
    label: '活動參與（reservations+events 依 semesters.code vs activity_participations.semester_id）',
    sourceCount: setE_source.size,
    aggregateCount: setE_agg.size,
    matchedCount: diffE.matchedCount,
    sourceOnlyStudents: diffE.sourceOnlyStudents,
    aggregateOnlyStudents: diffE.aggregateOnlyStudents,
    status: sectionStatus(
      setE_source.size,
      setE_agg.size,
      diffE.sourceOnlyStudents.length,
      diffE.aggregateOnlyStudents.length,
      resStudentRows === null || !apRows
    )
  };

  const sections = [secA, secB, secC, secD, secE];

  return {
    semesterId,
    sections,
    queryErrors: errors.length ? errors : undefined
  };
}

module.exports = {
  getSemesterReconciliation,
  isValidSemesterId
};
