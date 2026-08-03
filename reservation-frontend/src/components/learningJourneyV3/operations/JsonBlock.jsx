import React from 'react';
import { isEmptyJson } from '../../../utils/learningJourneyOperationsHelpers';

export default function JsonBlock({ title, value }) {
  return (
    <div className="mb-3">
      <div className="fw-semibold small mb-1">{title}</div>
      {isEmptyJson(value) ? (
        <div className="text-muted small border rounded p-2">無資料</div>
      ) : (
        <pre className="small border rounded p-2 bg-light mb-0" style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
