'use strict';

const { normalizeExamType } = require('../learningJourney/utils/cefrScoreMapping');
const { getCefrFromRank, getCefrRank, normalizeCefr } = require('../learningJourney/utils/cefr');
const {
  B2_RANK,
  mergeInstrumentThresholds,
  resolvePairKey,
} = require('./kpiInstrumentThresholds');

const SKILLS = ['listening', 'reading', 'speaking', 'writing'];

function toIsoDate(value) {
  if (value == null || value === '') return null;
  const s = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/**
 * 民國學年 → 約略日期窗（8/1～隔年 7/31）。
 * @param {string|number} rocYear
 */
function academicYearToDateRange(rocYear) {
  const n = Number(String(rocYear || '').trim());
  if (!Number.isFinite(n) || n < 90 || n > 200) return null;
  const startY = n + 1911;
  return {
    dateFrom: `${startY}-08-01`,
    dateTo: `${startY + 1}-07-31`,
  };
}

function resolveEvidenceDateRange(evidence = {}, runOptions = {}) {
  const tw = String(evidence.timeWindow || 'lifetime').toLowerCase();
  if (tw === 'lifetime') return { dateFrom: null, dateTo: null };
  if (tw === 'date_range' || tw === 'daterange') {
    return {
      dateFrom: toIsoDate(runOptions.dateFrom || evidence.dateFrom),
      dateTo: toIsoDate(runOptions.dateTo || evidence.dateTo),
    };
  }
  if (tw === 'academic_year' || tw === 'academicyear') {
    const year = runOptions.academicYear || evidence.academicYear;
    return academicYearToDateRange(year) || { dateFrom: null, dateTo: null };
  }
  return { dateFrom: null, dateTo: null };
}

function inDateRange(examDate, dateFrom, dateTo) {
  const d = toIsoDate(examDate);
  if (!d) return false;
  if (dateFrom && d < dateFrom) return false;
  if (dateTo && d > dateTo) return false;
  return true;
}

function normalizeStudentId(value) {
  return String(value || '').trim().toUpperCase();
}

function skillMapFromAttempt(attempt) {
  const map = {};
  const rows = attempt.skillScores || attempt.skills || [];
  for (const row of rows) {
    const j = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const skill = String(j.skill || '').toLowerCase();
    if (!SKILLS.includes(skill)) continue;
    const rank = j.cefrRank != null
      ? Number(j.cefrRank)
      : getCefrRank(j.cefr);
    map[skill] = {
      skill,
      rawScore: j.rawScore != null && j.rawScore !== '' ? Number(j.rawScore) : null,
      rawLevel: j.rawLevel || null,
      cefr: normalizeCefr(j.cefr) || (Number.isFinite(rank) ? getCefrFromRank(rank) : null),
      cefrRank: Number.isFinite(rank) ? rank : null,
    };
  }
  return map;
}

function resolveInstrumentCode(attempt) {
  const examDate = toIsoDate(attempt.examDate || attempt.testDate);
  const rawType = attempt.examType || attempt.testType || '';
  const norm = normalizeExamType(rawType, { examDate });
  if (norm.code) return norm.code;
  const fallback = String(rawType || '').trim().toUpperCase().replace(/\s+/g, '_');
  return fallback || null;
}

function combinedRaw(skills, skillMap) {
  let sum = 0;
  for (const sk of skills) {
    const cell = skillMap[sk];
    if (!cell || cell.rawScore == null || !Number.isFinite(Number(cell.rawScore))) return null;
    sum += Number(cell.rawScore);
  }
  return Number(sum.toFixed(4));
}

function evaluatePairPass({ skills, skillMap, rule }) {
  if (!rule) {
    return { passed: false, reason: 'UNSUPPORTED_INSTRUMENT', combined: null, details: {} };
  }
  const missing = skills.filter((sk) => !skillMap[sk]);
  if (missing.length) {
    return {
      passed: false,
      reason: 'INCOMPLETE_SKILLS',
      combined: combinedRaw(skills, skillMap),
      missingSkills: missing,
      details: {},
    };
  }

  const passMode = String(rule.passMode || 'sum_raw');
  const combined = combinedRaw(skills, skillMap);
  const details = { passMode, rule: { ...rule } };

  if (passMode === 'both_cefr') {
    const minRank = Number(rule.minCefrRank != null ? rule.minCefrRank : B2_RANK);
    const ranks = skills.map((sk) => skillMap[sk].cefrRank);
    if (ranks.some((r) => r == null || !Number.isFinite(r))) {
      return { passed: false, reason: 'MISSING_CEFR', combined, details };
    }
    const passed = ranks.every((r) => r >= minRank);
    return {
      passed,
      reason: passed ? 'BOTH_CEFR' : 'BELOW_CEFR',
      combined: combined != null ? combined : ranks.reduce((a, b) => a + b, 0),
      details: { ...details, ranks, minRank },
    };
  }

  if (passMode === 'sum_and_section_mins') {
    const minTotal = Number(rule.minTotal);
    const sectionMins = rule.sectionMins || {};
    if (combined == null || !Number.isFinite(minTotal)) {
      return { passed: false, reason: 'MISSING_SCORES', combined, details };
    }
    if (combined < minTotal) {
      return { passed: false, reason: 'BELOW_TOTAL', combined, details };
    }
    for (const sk of skills) {
      const min = sectionMins[sk];
      if (min != null && Number(skillMap[sk].rawScore) < Number(min)) {
        return { passed: false, reason: 'BELOW_SECTION_MIN', combined, details };
      }
    }
    return { passed: true, reason: 'SUM_AND_SECTIONS', combined, details };
  }

  // default sum_raw
  const minTotal = Number(rule.minTotal);
  if (combined == null || !Number.isFinite(minTotal)) {
    return { passed: false, reason: 'MISSING_SCORES', combined, details };
  }
  const passed = combined >= minTotal;
  return {
    passed,
    reason: passed ? 'SUM_RAW' : 'BELOW_TOTAL',
    combined,
    details: { ...details, minTotal },
  };
}

function evaluateSkillPass({ skill, skillMap, minCefrRank }) {
  const cell = skillMap[skill];
  if (!cell) {
    return { passed: false, reason: 'NO_SCORE', combined: null, details: {} };
  }
  const minRank = Number(minCefrRank != null ? minCefrRank : B2_RANK);
  const rank = cell.cefrRank;
  if (rank == null || !Number.isFinite(rank)) {
    return { passed: false, reason: 'MISSING_CEFR', combined: cell.rawScore, details: { cell } };
  }
  const passed = rank >= minRank;
  return {
    passed,
    reason: passed ? 'SKILL_CEFR' : 'BELOW_CEFR',
    combined: cell.rawScore != null ? Number(cell.rawScore) : rank,
    details: { cell, minRank },
  };
}

function pickBestCandidate(candidates, proofSelection) {
  if (!candidates.length) return null;
  const mode = String(proofSelection || 'highest_combined');
  const sorted = [...candidates].sort((a, b) => {
    if (mode === 'highest_rank') {
      const ra = Number(a.proofRank || 0);
      const rb = Number(b.proofRank || 0);
      if (rb !== ra) return rb - ra;
    }
    const ca = Number(a.combined);
    const cb = Number(b.combined);
    const aNum = Number.isFinite(ca) ? ca : -Infinity;
    const bNum = Number.isFinite(cb) ? cb : -Infinity;
    if (bNum !== aNum) return bNum - aNum;
    const da = String(a.examDate || '');
    const db = String(b.examDate || '');
    return db.localeCompare(da);
  });
  return sorted[0];
}

/**
 * @param {object} definition policy.definition
 * @param {Array<{studentId:string, attempts:object[]}>} studentAttempts
 * @param {{ dateFrom?: string, dateTo?: string, academicYear?: string }} [runOptions]
 */
function evaluateKpiPolicy(definition, studentAttempts, runOptions = {}) {
  const evidence = definition?.evidence || {};
  const { dateFrom, dateTo } = resolveEvidenceDateRange(evidence, runOptions);
  const instruments = mergeInstrumentThresholds(definition?.instruments);
  const dimensions = Array.isArray(definition?.dimensions) ? definition.dimensions : [];
  const includeSkillBreakdown = definition?.includeSkillBreakdown === true;

  const dimensionSummaries = dimensions.map((dim) => ({
    id: dim.id,
    label: dim.label,
    kind: dim.kind,
    skills: dim.skills,
    passedCount: 0,
    rate: 0,
  }));

  const skillBreakdown = {
    listening: { count: 0, rate: 0 },
    reading: { count: 0, rate: 0 },
    speaking: { count: 0, rate: 0 },
    writing: { count: 0, rate: 0 },
  };

  const rows = [];
  let totalStudents = 0;

  for (const entry of studentAttempts) {
    const studentId = normalizeStudentId(entry.studentId);
    if (!studentId) continue;
    totalStudents += 1;

    const attempts = (entry.attempts || [])
      .map((att) => {
        const j = typeof att.toJSON === 'function' ? att.toJSON() : att;
        return {
          ...j,
          examDate: toIsoDate(j.examDate || j.testDate),
          instrumentCode: resolveInstrumentCode(j),
          skillMap: skillMapFromAttempt(j),
        };
      })
      .filter((att) => {
        if (dateFrom || dateTo) return inDateRange(att.examDate, dateFrom, dateTo);
        return true;
      });

    const row = {
      studentId,
      validAttemptCount: attempts.length,
      dimensions: {},
      skillBreakdown: null,
    };

    for (let i = 0; i < dimensions.length; i += 1) {
      const dim = dimensions[i];
      const skills = (dim.skills || []).map((s) => String(s).toLowerCase());
      const candidates = [];
      let incompleteCount = 0;
      let unsupportedCount = 0;

      for (const att of attempts) {
        const instrumentCode = att.instrumentCode;
        const skillMap = att.skillMap;

        if (dim.kind === 'skill') {
          const skill = skills[0];
          if (dim.requireCompleteSkills !== false && !skillMap[skill]) {
            incompleteCount += 1;
            continue;
          }
          const result = evaluateSkillPass({
            skill,
            skillMap,
            minCefrRank: dim.minCefrRank,
          });
          if (result.passed) {
            candidates.push({
              attemptId: att.id,
              examDate: att.examDate,
              instrument: instrumentCode,
              combined: result.combined,
              proofRank: skillMap[skill]?.cefrRank,
              reason: result.reason,
              skills: { [skill]: skillMap[skill] },
            });
          }
          continue;
        }

        // pair
        if (dim.requireCompleteSkills !== false) {
          const missing = skills.filter((sk) => !skillMap[sk]);
          if (missing.length) {
            incompleteCount += 1;
            continue;
          }
        }

        const pairKey = resolvePairKey(skills);
        const instrumentCfg = instrumentCode ? instruments[instrumentCode] : null;
        const rule = pairKey && instrumentCfg?.pairs?.[pairKey]
          ? instrumentCfg.pairs[pairKey]
          : null;

        if (!rule) {
          unsupportedCount += 1;
          continue;
        }

        const result = evaluatePairPass({ skills, skillMap, rule });
        if (result.passed) {
          const skillSnap = {};
          for (const sk of skills) skillSnap[sk] = skillMap[sk];
          candidates.push({
            attemptId: att.id,
            examDate: att.examDate,
            instrument: instrumentCode,
            combined: result.combined,
            reason: result.reason,
            skills: skillSnap,
            passMode: rule.passMode,
            minTotal: rule.minTotal != null ? rule.minTotal : null,
          });
        }
      }

      const proof = pickBestCandidate(candidates, dim.proofSelection);
      const passed = Boolean(proof);
      if (passed) {
        dimensionSummaries[i].passedCount += 1;
      }

      row.dimensions[dim.id] = {
        passed,
        proof: proof || null,
        candidateCount: candidates.length,
        incompleteAttemptCount: incompleteCount,
        unsupportedAttemptCount: unsupportedCount,
      };
    }

    if (includeSkillBreakdown) {
      const best = {
        listening: null,
        reading: null,
        speaking: null,
        writing: null,
      };
      for (const att of attempts) {
        for (const sk of SKILLS) {
          const cell = att.skillMap[sk];
          if (!cell || cell.cefrRank == null) continue;
          const cur = best[sk];
          if (!cur || cell.cefrRank > cur.cefrRank
            || (cell.cefrRank === cur.cefrRank && String(att.examDate || '') > String(cur.examDate || ''))) {
            best[sk] = {
              ...cell,
              attemptId: att.id,
              examDate: att.examDate,
              instrument: att.instrumentCode,
            };
          }
        }
      }
      const breakdown = {};
      for (const sk of SKILLS) {
        const cell = best[sk];
        const passed = Boolean(cell && cell.cefrRank >= B2_RANK);
        if (passed) skillBreakdown[sk].count += 1;
        breakdown[sk] = {
          passed,
          proof: passed ? cell : null,
        };
      }
      row.skillBreakdown = breakdown;
    }

    rows.push(row);
  }

  for (const summary of dimensionSummaries) {
    summary.rate = totalStudents
      ? Number((summary.passedCount / totalStudents).toFixed(4))
      : 0;
  }
  if (includeSkillBreakdown) {
    for (const sk of SKILLS) {
      skillBreakdown[sk].rate = totalStudents
        ? Number((skillBreakdown[sk].count / totalStudents).toFixed(4))
        : 0;
    }
  }

  return {
    totalStudents,
    evidenceWindow: { dateFrom, dateTo },
    dimensions: dimensionSummaries,
    skillBreakdown: includeSkillBreakdown ? skillBreakdown : null,
    rows,
  };
}

module.exports = {
  SKILLS,
  academicYearToDateRange,
  resolveEvidenceDateRange,
  evaluateKpiPolicy,
  evaluatePairPass,
  evaluateSkillPass,
  pickBestCandidate,
  resolveInstrumentCode,
  skillMapFromAttempt,
};
