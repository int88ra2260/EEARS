import React from 'react';

export default function RequestIdCopy({ value, onCopy }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span className="small">{value}</span>
      <button type="button" className="btn btn-sm btn-outline-secondary py-0" onClick={() => onCopy(value)}>
        複製
      </button>
    </span>
  );
}
