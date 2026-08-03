import React from 'react';
import { getStatusText } from './detailModalUtils';

export default function DetailModalStatusBadge({ registration }) {
  const statusText = getStatusText(registration.status);

  return (
    <>
      {registration.status === 'success' && registration.successSequence && (
        <span className="badge bg-info" title="報名成功序號">
          序號：{registration.successSequence}
        </span>
      )}
      <span className={`badge bg-${statusText.class}`}>{statusText.text}</span>
    </>
  );
}
