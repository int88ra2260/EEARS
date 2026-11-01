'use strict';

const {
  getMetricDefinition,
  getTemporalContract,
  checkComparison,
  requestAsOf,
  claimOfficial,
  listGoldenCases,
} = require('../../analytics-contracts');

describe('analytics contract semantics and golden cases', () => {
  test('attendance rates stay distinct and incomparable', () => {
    const comparison = checkComparison(
      { metricId: 'ops.reservation.checkin_row_rate' },
      { metricId: 'ops.roster.distinct_checkin_rate' },
    );
    expect(comparison.status).toBe('incompatible');
    expect(checkComparison(
      { metricId: 'ops.roster.distinct_checkin_rate' },
      { metricId: 'bestep.file.attendance_lr_sw_avg' },
    ).status).toBe('incompatible');
  });

  test('attainment definitions stay distinct', () => {
    const ids = [
      'bestep.file.four_skill_cefr_b2',
      'roster.pair_pass.listening_reading',
      'roster.best_skill_rank_b2',
      'snapshot.exam_cell_rank_b2',
    ];
    ids.forEach((left) => {
      ids.filter((right) => right !== left).forEach((right) => {
        expect(checkComparison({ metricId: left }, { metricId: right }).status).toBe('incompatible');
      });
    });
  });

  test('pair CEFR and pair sum need a policy key before they count as the same comparison', () => {
    const open = checkComparison(
      { metricId: 'roster.pair_pass.listening_reading' },
      { metricId: 'roster.pair_pass.listening_reading' },
    );
    expect(open.status).toBe('undetermined');
    const mismatch = checkComparison(
      { metricId: 'roster.pair_pass.listening_reading', policyKey: 'pair-bothcefr-samedate-g24' },
      { metricId: 'roster.pair_pass.listening_reading', policyKey: 'pair-sumraw-samedate-g24' },
    );
    expect(mismatch.status).toBe('incompatible');
  });

  test('historical best is not a sitting result and rejects as-of', () => {
    const metric = getMetricDefinition('roster.best_skill_rank_b2');
    expect(metric.domainId).toBe('DOM-STATE');
    expect(metric.claimRestrictions).toContain('not_single_sitting');
    expect(requestAsOf(metric.metricId).status).toBe('unsupported');
    expect(getTemporalContract('TC-ROSTER-BEST-ASOF-NOW').asOfQuerySupported).toBe(false);
  });

  test('snapshot generation is not a data cutoff', () => {
    const contract = getTemporalContract('TC-SNAPSHOT-VERSION');
    expect(contract.limitations).toContain('generated_at_is_not_data_as_of');
    expect(contract.asOfQuerySupported).toBe(false);
  });

  test('associational metrics cannot claim causality', () => {
    ['partner.score_gap', 'snapshot.resource_effect', 'snapshot.gse_adjusted_delta'].forEach((id) => {
      const metric = getMetricDefinition(id);
      expect(metric.causalClaimAllowed).toBe(false);
      expect(metric.claimRestrictions).toContain('not_causal');
      expect(metric.evidenceClassification).not.toBe('causal');
    });
  });

  test('golden cases G01–G15 hold without calculating scores', () => {
    const cases = listGoldenCases();
    expect(cases.map((row) => row.caseId)).toEqual([
      'G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08',
      'G09', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15',
    ]);

    expect(getMetricDefinition('roster.pair_pass.listening_reading').temporalContractIds)
      .toContain('TC-ROSTER-LIFETIME-DEFAULT');
    expect(requestAsOf('roster.pair_pass.listening_reading').status).toBe('unsupported');
    expect(getMetricDefinition('roster.pair_pass.both_pairs').implementationStatus).toBe('not_implemented');
    expect(checkComparison(
      { metricId: 'snapshot.gse_raw_delta', temporalContractId: 'TC-EXAM-SESSION' },
      { metricId: 'roster.pair_pass.listening_reading', policyKey: 'pair-bothcefr-samedate-g24' },
    ).status).toBe('undetermined');
    expect(getMetricDefinition('bestep.file.skill_level').claimRestrictions).toContain('plus_collapsed');
    expect(getMetricDefinition('bestep.file.four_skill_cefr_b2').claimRestrictions)
      .toContain('missing_level_counts_as_fail');
    expect(getTemporalContract('TC-BESTEP-FILE-SEMESTER').limitations)
      .toContain('import_time_is_not_assessment_time');
    expect(checkComparison(
      { metricId: 'ops.reservation.checkin_row_rate' },
      { metricId: 'ops.roster.distinct_checkin_rate' },
    ).status).toBe('incompatible');

    const file = getMetricDefinition('bestep.file.four_skill_cefr_b2');
    const et = getMetricDefinition('roster.pair_pass.listening_reading');
    expect(file.sourceIds).toContain('bestep_exam_scores');
    expect(file.sourceIds).not.toContain('et_exam_attempts');
    expect(et.sourceIds).toContain('et_exam_attempts');
    expect(et.sourceIds).not.toContain('bestep_exam_scores');

    expect(claimOfficial('roster.pair_pass.listening_reading')).toEqual({
      allowed: false,
      reason: 'not_approved',
      metricId: 'roster.pair_pass.listening_reading',
    });
    expect(getMetricDefinition('roster.pair_pass.listening_reading').legacyActive).toBe(true);
    expect(claimOfficial('ops.participation.streak').reason).toBe('not_implemented');
    expect(claimOfficial('roster.pair_pass.both_pairs').allowed).toBe(false);

    const partner = getMetricDefinition('partner.score_gap');
    expect(partner.evidenceClassification).toBe('associational');
    expect(partner.causalClaimAllowed).toBe(false);

    const monitoring = { usage: 'monitoring', value: 10 };
    const frozen = { usage: 'official', value: 8 };
    expect(monitoring.value).not.toBe(frozen.value);
    expect(claimOfficial('ops.reservation.row_count').allowed).toBe(false);
  });
});
