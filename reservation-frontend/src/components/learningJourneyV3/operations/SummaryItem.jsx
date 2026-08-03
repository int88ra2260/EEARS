import React from 'react';

export default function SummaryItem({ label, value, source, tone }) {
  const badgeClass = source === 'Import Histories fallback' ? 'text-bg-warning' : 'text-bg-light text-dark border';
  return (
    <div className="col-lg-4 col-md-6">
      <div className={`border rounded p-3 h-100 ${tone === 'danger' ? 'border-danger-subtle' : ''}`}>
        <div className="text-muted small">{label}</div>
        <div className="fw-semibold">{value || '—'}</div>
        {source ? <span className={`badge ${badgeClass} mt-2`}>{source}</span> : null}
      </div>
    </div>
  );
}
