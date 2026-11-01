'use strict';

const { getMetricDefinition } = require('./metricRegistry');
const { checkComparison } = require('./contractValidator');

const STATUSES = new Set(['compatible', 'incompatible', 'undetermined', 'unsupported']);

function result(status, reason, extra) {
  if (!STATUSES.has(status)) {
    throw new Error(`未知的相容狀態：${status}`);
  }
  return {
    status,
    reason,
    scope: 'temporal_only',
    fullAnalysisComparability: 'not_claimed',
    ...extra,
  };
}

function sameWindow(left, right) {
  const a = left.boundaries.eventSemesterRange;
  const b = right.boundaries.eventSemesterRange;
  if (!a || !b) return false;
  return a.startInclusive === b.startInclusive && a.endExclusive === b.endExclusive;
}

/**
 * 只判斷時間。時間一致不會讓母體、工具、政策或達標口徑變成可比。
 * comparisonType 省略時不猜，回 undetermined。
 */
function evaluateTemporalCompatibility(input) {
  const left = input && input.leftContext;
  const right = input && input.rightContext;
  const comparisonType = input && input.comparisonType;
  if (!left || !right || left.validationStatus !== 'valid' || right.validationStatus !== 'valid') {
    return result('unsupported', 'context_not_validated', { comparisonType: comparisonType || null });
  }
  if (!comparisonType) {
    return result('undetermined', 'comparison_type_required', { comparisonType: null });
  }

  if (comparisonType === 'historical_as_of') {
    return result('unsupported', 'asof_query_unsupported', {
      comparisonType,
      temporalBoundariesMatch: false,
    });
  }

  if (comparisonType === 'full_analysis' || comparisonType === 'cefr_label') {
    return result('undetermined', 'time_match_is_not_full_comparability', {
      comparisonType,
      temporalBoundariesMatch: left.temporalContractId === right.temporalContractId && sameWindow(left, right),
      fullAnalysisComparability: 'undetermined',
    });
  }

  if (comparisonType === 'assessment_precision') {
    const weak = [left.precision.assessment, right.precision.assessment]
      .some((item) => item === 'semester' || item === 'unknown');
    if (weak) {
      return result('undetermined', 'insufficient_time_precision', {
        comparisonType,
        temporalBoundariesMatch: false,
      });
    }
    return result('undetermined', 'assessment_dates_do_not_prove_metric_compatibility', {
      comparisonType,
      temporalBoundariesMatch: left.boundaries.assessmentDate
        && right.boundaries.assessmentDate
        && left.boundaries.assessmentDate.value === right.boundaries.assessmentDate.value,
    });
  }

  const metricNote = checkComparison(
    { metricId: left.metricId, policyKey: left.boundaries.policyKey && left.boundaries.policyKey.value, temporalContractId: left.temporalContractId },
    { metricId: right.metricId, policyKey: right.boundaries.policyKey && right.boundaries.policyKey.value, temporalContractId: right.temporalContractId },
  );

  if (comparisonType === 'policy_window') {
    const leftMetric = getMetricDefinition(left.metricId);
    const rightMetric = getMetricDefinition(right.metricId);
    const pending = leftMetric.governanceStatus === 'pending_decision'
      || rightMetric.governanceStatus === 'pending_decision'
      || leftMetric.decisionGateIds.length > 0
      || rightMetric.decisionGateIds.length > 0;
    if (pending || metricNote.status !== 'compatible') {
      return result('undetermined', pending ? 'policy_not_approved' : metricNote.reason, {
        comparisonType,
        temporalBoundariesMatch: left.temporalContractId === right.temporalContractId
          && left.boundaries.rosterSemester
          && right.boundaries.rosterSemester
          && left.boundaries.rosterSemester.semesterId === right.boundaries.rosterSemester.semesterId,
        metricNote: metricNote.status,
      });
    }
    return result('undetermined', 'no_approved_policy_window', { comparisonType });
  }

  if (comparisonType === 'same_event_period') {
    if (left.temporalContractId !== right.temporalContractId) {
      return result('incompatible', 'temporal_contract', {
        comparisonType,
        temporalBoundariesMatch: false,
        metricNote: metricNote.status,
      });
    }
    if (left.comparisonMode !== right.comparisonMode) {
      return result('incompatible', 'comparison_mode', { comparisonType, temporalBoundariesMatch: false });
    }
    const windowsMatch = sameWindow(left, right);
    if (!windowsMatch) {
      return result('undetermined', 'event_window_differs_or_missing', {
        comparisonType,
        temporalBoundariesMatch: false,
      });
    }
    if (left.metricId !== right.metricId) {
      return result('undetermined', 'same_window_different_metric', {
        comparisonType,
        temporalBoundariesMatch: true,
        metricNote: metricNote.status,
      });
    }
    const metric = getMetricDefinition(left.metricId);
    if (metric.decisionGateIds.length > 0 || metric.governanceStatus === 'pending_decision') {
      return result('undetermined', 'policy_not_approved', {
        comparisonType,
        temporalBoundariesMatch: true,
      });
    }
    if (left.contextType !== 'event_period') {
      return result('undetermined', 'not_an_event_period', { comparisonType, temporalBoundariesMatch: true });
    }
    return result('compatible', 'same_event_window', {
      comparisonType,
      temporalBoundariesMatch: true,
    });
  }

  return result('undetermined', 'unknown_comparison_type', { comparisonType });
}

module.exports = {
  evaluateTemporalCompatibility,
};
