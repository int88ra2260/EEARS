import React from 'react';
import Badge from 'react-bootstrap/Badge';

const LEVEL_STYLES = {
  high: 'success',
  medium: 'primary',
  medium_low: 'warning',
  low: 'secondary',
  descriptive_medium: 'primary',
  descriptive_low: 'secondary',
  quasi_causal_matched_medium: 'info',
  quasi_causal_matched_low: 'secondary',
  quasi_causal_weighted_medium: 'info',
  quasi_causal_weighted_low: 'secondary',
};

const LEVEL_LABELS = {
  high: '高',
  medium: '中',
  medium_low: '中低',
  low: '低',
};

export default function EvidenceQualityBadge({ level, label }) {
  const key = String(level || '').toLowerCase();
  const text = label || LEVEL_LABELS[key] || level || '—';
  const variant = LEVEL_STYLES[key] || 'light';
  return <Badge bg={variant} className="la-evidence-badge">{text}</Badge>;
}
