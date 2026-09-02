'use strict';

const {
  LVA_CONTRACT_VERSION,
  cefrToGse,
  inferGseScore,
  evidenceQualityForStudent,
  summarizeAdjustedGrowth,
  summarizeQuasiCausalEstimates,
  summarizePropensityWeightedEstimates,
  supportedFilters,
  resourceKeyForEvent,
  normalizeAcademicCourseResourceType,
} = require('../services/learningJourney/analytics/lvaAnalyticsService');

describe('lvaAnalyticsService', () => {
  it('keeps the public contract version explicit', () => {
    expect(LVA_CONTRACT_VERSION).toBe('lva.analytics.response.v1');
    expect(supportedFilters()).toEqual(expect.objectContaining({
      student: expect.arrayContaining(['department', 'baseline_level', 'retest_flag']),
      exam: expect.arrayContaining(['instrument', 'skill']),
      exclusion: expect.arrayContaining(['include_reason_code', 'exclude_reason_code']),
    }));
  });

  it('maps CEFR display levels to GSE without treating CEFR as the API display value', () => {
    expect(cefrToGse('A2')).toBe(36);
    expect(cefrToGse('B2')).toBe(67);
    expect(cefrToGse('Below A1')).toBe(15.5);
  });

  it('infers GSE from score-based exam rows', () => {
    expect(inferGseScore({
      instrument: 'TOEIC',
      skill: 'listening',
      rawScore: 275,
      examDate: '2025-01-01',
    })).toBe(43);
    expect(inferGseScore({
      instrument: 'TOEIC',
      skill: 'listening',
      rawScore: 400,
      examDate: '2025-01-01',
    })).toBe(59);
  });

  it('classifies evidence quality from available baseline, retest, and exposure data', () => {
    expect(evidenceQualityForStudent({
      retestFlag: true,
      hasValidExam: true,
      totalResourceHours: 8,
    })).toBe('high');
    expect(evidenceQualityForStudent({
      retestFlag: false,
      hasValidExam: true,
      baselineEnglishScore: 12,
      totalResourceHours: 0,
    })).toBe('medium');
    expect(evidenceQualityForStudent({})).toBe('low');
  });

  it('computes adjusted growth v2 with estimate metadata and no causal claim', () => {
    const studentById = new Map([
      ['S001', {
        studentId: 'S001',
        department: '外文系',
        baselineCefr: 'A2',
        retestFlag: true,
        hasValidExam: true,
        totalResourceHours: 6,
      }],
    ]);
    const result = summarizeAdjustedGrowth([
      {
        id: 2,
        studentId: 'S001',
        retestFlag: true,
        deltaRawScore: 125,
        previousRawScore: 275,
        previousExamEventId: 1,
        rawScore: 400,
        instrument: 'TOEIC',
        skill: 'listening',
        examDate: '2025-07-01',
        resourceHoursBeforeExam: 6,
      },
      {
        id: 1,
        studentId: 'S001',
        retestFlag: false,
        rawScore: 275,
        instrument: 'TOEIC',
        skill: 'listening',
        examDate: '2025-01-01',
      },
    ], studentById);

    expect(result.estimateType).toBe('baseline_adjusted_regression_v2');
    expect(result.causalClaimAllowed).toBe(false);
    expect(result.sampleSize).toBe(1);
    expect(result.sampleEpisodes[0]).toEqual(expect.objectContaining({
      previousGse: 43,
      postGse: 59,
      actualGseGrowth: 16,
      monthsBetweenTests: expect.any(Number),
      causalClaimAllowed: false,
    }));
  });

  it('builds propensity-style matched comparison estimates without allowing causal claims', () => {
    const estimates = summarizeQuasiCausalEstimates([
      { studentId: 'S001', eventType: 'activity_event', title: 'English Table', hours: 2, status: 'valid' },
    ], {
      sampleEpisodes: [
        {
          studentId: 'S001',
          skill: 'listening',
          baselineGse: 36,
          initialCefrBand: 'A2',
          department: '外文系',
          evidenceQuality: 'high',
          resourceHoursBeforeExam: 4,
          adjustedGseGrowth: 20,
        },
        {
          studentId: 'S002',
          skill: 'listening',
          baselineGse: 36,
          initialCefrBand: 'A2',
          department: '外文系',
          evidenceQuality: 'high',
          resourceHoursBeforeExam: 0,
          adjustedGseGrowth: 5,
        },
      ],
    });

    expect(estimates.estimateType).toBe('propensity_matched_logistic_v2');
    expect(estimates.causalClaimAllowed).toBe(false);
    expect(estimates.byResource[0]).toEqual(expect.objectContaining({
      resourceType: 'ENGLISH_TABLE',
      treatedCount: 1,
      controlPoolCount: 1,
      matchedPairs: 1,
      estimatedEffect: 15,
      causalClaimAllowed: false,
    }));
    expect(estimates.byResource[0].balanceDiagnostics).toEqual(expect.objectContaining({
      balanceQuality: expect.any(String),
      baselineGse: expect.objectContaining({
        standardizedMeanDifference: 0,
      }),
      initialCefrBand: expect.objectContaining({
        exactMatchRate: 1,
      }),
    }));
  });

  it('applies caliper matching and reports unmatched treated rows', () => {
    const estimates = summarizeQuasiCausalEstimates([
      { studentId: 'S001', eventType: 'activity_event', title: 'English Table', hours: 2, status: 'valid' },
    ], {
      sampleEpisodes: [
        {
          studentId: 'S001',
          skill: 'listening',
          baselineGse: 36,
          initialCefrBand: 'A2',
          department: '外文系',
          evidenceQuality: 'high',
          resourceHoursBeforeExam: 4,
          adjustedGseGrowth: 20,
        },
        {
          studentId: 'S002',
          skill: 'listening',
          baselineGse: 80,
          initialCefrBand: 'C1',
          department: '工學院',
          evidenceQuality: 'low',
          resourceHoursBeforeExam: 0,
          adjustedGseGrowth: 5,
        },
      ],
    }, { caliper: 0.05 });

    expect(estimates.caliper).toBe(0.05);
    expect(estimates.byResource[0]).toEqual(expect.objectContaining({
      matchedPairs: 0,
      unmatchedTreatedCount: 1,
      unmatchedTreatedRate: 1,
      estimatedEffect: null,
    }));
  });

  it('builds propensity-style weighted estimates without allowing causal claims', () => {
    const estimates = summarizePropensityWeightedEstimates([
      { studentId: 'S001', eventType: 'activity_event', title: 'English Table', hours: 2, status: 'valid' },
    ], {
      sampleEpisodes: [
        {
          studentId: 'S001',
          skill: 'listening',
          baselineGse: 36,
          initialCefrBand: 'A2',
          department: '外文系',
          evidenceQuality: 'high',
          resourceHoursBeforeExam: 4,
          adjustedGseGrowth: 20,
        },
        {
          studentId: 'S002',
          skill: 'listening',
          baselineGse: 36,
          initialCefrBand: 'A2',
          department: '外文系',
          evidenceQuality: 'high',
          resourceHoursBeforeExam: 0,
          adjustedGseGrowth: 5,
        },
      ],
    });

    expect(estimates.estimateType).toBe('propensity_weighted_logistic_v2');
    expect(estimates.causalClaimAllowed).toBe(false);
    expect(estimates.byResource[0]).toEqual(expect.objectContaining({
      resourceType: 'ENGLISH_TABLE',
      treatedCount: 1,
      controlCount: 1,
      sampleSize: 2,
      causalClaimAllowed: false,
    }));
    expect(estimates.byResource[0].estimatedEffect).not.toBeNull();
  });

  it('maps academic course metadata to GE/EAP/ESP resource types', () => {
    expect(normalizeAcademicCourseResourceType('EAP')).toBe('EAP');
    expect(normalizeAcademicCourseResourceType('EAP001')).toBe('EAP');
    expect(normalizeAcademicCourseResourceType('通識英文')).toBe('GE');
    expect(resourceKeyForEvent({
      eventType: 'course_event',
      title: '實用醫療英語（中高級）',
      rawPayload: { courseType: 'ESP', courseCode: 'ESP003' },
    })).toBe('ESP');
    expect(resourceKeyForEvent({
      eventType: 'course_event',
      title: '學術英文寫作',
      rawPayload: { courseType: 'EAP' },
    })).toBe('EAP');
    expect(resourceKeyForEvent({
      eventType: 'course_event',
      title: '實用醫療英語（中高級）',
      rawPayload: {},
    })).toBe('COURSE_OTHER');
  });

  it('maps EWL activity titles to dedicated resource types', () => {
    expect(resourceKeyForEvent({
      eventType: 'activity_event',
      title: '工作坊',
      rawPayload: { activityType: 'EWL' },
    })).toBe('WORKSHOP');
    expect(resourceKeyForEvent({
      eventType: 'activity_event',
      title: '實體一對一諮詢',
      rawPayload: { activityType: 'EWL', resourceType: 'TUTOR_IN_PERSON' },
    })).toBe('TUTOR_IN_PERSON');
    expect(resourceKeyForEvent({
      eventType: 'activity_event',
      title: '線上一對一諮詢',
      rawPayload: { resourceType: 'TUTOR_ONLINE' },
    })).toBe('TUTOR_ONLINE');
  });
});
