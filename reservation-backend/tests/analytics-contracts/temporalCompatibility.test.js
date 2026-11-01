'use strict';

const {
  buildTemporalContext,
  evaluateTemporalCompatibility,
} = require('../../analytics-contracts');

function eventContext(metricId, contractId) {
  return buildTemporalContext({
    metricId,
    temporalContractId: contractId,
    boundaries: { eventSemesterRange: { semesterId: '114-2' } },
  });
}

describe('temporal compatibility', () => {
  test('the same operational window can match without certifying the metric family', () => {
    const left = eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER');
    const right = eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER');
    const verdict = evaluateTemporalCompatibility({
      leftContext: left,
      rightContext: right,
      comparisonType: 'same_event_period',
    });
    expect(verdict.status).toBe('compatible');
    expect(verdict.scope).toBe('temporal_only');
    expect(verdict.fullAnalysisComparability).toBe('not_claimed');
  });

  test('the same window on two different metrics stays undetermined', () => {
    const verdict = evaluateTemporalCompatibility({
      leftContext: eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER'),
      rightContext: eventContext('ops.reservation.row_count', 'TC-OPS-DATE-SEMESTER'),
      comparisonType: 'same_event_period',
    });
    expect(verdict.status).toBe('undetermined');
    expect(verdict.temporalBoundariesMatch).toBe(true);
  });

  test('a full-analysis request is never promoted by a matching window', () => {
    const context = eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER');
    const verdict = evaluateTemporalCompatibility({
      leftContext: context,
      rightContext: context,
      comparisonType: 'full_analysis',
    });
    expect(verdict.status).toBe('undetermined');
    expect(verdict.fullAnalysisComparability).toBe('undetermined');
  });

  test('omitted comparison type is undetermined', () => {
    const context = eventContext('ops.event.count', 'TC-OPS-DATE-SEMESTER');
    expect(evaluateTemporalCompatibility({
      leftContext: context,
      rightContext: context,
    }).status).toBe('undetermined');
  });
});
