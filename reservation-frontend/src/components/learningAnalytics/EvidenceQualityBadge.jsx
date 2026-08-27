import React from 'react';
import Badge from 'react-bootstrap/Badge';
import { EVIDENCE_LEVEL_LABELS } from './learningAnalyticsCopy';

const LEVEL_STYLES = {
  high: 'success',
  medium: 'primary',
  medium_low: 'warning',
  low: 'secondary',
  descriptive_medium: 'primary',
  descriptive_low: 'secondary',
  quasi_causal_matched_medium: 'info',
  quasi_causal_matched_low: 'secondary',
  quasi_causal_observational_medium: 'info',
  quasi_causal_observational_low: 'secondary',
  quasi_causal_weighted_medium: 'info',
  quasi_causal_weighted_low: 'secondary',
};

export default function EvidenceQualityBadge({ level, label }) {
  const key = String(level || '').toLowerCase();
  const text = label || EVIDENCE_LEVEL_LABELS[key] || '—';
  const variant = LEVEL_STYLES[key] || 'light';
  return <Badge bg={variant} className="la-evidence-badge">{text}</Badge>;
}
