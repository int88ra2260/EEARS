'use strict';

const { normalizeFlags } = require('./assessmentQualityFlags');

const OBSERVED_PROVENANCE = new Set([
  'stated_column',
  'et_test_date',
  'et_exam_date_fallback',
  'exam_attempts.exam_date',
  'both_date_columns_agree',
]);

function sorted(values) {
  return [...values].sort();
}

function freezeConflicts(conflicts) {
  return Object.freeze(conflicts.map((item) => Object.freeze({
    field: item.field,
    values: Object.freeze(sorted(item.values.map((value) => String(value)))),
  })).sort((a, b) => a.field.localeCompare(b.field)));
}

function sameIdentity(left, right) {
  return Boolean(left.sourceIdentity.sourceRecordId)
    && left.sourceIdentity.sourceTable === right.sourceIdentity.sourceTable
    && left.sourceIdentity.sourceRecordId === right.sourceIdentity.sourceRecordId;
}

function sameSkill(left, right) {
  return Boolean(left.result.skill) && left.result.skill === right.result.skill;
}

function sameStudent(left, right) {
  return Boolean(left.studentReference.matchKey)
    && left.studentReference.matchKey === right.studentReference.matchKey;
}

function observedDate(observation) {
  if (observation.assessment.datePrecision !== 'date') return null;
  const provenance = String(observation.assessment.dateProvenance || '');
  if (!provenance.startsWith('stated') && !OBSERVED_PROVENANCE.has(provenance)) return null;
  return observation.assessment.assessmentDate;
}

function projection(left, right) {
  let confirmed = false;
  let unverified = false;
  [[left, right], [right, left]].forEach(([one, other]) => {
    const upstream = one.sourceIdentity.upstreamSource;
    if (upstream
      && upstream.sourceTable === other.sourceIdentity.sourceTable
      && String(upstream.sourceRecordId) === String(other.sourceIdentity.sourceRecordId)) {
      confirmed = true;
    }
    if (one.qualityFlags.includes('UNVERIFIED_PROJECTION') && other.sourceIdentity.sourceTable === 'bestep_exam_scores') {
      unverified = true;
    }
  });
  return { confirmed, unverified };
}

function withNamespace(left, right, evidence) {
  const next = [...evidence];
  const a = left.sourceIdentity;
  const b = right.sourceIdentity;
  if (a.sourceRecordId && b.sourceRecordId
    && String(a.sourceRecordId) === String(b.sourceRecordId)
    && a.sourceTable !== b.sourceTable) {
    next.push('table_namespace_differs');
  }
  return next;
}

function identityResult(relationship, confidence, evidence) {
  return {
    relationship,
    confidence,
    evidence: Object.freeze(sorted(evidence)),
  };
}

function resolveIdentity(left, right) {
  if (!left || !right) {
    return identityResult('undetermined', 'none', ['missing_observation']);
  }
  if (sameIdentity(left, right) && sameSkill(left, right)) {
    return identityResult(
      'same_source_record',
      'confirmed',
      withNamespace(left, right, ['same_source_identity', 'same_skill']),
    );
  }
  if (sameIdentity(left, right) && left.result.skill && right.result.skill && left.result.skill !== right.result.skill) {
    return identityResult('distinct', 'confirmed', withNamespace(left, right, ['different_skill']));
  }
  if (sameStudent(left, right) && left.result.skill && right.result.skill && left.result.skill !== right.result.skill) {
    return identityResult('distinct', 'confirmed', withNamespace(left, right, ['different_skill']));
  }
  if (left.studentReference.matchKey && right.studentReference.matchKey && !sameStudent(left, right)) {
    return identityResult('distinct', 'confirmed', withNamespace(left, right, ['different_student']));
  }

  const link = projection(left, right);
  if (link.confirmed && sameSkill(left, right)) {
    return identityResult(
      'confirmed_projection',
      'confirmed',
      withNamespace(left, right, ['projection_link', 'same_skill']),
    );
  }
  if (!left.sourceIdentity.sourceRecordId || !right.sourceIdentity.sourceRecordId) {
    return identityResult('undetermined', 'none', withNamespace(left, right, ['unknown_source_identity']));
  }
  if (!sameStudent(left, right) || !left.result.skill || !right.result.skill) {
    return identityResult('undetermined', 'none', withNamespace(left, right, ['missing_student_or_skill']));
  }

  const leftInstrument = left.assessment.instrument;
  const rightInstrument = right.assessment.instrument;
  if (leftInstrument !== rightInstrument && leftInstrument !== 'UNKNOWN' && rightInstrument !== 'UNKNOWN') {
    return identityResult('distinct', 'confirmed', withNamespace(left, right, ['different_instrument']));
  }
  if (leftInstrument === 'UNKNOWN' || rightInstrument === 'UNKNOWN') {
    return identityResult('undetermined', 'none', withNamespace(left, right, ['unknown_instrument']));
  }

  const leftDate = observedDate(left);
  const rightDate = observedDate(right);
  if (leftDate && rightDate && leftDate !== rightDate) {
    return identityResult('distinct', 'confirmed', withNamespace(left, right, ['different_assessment_date']));
  }
  if (!leftDate || !rightDate) {
    const evidence = ['insufficient_date_precision'];
    if (link.unverified) evidence.push('unverified_projection');
    return identityResult('undetermined', 'none', withNamespace(left, right, evidence));
  }

  const evidence = ['similar_sitting'];
  if (link.unverified) evidence.push('unverified_projection');
  return identityResult('possible_same_assessment', 'candidate', withNamespace(left, right, evidence));
}

function resolveConsistency(left, right, identity) {
  if (!left || !right || identity.relationship === 'undetermined') {
    return {
      status: 'insufficient_data',
      differences: Object.freeze([]),
      comparedFields: Object.freeze([]),
    };
  }
  if (identity.relationship === 'distinct') {
    return {
      status: 'not_comparable',
      differences: Object.freeze([]),
      comparedFields: Object.freeze([]),
    };
  }
  const checks = [
    ['rawScore', left.result.rawScore, right.result.rawScore],
    ['cefrLevel', left.result.cefrLevel, right.result.cefrLevel],
  ];
  const differences = [];
  const compared = [];
  let missing = false;
  checks.forEach(([field, a, b]) => {
    if (a == null || b == null) {
      missing = true;
      return;
    }
    compared.push(field);
    if (String(a) !== String(b)) differences.push({ field, values: [a, b] });
  });
  let status = 'consistent';
  if (differences.length) status = 'conflicting';
  else if (missing) status = 'insufficient_data';
  return {
    status,
    differences: freezeConflicts(differences),
    comparedFields: Object.freeze(sorted(compared)),
  };
}

function duplicateAssessment(identity) {
  if (identity.relationship === 'possible_same_assessment') {
    return { status: 'possible', reasons: identity.evidence };
  }
  return { status: 'not_applicable', reasons: Object.freeze([]) };
}

function needsReview(identity, consistency) {
  return consistency.status === 'conflicting'
    || consistency.status === 'insufficient_data'
    || identity.relationship === 'possible_same_assessment'
    || identity.relationship === 'undetermined';
}

function compareAssessmentObservationsDetailed(left, right) {
  const identity = resolveIdentity(left, right);
  const consistency = resolveConsistency(left, right, identity);
  return Object.freeze({
    identity: Object.freeze(identity),
    consistency: Object.freeze(consistency),
    duplicateAssessment: Object.freeze(duplicateAssessment(identity)),
    requiresReview: needsReview(identity, consistency),
  });
}

function legacyRelationship(identityRelationship, consistencyStatus) {
  if (consistencyStatus === 'conflicting') return 'conflicting';
  if (identityRelationship === 'possible_same_assessment') return 'possible_duplicate';
  return identityRelationship;
}

function legacyConfidence(identityRelationship, consistencyStatus) {
  if (identityRelationship === 'undetermined') return 'none';
  if (identityRelationship === 'possible_same_assessment') {
    return consistencyStatus === 'conflicting' ? 'medium' : 'low';
  }
  return 'high';
}

function legacyFlags(identity, consistency) {
  const flags = [];
  if (consistency.status === 'conflicting') flags.push('SOURCE_CONFLICT');
  else if (identity.relationship === 'possible_same_assessment') flags.push('POSSIBLE_DUPLICATE');
  if (identity.evidence.includes('unverified_projection')) flags.push('UNVERIFIED_PROJECTION');
  if (identity.evidence.includes('different_instrument') || identity.evidence.includes('unknown_instrument')) {
    flags.push('INSTRUMENT_NOT_COMPARABLE');
  }
  if (identity.evidence.includes('unknown_source_identity')) flags.push('UNKNOWN_SOURCE_IDENTITY');
  return flags;
}

function compareAssessmentObservations(left, right) {
  const detailed = compareAssessmentObservationsDetailed(left, right);
  const reasons = [...detailed.identity.evidence];
  if (detailed.consistency.status === 'conflicting') reasons.push('result_mismatch');
  return {
    relationship: legacyRelationship(detailed.identity.relationship, detailed.consistency.status),
    confidence: legacyConfidence(detailed.identity.relationship, detailed.consistency.status),
    reasons: Object.freeze(sorted(reasons)),
    conflicts: detailed.consistency.differences,
    qualityFlags: normalizeFlags(legacyFlags(detailed.identity, detailed.consistency)),
    requiresReview: detailed.requiresReview,
    mergePerformed: false,
    sourcePriorityApplied: false,
    identity: detailed.identity,
    consistency: detailed.consistency,
    duplicateAssessment: detailed.duplicateAssessment,
  };
}

module.exports = {
  compareAssessmentObservations,
  compareAssessmentObservationsDetailed,
};
