'use strict';

const { Op } = require('sequelize');
const {
  LjAnalyticStudent,
  LjAnalyticExam,
  LjStudentEvent,
  CourseEnrollment,
  Course,
} = require('../../models');
const { resolveLatestSnapshotVersion } = require('../learningJourney/analytics/timelineReadService');
const { resourceKeyForEvent, computeAdjustedGrowthEpisodes } = require('../learningJourney/analytics/lvaAnalyticsService');
const {
  buildStudentWhere,
  buildExamWhere,
  applyEvidenceQualityFilter,
} = require('./learningAnalyticsFilterUtils');
const {
  isAdmin,
  isExecutive,
  isTeacher,
  getUserLearningJourneyScope,
} = require('../learningJourney/learningJourneyAccessService');

const CONTRACT_VERSION = 'learning-analytics.offerings.v4';
const MIN_GROWTH_SAMPLE = 10;
const MAIN_SKILLS = ['listening', 'reading', 'speaking', 'writing'];
/** 原始分：平均與中位數差距達此門檻（或 0.75×IQR）視為易受極端值影響 */
const RAW_SKEW_ABS_FLOOR = 4;
/** GSE：平均與中位數差距門檻 */
const GSE_SKEW_ABS_FLOOR = 1;
/** 同測：原始分明顯變動但 |GSE| 幾乎不動 → 換算解析度警示 */
const GSE_RESOLUTION_RAW_FLOOR = 5;
const GSE_RESOLUTION_GSE_ABS_MAX = 0.5;

const GROWTH_SCALE_GUIDANCE = Object.freeze({
  pairingRule: 'same_instrument_only',
  primaryMetric: 'rawDelta',
  secondaryMetric: 'gse',
  summary:
    '前後測配對僅在「同一英檢」內進行。同測進步請以原始分為主；GSE 是跨測驗比較用的共同量尺，同測時錨點較粗或高分貼頂可能顯示 0，不代表卷面沒進步。',
});

const OFFERING_DIMENSIONS = Object.freeze(['course', 'instructor', 'activity', 'resource_category']);
const INSTRUCTOR_GROUPINGS = Object.freeze(['by_semester', 'merged']);

const RESOURCE_LABELS = Object.freeze({
  GE: '通識英文',
  EAP: 'EAP',
  ESP: 'ESP',
  ENGLISH_TABLE: 'English Table',
  ENGLISH_CLUB: 'English Club',
  JOB_TALK: 'Job Talk',
  INTERNATIONAL_FORUM: 'International Forum',
  WORKSHOP: '工作坊',
  TUTOR_IN_PERSON: '實體一對一諮詢',
  TUTOR_ONLINE: '線上一對一諮詢',
  ACTIVITY_OTHER: '其他活動',
  COURSE_OTHER: '其他課程',
});

const SKILL_LABELS = Object.freeze({
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
});

const IMPROVEMENT_DEFINITIONS = Object.freeze([
  {
    key: 'any',
    label: '任一技能進步',
    detail: '聽／說／讀／寫中，至少一項有前後測，且該項後測優於前測（原始分差 > 0）。',
  },
  {
    key: 'allSkills',
    label: '全技能進步',
    detail: '聽／說／讀／寫四項都有前後測，且每一項後測都優於前測。缺任一技能資料則不算。',
  },
  {
    key: 'avgPositive',
    label: '學生平均原始進步 > 0',
    detail: '該生所有可算前後測原始分差的平均值 > 0。',
  },
]);

function buildCautions() {
  return [
    '本頁為描述性統計：參與某課程／活動的學生之前後測進步趨勢，不代表該課程或教師造成進步。',
    '同一學生若修多門課或參加多場活動，會被重複計入各細項的人數與進步率。',
    GROWTH_SCALE_GUIDANCE.summary,
    '平均原始分進步：先計算每位學生可計算前後測的平均 delta，再對群體取平均（與「資源效益」頁口徑一致）。同測請以此為主指標。',
    'GSE 實際／修正：跨測驗量尺；同測時若原始分明顯變動但 GSE≈0，會標「換算解析度不足」，請勿解讀為沒進步。',
    '進步／持平／退步人數：依每位學生「所有前後測原始分 delta 的平均」判斷（>0／=0／<0）。',
    '中位數與 Q1–Q3（四分位）依學生層級平均計算；若平均遠高於／低於中位數，列上會標示「易受極端值影響」。',
    `可計算成長人數少於 ${MIN_GROWTH_SAMPLE} 人時，不顯示平均進步、分布與方向人數，以避免小樣本誤判。`,
    `「${IMPROVEMENT_DEFINITIONS[0].label}」：${IMPROVEMENT_DEFINITIONS[0].detail}`,
    `「${IMPROVEMENT_DEFINITIONS[1].label}」：${IMPROVEMENT_DEFINITIONS[1].detail}`,
    `「${IMPROVEMENT_DEFINITIONS[2].label}」：${IMPROVEMENT_DEFINITIONS[2].detail}`,
  ];
}

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

function mean(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return round(nums.reduce((sum, v) => sum + v, 0) / nums.length, 2);
}

/** 線性插值百分位；values 可未排序 */
function percentile(values, p) {
  const nums = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  if (nums.length === 1) return round(nums[0], 2);
  const rank = (Math.max(0, Math.min(100, Number(p))) / 100) * (nums.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return round(nums[lo], 2);
  const weight = rank - lo;
  return round(nums[lo] * (1 - weight) + nums[hi] * weight, 2);
}

function buildDistribution(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) {
    return {
      n: 0,
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
    };
  }
  const sorted = [...nums].sort((a, b) => a - b);
  return {
    n: sorted.length,
    median: percentile(sorted, 50),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    min: round(sorted[0], 2),
    max: round(sorted[sorted.length - 1], 2),
  };
}

/**
 * 依學生層級平均 delta 分類進步／持平／退步
 */
function buildDirectionCounts(studentAvgs, privacySuppressed) {
  if (privacySuppressed) {
    return { improved: null, flat: null, declined: null, total: null };
  }
  let improved = 0;
  let flat = 0;
  let declined = 0;
  for (const value of studentAvgs) {
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    if (n > 0) improved += 1;
    else if (n < 0) declined += 1;
    else flat += 1;
  }
  return {
    improved,
    flat,
    declined,
    total: improved + flat + declined,
  };
}

function skewThreshold(distribution, absFloor) {
  const iqr = distribution?.p75 != null && distribution?.p25 != null
    ? distribution.p75 - distribution.p25
    : null;
  if (iqr != null && iqr > 0) return Math.max(absFloor, 0.75 * iqr);
  return absFloor;
}

/**
 * 平均相對中位數偏離、或剔除最極端 1 人後平均明顯改變 → 標示易受極端值影響
 */
function assessOutlierSkew({
  avgRaw,
  avgGseActual,
  rawDistribution,
  gseActualDistribution,
  studentAvgs,
  privacySuppressed,
}) {
  if (privacySuppressed) {
    return {
      flagged: false,
      reason: null,
      meanMedianGapRaw: null,
      meanMedianGapGseActual: null,
    };
  }

  const reasons = [];
  let meanMedianGapRaw = null;
  let meanMedianGapGseActual = null;

  if (avgRaw != null && rawDistribution?.median != null) {
    meanMedianGapRaw = round(avgRaw - rawDistribution.median, 2);
    const gapAbs = Math.abs(meanMedianGapRaw);
    const threshold = skewThreshold(rawDistribution, RAW_SKEW_ABS_FLOOR);
    if (gapAbs >= threshold) {
      reasons.push(
        `原始分平均（${formatSigned(avgRaw)}）與中位數（${formatSigned(rawDistribution.median)}）差距 ${formatSigned(meanMedianGapRaw)}，可能受少數極端值拉高／拉低`
      );
    }
  }

  if (avgGseActual != null && gseActualDistribution?.median != null) {
    meanMedianGapGseActual = round(avgGseActual - gseActualDistribution.median, 2);
    const gapAbs = Math.abs(meanMedianGapGseActual);
    const threshold = skewThreshold(gseActualDistribution, GSE_SKEW_ABS_FLOOR);
    if (gapAbs >= threshold) {
      reasons.push(
        `GSE 實際平均（${formatSigned(avgGseActual)}）與中位數（${formatSigned(gseActualDistribution.median)}）差距 ${formatSigned(meanMedianGapGseActual)}`
      );
    }
  }

  if (studentAvgs.length >= MIN_GROWTH_SAMPLE && avgRaw != null) {
    let extremeIdx = 0;
    for (let i = 1; i < studentAvgs.length; i += 1) {
      if (Math.abs(studentAvgs[i]) > Math.abs(studentAvgs[extremeIdx])) extremeIdx = i;
    }
    const withoutExtreme = studentAvgs.filter((_, i) => i !== extremeIdx);
    const meanWithout = mean(withoutExtreme);
    if (meanWithout != null) {
      const pull = round(avgRaw - meanWithout, 2);
      if (Math.abs(pull) >= RAW_SKEW_ABS_FLOOR) {
        reasons.push(
          `剔除極端 1 人後原始平均為 ${formatSigned(meanWithout)}（原 ${formatSigned(avgRaw)}）`
        );
      }
    }
  }

  const uniqueReasons = [...new Set(reasons)];
  return {
    flagged: uniqueReasons.length > 0,
    reason: uniqueReasons.length ? uniqueReasons.join('；') : null,
    meanMedianGapRaw,
    meanMedianGapGseActual,
  };
}

function formatSigned(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+${n}` : `${n}`;
}

function normalizeDimension(raw) {
  const value = String(raw || 'course').trim().toLowerCase();
  return OFFERING_DIMENSIONS.includes(value) ? value : 'course';
}

function normalizeInstructorGrouping(raw) {
  const value = String(raw || 'by_semester').trim().toLowerCase();
  return INSTRUCTOR_GROUPINGS.includes(value) ? value : 'by_semester';
}

function normText(value) {
  return String(value || '').trim();
}

function normInstructor(value) {
  return normText(value) || '未標示教師';
}

function normLower(value) {
  return normText(value).toLowerCase();
}

function isImprovedDelta(delta) {
  return Number(delta) > 0;
}

function buildStudentGrowthMap(exams = []) {
  const map = new Map();
  for (const exam of exams) {
    if (!exam.retestFlag || exam.deltaRawScore == null) continue;
    const sid = String(exam.studentId || '').toUpperCase();
    if (!sid) continue;
    if (!map.has(sid)) {
      map.set(sid, {
        deltas: [],
        episodeCount: 0,
        skillDeltas: new Map(),
        instrumentCounts: new Map(),
      });
    }
    const row = map.get(sid);
    const delta = Number(exam.deltaRawScore);
    row.deltas.push(delta);
    row.episodeCount += 1;
    const skill = normText(exam.skill) || 'unknown';
    if (!row.skillDeltas.has(skill)) row.skillDeltas.set(skill, []);
    row.skillDeltas.get(skill).push(delta);
    const instrument = normText(exam.instrument) || 'UNKNOWN';
    row.instrumentCounts.set(instrument, (row.instrumentCounts.get(instrument) || 0) + 1);
  }
  return map;
}

function detectGseResolutionWarning(avgRaw, avgGse) {
  if (avgRaw == null || !Number.isFinite(Number(avgRaw))) {
    return { flagged: false, code: null, reason: null };
  }
  const rawAbs = Math.abs(Number(avgRaw));
  if (rawAbs < GSE_RESOLUTION_RAW_FLOOR) {
    return { flagged: false, code: null, reason: null };
  }
  if (avgGse == null || !Number.isFinite(Number(avgGse))) {
    return {
      flagged: true,
      code: 'gse_unmapped',
      reason: `原始分平均變化 ${formatSigned(avgRaw)}，但此生無可換算的 GSE episode（錨點門檻外或工具不支援）。同測請以原始分為準。`,
    };
  }
  if (Math.abs(Number(avgGse)) <= GSE_RESOLUTION_GSE_ABS_MAX) {
    return {
      flagged: true,
      code: 'gse_resolution_low',
      reason: `原始分平均變化 ${formatSigned(avgRaw)}，但 GSE≈${formatSigned(avgGse)}。多半是同測換算錨點過粗或高分貼頂，不代表沒進步。`,
    };
  }
  return { flagged: false, code: null, reason: null };
}

function instrumentBreakdown(instrumentCounts) {
  return [...(instrumentCounts || new Map()).entries()]
    .map(([instrument, episodeCount]) => ({ instrument, episodeCount }))
    .sort((a, b) => b.episodeCount - a.episodeCount || a.instrument.localeCompare(b.instrument));
}

function skillHasPositiveGrowth(deltas) {
  if (!deltas?.length) return false;
  // 同一技能多筆配對時：平均原始進步 > 0 視為該技能表現更好
  const avg = mean(deltas);
  return avg != null && avg > 0;
}

function studentImprovedAny(row) {
  return MAIN_SKILLS.some((skill) => skillHasPositiveGrowth(row.skillDeltas.get(skill) || []));
}

function studentImprovedAllSkills(row) {
  return MAIN_SKILLS.every((skill) => skillHasPositiveGrowth(row.skillDeltas.get(skill) || []));
}

function studentImprovedAvgPositive(row) {
  const avg = mean(row.deltas);
  return avg != null && avg > 0;
}

function buildImprovementMetrics(withGrowth, growthMap, privacySuppressed) {
  const buildOne = (predicate) => {
    const studentCount = withGrowth.filter((id) => predicate(growthMap.get(id))).length;
    return {
      studentCount: privacySuppressed ? null : studentCount,
      rate: privacySuppressed || !withGrowth.length
        ? null
        : round(studentCount / withGrowth.length, 4),
    };
  };
  return {
    any: { ...buildOne(studentImprovedAny), label: IMPROVEMENT_DEFINITIONS[0].label },
    allSkills: { ...buildOne(studentImprovedAllSkills), label: IMPROVEMENT_DEFINITIONS[1].label },
    avgPositive: { ...buildOne(studentImprovedAvgPositive), label: IMPROVEMENT_DEFINITIONS[2].label },
  };
}

function buildGrowthEpisodeMap(episodes = []) {
  const map = new Map();
  for (const episode of episodes) {
    const sid = String(episode.studentId || '').toUpperCase();
    if (!sid) continue;
    if (!map.has(sid)) map.set(sid, []);
    map.get(sid).push(episode);
  }
  return map;
}

function buildSkillBreakdown(participantIds, growthMap, growthEpisodeMap) {
  const ids = [...participantIds];
  return MAIN_SKILLS.map((skill) => {
    const rawDeltas = [];
    const actualGse = [];
    const adjustedGse = [];
    const improvedAny = [];
    for (const sid of ids) {
      const studentGrowth = growthMap.get(sid);
      const skillDeltas = studentGrowth?.skillDeltas?.get(skill) || [];
      if (skillDeltas.length) rawDeltas.push(...skillDeltas);
      const episodes = (growthEpisodeMap.get(sid) || []).filter((ep) => ep.skill === skill);
      if (episodes.length) {
        actualGse.push(mean(episodes.map((ep) => ep.actualGseGrowth)));
        adjustedGse.push(mean(episodes.map((ep) => ep.adjustedGseGrowth)));
        improvedAny.push(skillDeltas.some(isImprovedDelta));
      }
    }
    const growthSampleSize = ids.filter((sid) => (growthMap.get(sid)?.skillDeltas?.get(skill) || []).length > 0).length;
    if (!growthSampleSize) return null;
    const privacySuppressed = growthSampleSize < MIN_GROWTH_SAMPLE;
    return {
      skill,
      label: SKILL_LABELS[skill] || skill,
      growthSampleSize,
      avgRawDelta: privacySuppressed ? null : mean(rawDeltas),
      avgActualGseGrowth: privacySuppressed ? null : mean(actualGse.filter((v) => v != null)),
      avgAdjustedGseGrowth: privacySuppressed ? null : mean(adjustedGse.filter((v) => v != null)),
      improvedRateAny: privacySuppressed ? null : round(
        improvedAny.filter(Boolean).length / growthSampleSize,
        4
      ),
      privacySuppressed,
    };
  }).filter(Boolean);
}

function nullDistribution() {
  return {
    n: 0,
    median: null,
    p25: null,
    p75: null,
    min: null,
    max: null,
  };
}

function aggregateOfferingMetrics(participantIds, growthMap, growthEpisodeMap = new Map()) {
  const ids = [...participantIds];
  const withGrowth = ids.filter((id) => growthMap.has(id));
  const studentAvgs = withGrowth
    .map((id) => mean(growthMap.get(id).deltas))
    .filter((v) => v != null);
  const growthSampleSize = withGrowth.length;
  const privacySuppressed = growthSampleSize > 0 && growthSampleSize < MIN_GROWTH_SAMPLE;

  const actualGseStudentAvgs = withGrowth
    .map((id) => mean((growthEpisodeMap.get(id) || []).map((ep) => ep.actualGseGrowth)))
    .filter((v) => v != null);
  const adjustedGseStudentAvgs = withGrowth
    .map((id) => mean((growthEpisodeMap.get(id) || []).map((ep) => ep.adjustedGseGrowth)))
    .filter((v) => v != null);

  const improvement = buildImprovementMetrics(withGrowth, growthMap, privacySuppressed);
  const avgRawDelta = privacySuppressed ? null : mean(studentAvgs);
  const avgActualGseGrowth = privacySuppressed ? null : mean(actualGseStudentAvgs);
  const avgAdjustedGseGrowth = privacySuppressed ? null : mean(adjustedGseStudentAvgs);
  const rawDistribution = privacySuppressed ? nullDistribution() : buildDistribution(studentAvgs);
  const gseActualDistribution = privacySuppressed
    ? nullDistribution()
    : buildDistribution(actualGseStudentAvgs);
  const gseAdjustedDistribution = privacySuppressed
    ? nullDistribution()
    : buildDistribution(adjustedGseStudentAvgs);
  const direction = buildDirectionCounts(studentAvgs, privacySuppressed);
  const outlierSkew = assessOutlierSkew({
    avgRaw: avgRawDelta,
    avgGseActual: avgActualGseGrowth,
    rawDistribution,
    gseActualDistribution,
    studentAvgs,
    privacySuppressed,
  });

  let gseResolutionWarningStudentCount = 0;
  if (!privacySuppressed) {
    for (const id of withGrowth) {
      const rawAvg = mean(growthMap.get(id).deltas);
      const gseAvg = mean((growthEpisodeMap.get(id) || []).map((ep) => ep.actualGseGrowth));
      if (detectGseResolutionWarning(rawAvg, gseAvg).flagged) {
        gseResolutionWarningStudentCount += 1;
      }
    }
  }

  return {
    participantCount: ids.length,
    growthSampleSize,
    growthEpisodeCount: withGrowth.reduce((sum, id) => sum + growthMap.get(id).episodeCount, 0),
    improvement,
    improvedStudentCount: improvement.any.studentCount,
    improvedRate: improvement.any.rate,
    direction,
    rawDistribution,
    gseActualDistribution,
    gseAdjustedDistribution,
    medianRawDelta: privacySuppressed ? null : rawDistribution.median,
    medianActualGseGrowth: privacySuppressed ? null : gseActualDistribution.median,
    medianAdjustedGseGrowth: privacySuppressed ? null : gseAdjustedDistribution.median,
    avgRawDelta,
    avgActualGseGrowth,
    avgAdjustedGseGrowth,
    outlierSkew,
    primaryGrowthMetric: 'rawDelta',
    gseRole: 'cross_exam_scale',
    pairingRule: GROWTH_SCALE_GUIDANCE.pairingRule,
    gseResolutionWarningStudentCount: privacySuppressed ? null : gseResolutionWarningStudentCount,
    privacySuppressed,
    suppressionReason: privacySuppressed
      ? `可計算成長人數少於 ${MIN_GROWTH_SAMPLE} 人，不顯示平均進步、分布與方向人數`
      : null,
    causalClaimAllowed: false,
  };
}

function finalizeOfferingRow(base, participantIds, growthMap, growthEpisodeMap) {
  const metrics = aggregateOfferingMetrics(participantIds, growthMap, growthEpisodeMap);
  return {
    ...base,
    ...metrics,
    skillBreakdown: buildSkillBreakdown(participantIds, growthMap, growthEpisodeMap),
  };
}

function buildCourseOfferings(enrollments, growthMap, growthEpisodeMap) {
  const buckets = new Map();
  for (const row of enrollments) {
    const course = row.course || {};
    const semesterId = normText(row.semesterId || course.semesterId);
    const courseId = row.courseId;
    if (!semesterId || courseId == null) continue;
    const offeringKey = `${semesterId}::${courseId}`;
    if (!buckets.has(offeringKey)) {
      const instructorName = normInstructor(course.instructorName);
      const courseName = normText(course.courseName) || normText(course.courseCode) || '未命名課程';
      buckets.set(offeringKey, {
        offeringKey,
        label: instructorName === '未標示教師' ? courseName : `${courseName}（${instructorName}）`,
        semesterId,
        courseId,
        courseCode: normText(course.courseCode) || null,
        courseName,
        instructorName,
        courseType: normText(course.courseType) || null,
        participantIds: new Set(),
      });
    }
    buckets.get(offeringKey).participantIds.add(String(row.studentId || '').toUpperCase());
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      semesterId: bucket.semesterId,
      courseId: bucket.courseId,
      courseCode: bucket.courseCode,
      courseName: bucket.courseName,
      instructorName: bucket.instructorName,
      courseType: bucket.courseType,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => b.participantCount - a.participantCount);
}

function buildInstructorOfferings(enrollments, growthMap, growthEpisodeMap, instructorGrouping = 'by_semester') {
  const buckets = new Map();
  for (const row of enrollments) {
    const course = row.course || {};
    const semesterId = normText(row.semesterId || course.semesterId);
    if (!semesterId && instructorGrouping === 'by_semester') continue;
    const instructorName = normInstructor(course.instructorName);
    const offeringKey = instructorGrouping === 'merged'
      ? `instructor::${instructorName}`
      : `${semesterId}::${instructorName}`;
    if (!buckets.has(offeringKey)) {
      buckets.set(offeringKey, {
        offeringKey,
        label: instructorName,
        semesterId: instructorGrouping === 'merged' ? null : semesterId,
        semesterLabel: instructorGrouping === 'merged' ? '跨學期' : semesterId,
        instructorName,
        semesterIds: new Set(),
        courseCount: 0,
        courseNames: new Set(),
        participantIds: new Set(),
      });
    }
    const bucket = buckets.get(offeringKey);
    bucket.participantIds.add(String(row.studentId || '').toUpperCase());
    if (semesterId) bucket.semesterIds.add(semesterId);
    const courseName = normText(course.courseName);
    if (courseName) bucket.courseNames.add(courseName);
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      semesterId: bucket.semesterId,
      semesterLabel: bucket.semesterLabel,
      instructorName: bucket.instructorName,
      semesterIds: [...bucket.semesterIds].sort(),
      courseCount: bucket.courseNames.size,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => b.participantCount - a.participantCount);
}

function resolveActivityOfferingKey(event) {
  const payload = event.rawPayload && typeof event.rawPayload === 'object' ? event.rawPayload : {};
  const eventId = payload.eventId != null ? String(payload.eventId) : '';
  if (eventId) return `event:${eventId}`;
  const eventDate = normText(event.eventDate);
  const title = normText(event.title) || '活動';
  return `session:${eventDate}::${title}`;
}

function buildActivityOfferings(events, growthMap, growthEpisodeMap) {
  const buckets = new Map();
  for (const event of events) {
    const sid = String(event.studentId || '').toUpperCase();
    if (!sid) continue;
    const offeringKey = resolveActivityOfferingKey(event);
    if (!buckets.has(offeringKey)) {
      const payload = event.rawPayload && typeof event.rawPayload === 'object' ? event.rawPayload : {};
      buckets.set(offeringKey, {
        offeringKey,
        label: normText(event.title) || '活動',
        semesterId: normText(event.academicTerm) || null,
        eventDate: normText(event.eventDate) || null,
        activityType: normText(payload.activityType) || null,
        eventId: payload.eventId != null ? String(payload.eventId) : null,
        participantIds: new Set(),
      });
    }
    buckets.get(offeringKey).participantIds.add(sid);
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      semesterId: bucket.semesterId,
      eventDate: bucket.eventDate,
      activityType: bucket.activityType,
      eventId: bucket.eventId,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => {
      const dateCmp = String(b.eventDate || '').localeCompare(String(a.eventDate || ''));
      if (dateCmp !== 0) return dateCmp;
      return b.participantCount - a.participantCount;
    });
}

function buildResourceCategoryOfferings(events, growthMap, growthEpisodeMap) {
  const buckets = new Map();
  for (const event of events) {
    const sid = String(event.studentId || '').toUpperCase();
    if (!sid) continue;
    const resourceType = resourceKeyForEvent(event);
    if (!buckets.has(resourceType)) {
      buckets.set(resourceType, {
        offeringKey: resourceType,
        label: RESOURCE_LABELS[resourceType] || resourceType,
        resourceType,
        participantIds: new Set(),
      });
    }
    buckets.get(resourceType).participantIds.add(sid);
  }
  return [...buckets.values()]
    .map((bucket) => finalizeOfferingRow({
      offeringKey: bucket.offeringKey,
      label: bucket.label,
      resourceType: bucket.resourceType,
    }, bucket.participantIds, growthMap, growthEpisodeMap))
    .sort((a, b) => b.participantCount - a.participantCount);
}

function filterRowsForTeacher(rows, dimension, teacherNameLower) {
  if (!teacherNameLower) return rows;
  if (dimension === 'instructor') {
    return rows.filter((row) => normLower(row.instructorName) === teacherNameLower);
  }
  if (dimension === 'course') {
    return rows.filter((row) => normLower(row.instructorName) === teacherNameLower);
  }
  return rows;
}

async function resolveTeacherScope(user, semesterId) {
  if (!user || isAdmin(user) || isExecutive(user)) return null;
  if (!isTeacher(user)) return { blocked: true };
  const teacherNameLower = normLower(user.name);
  if (semesterId) {
    const scope = await getUserLearningJourneyScope(user, semesterId);
    const allowedStudentIds = new Set(
      (scope.allowedStudentIds || []).map((sid) => String(sid || '').toUpperCase()).filter(Boolean)
    );
    return { teacherNameLower, allowedStudentIds };
  }

  const enrollments = await CourseEnrollment.findAll({
    where: { enrollmentStatus: { [Op.notIn]: ['withdrawn'] } },
    include: [{ model: Course, as: 'course', required: true }],
    attributes: ['studentId'],
  });
  const allowedStudentIds = new Set();
  for (const enr of enrollments) {
    if (normLower(enr.course?.instructorName) !== teacherNameLower) continue;
    const sid = String(enr.studentId || '').toUpperCase();
    if (sid) allowedStudentIds.add(sid);
  }
  return { teacherNameLower, allowedStudentIds };
}

async function loadScopedStudents(query, snapshotVersion, teacherScope) {
  const studentsRaw = await LjAnalyticStudent.findAll({
    where: buildStudentWhere(query, snapshotVersion),
    attributes: [
      'studentId',
      'department',
      'cohort',
      'enrollmentTerm',
      'baselineEnglishScore',
      'baselineCefr',
      'baselineLevel',
      'retestFlag',
      'hasValidExam',
      'totalResourceHours',
      'exposureLevel',
    ],
  });
  let students = applyEvidenceQualityFilter(studentsRaw, query);
  if (teacherScope?.allowedStudentIds?.size) {
    students = students.filter((s) => teacherScope.allowedStudentIds.has(String(s.studentId || '').toUpperCase()));
  }
  return students;
}

async function loadGrowthExams(query, snapshotVersion, studentIds) {
  if (!studentIds.length) return [];
  return LjAnalyticExam.findAll({
    where: buildExamWhere(query, snapshotVersion, studentIds),
  });
}

async function loadCourseEnrollments(studentIds, semesterId, teacherScope) {
  if (!studentIds.length) return [];
  const where = {
    studentId: { [Op.in]: studentIds },
    enrollmentStatus: { [Op.notIn]: ['withdrawn'] },
  };
  if (semesterId) where.semesterId = semesterId;
  const enrollments = await CourseEnrollment.findAll({
    where,
    include: [{
      model: Course,
      as: 'course',
      required: true,
    }],
    order: [['semesterId', 'DESC'], ['courseId', 'ASC']],
  });
  if (!teacherScope?.teacherNameLower) return enrollments;
  return enrollments.filter((row) => normLower(row.course?.instructorName) === teacherScope.teacherNameLower);
}

async function loadParticipationEvents(studentIds, semesterId) {
  if (!studentIds.length) return [];
  const where = {
    studentId: { [Op.in]: studentIds },
    eventType: { [Op.in]: ['course_event', 'activity_event'] },
    excludeFlag: false,
    status: { [Op.in]: ['valid', 'registered_no_score'] },
  };
  if (semesterId) where.academicTerm = semesterId;
  return LjStudentEvent.findAll({ where });
}

function resolveOfferingParticipantIds(dimension, offeringKey, { enrollments = [], events = [] } = {}) {
  const participantIds = new Set();
  if (dimension === 'course') {
    for (const enr of enrollments) {
      const key = `${normText(enr.semesterId)}::${enr.courseId}`;
      if (key === offeringKey) participantIds.add(String(enr.studentId).toUpperCase());
    }
    return participantIds;
  }
  if (dimension === 'instructor') {
    if (offeringKey.startsWith('instructor::')) {
      const instructorName = offeringKey.slice('instructor::'.length);
      for (const enr of enrollments) {
        if (normInstructor(enr.course?.instructorName) === instructorName) {
          participantIds.add(String(enr.studentId).toUpperCase());
        }
      }
      return participantIds;
    }
    const sep = offeringKey.indexOf('::');
    const semesterId = offeringKey.slice(0, sep);
    const instructorName = offeringKey.slice(sep + 2);
    for (const enr of enrollments) {
      if (normText(enr.semesterId) === semesterId
        && normInstructor(enr.course?.instructorName) === instructorName) {
        participantIds.add(String(enr.studentId).toUpperCase());
      }
    }
    return participantIds;
  }
  if (dimension === 'activity') {
    for (const event of events.filter((e) => e.eventType === 'activity_event')) {
      if (resolveActivityOfferingKey(event) === offeringKey) {
        participantIds.add(String(event.studentId).toUpperCase());
      }
    }
    return participantIds;
  }
  for (const event of events) {
    if (resourceKeyForEvent(event) === offeringKey) {
      participantIds.add(String(event.studentId).toUpperCase());
    }
  }
  return participantIds;
}

function buildStudentDetailRows(participantIds, growthMap, growthEpisodeMap) {
  return [...participantIds]
    .map((studentId) => {
      const growth = growthMap.get(studentId);
      if (!growth) {
        return {
          studentId,
          growthSampleSize: 0,
          growthEpisodeCount: 0,
          gseMappedEpisodeCount: 0,
          avgRawDelta: null,
          avgActualGseGrowth: null,
          avgAdjustedGseGrowth: null,
          improvement: null,
          instruments: [],
          primaryGrowthMetric: 'rawDelta',
          pairingRule: GROWTH_SCALE_GUIDANCE.pairingRule,
          gseResolutionWarning: null,
          skillBreakdown: [],
        };
      }
      const withGrowth = [studentId];
      const privacySuppressed = false;
      const improvement = buildImprovementMetrics(withGrowth, growthMap, privacySuppressed);
      const episodes = growthEpisodeMap.get(studentId) || [];
      const avgRawDelta = mean(growth.deltas);
      const avgActualGseGrowth = mean(episodes.map((ep) => ep.actualGseGrowth));
      const avgAdjustedGseGrowth = mean(episodes.map((ep) => ep.adjustedGseGrowth));
      const gseResolutionWarning = detectGseResolutionWarning(avgRawDelta, avgActualGseGrowth);
      return {
        studentId,
        growthSampleSize: 1,
        growthEpisodeCount: growth.episodeCount,
        gseMappedEpisodeCount: episodes.length,
        avgRawDelta,
        avgActualGseGrowth,
        avgAdjustedGseGrowth,
        improvement,
        instruments: instrumentBreakdown(growth.instrumentCounts),
        primaryGrowthMetric: 'rawDelta',
        pairingRule: GROWTH_SCALE_GUIDANCE.pairingRule,
        gseResolutionWarning: gseResolutionWarning.flagged ? gseResolutionWarning : null,
        skillBreakdown: buildSkillBreakdown(new Set([studentId]), growthMap, growthEpisodeMap),
      };
    })
    .sort((a, b) => (b.avgRawDelta ?? -Infinity) - (a.avgRawDelta ?? -Infinity));
}

async function buildOfferingContext(query = {}, options = {}) {
  const dimension = normalizeDimension(query.dimension);
  const snapshotVersion = query.snapshot_version || query.snapshotVersion || await resolveLatestSnapshotVersion();
  const semesterId = normText(query.semester || query.semester_id || query.semesterId) || null;
  const instructorGrouping = normalizeInstructorGrouping(
    query.instructor_grouping || query.instructorGrouping
  );
  const teacherScope = await resolveTeacherScope(options.user, semesterId);
  if (teacherScope?.blocked) {
    return { blocked: true };
  }

  const students = await loadScopedStudents(query, snapshotVersion, teacherScope);
  const studentById = new Map(students.map((student) => [String(student.studentId).toUpperCase(), student]));
  const studentIds = [...studentById.keys()];
  const exams = await loadGrowthExams(query, snapshotVersion, studentIds);
  const growthMap = buildStudentGrowthMap(exams);
  const growthEpisodes = computeAdjustedGrowthEpisodes(exams, studentById);
  const growthEpisodeMap = buildGrowthEpisodeMap(growthEpisodes);

  let rows = [];
  let enrollments = [];
  let events = [];
  if (dimension === 'course' || dimension === 'instructor') {
    enrollments = await loadCourseEnrollments(studentIds, semesterId, teacherScope);
    rows = dimension === 'course'
      ? buildCourseOfferings(enrollments, growthMap, growthEpisodeMap)
      : buildInstructorOfferings(enrollments, growthMap, growthEpisodeMap, instructorGrouping);
  } else {
    events = await loadParticipationEvents(studentIds, semesterId);
    rows = dimension === 'activity'
      ? buildActivityOfferings(events.filter((e) => e.eventType === 'activity_event'), growthMap, growthEpisodeMap)
      : buildResourceCategoryOfferings(events, growthMap, growthEpisodeMap);
  }

  if (teacherScope?.teacherNameLower) {
    rows = filterRowsForTeacher(rows, dimension, teacherScope.teacherNameLower);
  }

  return {
    dimension,
    snapshotVersion,
    semesterId,
    instructorGrouping,
    teacherScope,
    growthMap,
    growthEpisodeMap,
    enrollments,
    events,
    rows,
  };
}

/**
 * 課程／教師／活動／資源類別細項成效（描述性）
 */
async function getLearningAnalyticsOfferings(query = {}, options = {}) {
  const ctx = await buildOfferingContext(query, options);
  if (ctx.blocked) {
    return {
      contractVersion: CONTRACT_VERSION,
      dimension: normalizeDimension(query.dimension),
      rowCount: 0,
      rows: [],
      teacherScope: 'denied',
      cautions: [...buildCautions()],
      growthScaleGuidance: GROWTH_SCALE_GUIDANCE,
      causalClaimAllowed: false,
    };
  }

  return {
    contractVersion: CONTRACT_VERSION,
    snapshotVersion: ctx.snapshotVersion,
    dimension: ctx.dimension,
    semester: ctx.semesterId,
    instructorGrouping: ctx.instructorGrouping,
    teacherScope: ctx.teacherScope ? 'teacher' : 'all',
    rowCount: ctx.rows.length,
    minGrowthSample: MIN_GROWTH_SAMPLE,
    improvementDefinitions: IMPROVEMENT_DEFINITIONS,
    growthScaleGuidance: GROWTH_SCALE_GUIDANCE,
    rows: ctx.rows,
    cautions: [...buildCautions()],
    causalClaimAllowed: false,
  };
}

/**
 * 單一細項的學生名單與成長明細
 */
async function getLearningAnalyticsOfferingDetail(query = {}, options = {}) {
  const offeringKey = normText(query.offering_key || query.offeringKey);
  if (!offeringKey) {
    const err = new Error('offering_key 為必填');
    err.status = 400;
    throw err;
  }

  const ctx = await buildOfferingContext(query, options);
  if (ctx.blocked) {
    return {
      contractVersion: CONTRACT_VERSION,
      offeringKey,
      students: [],
      teacherScope: 'denied',
      causalClaimAllowed: false,
    };
  }

  const row = ctx.rows.find((item) => item.offeringKey === offeringKey) || null;
  if (!row) {
    const err = new Error('找不到指定的細項');
    err.status = 404;
    throw err;
  }

  const participantIds = resolveOfferingParticipantIds(ctx.dimension, offeringKey, {
    enrollments: ctx.enrollments,
    events: ctx.events,
  });
  const students = buildStudentDetailRows(participantIds, ctx.growthMap, ctx.growthEpisodeMap);

  return {
    contractVersion: CONTRACT_VERSION,
    snapshotVersion: ctx.snapshotVersion,
    dimension: ctx.dimension,
    offeringKey,
    offering: {
      label: row.label,
      semesterId: row.semesterId,
      semesterLabel: row.semesterLabel,
      participantCount: row.participantCount,
      growthSampleSize: row.growthSampleSize,
      improvement: row.improvement,
      direction: row.direction,
      rawDistribution: row.rawDistribution,
      gseActualDistribution: row.gseActualDistribution,
      gseAdjustedDistribution: row.gseAdjustedDistribution,
      medianRawDelta: row.medianRawDelta,
      medianActualGseGrowth: row.medianActualGseGrowth,
      medianAdjustedGseGrowth: row.medianAdjustedGseGrowth,
      avgRawDelta: row.avgRawDelta,
      avgActualGseGrowth: row.avgActualGseGrowth,
      avgAdjustedGseGrowth: row.avgAdjustedGseGrowth,
      outlierSkew: row.outlierSkew,
      primaryGrowthMetric: row.primaryGrowthMetric,
      gseRole: row.gseRole,
      pairingRule: row.pairingRule,
      gseResolutionWarningStudentCount: row.gseResolutionWarningStudentCount,
      skillBreakdown: row.skillBreakdown,
    },
    students,
    improvementDefinitions: IMPROVEMENT_DEFINITIONS,
    growthScaleGuidance: GROWTH_SCALE_GUIDANCE,
    causalClaimAllowed: false,
  };
}

module.exports = {
  CONTRACT_VERSION,
  MIN_GROWTH_SAMPLE,
  OFFERING_DIMENSIONS,
  INSTRUCTOR_GROUPINGS,
  IMPROVEMENT_DEFINITIONS,
  GROWTH_SCALE_GUIDANCE,
  RESOURCE_LABELS,
  SKILL_LABELS,
  normalizeDimension,
  normalizeInstructorGrouping,
  buildStudentGrowthMap,
  aggregateOfferingMetrics,
  detectGseResolutionWarning,
  buildCourseOfferings,
  buildInstructorOfferings,
  buildActivityOfferings,
  buildResourceCategoryOfferings,
  buildStudentDetailRows,
  resolveOfferingParticipantIds,
  buildOfferingContext,
  getLearningAnalyticsOfferings,
  getLearningAnalyticsOfferingDetail,
};
