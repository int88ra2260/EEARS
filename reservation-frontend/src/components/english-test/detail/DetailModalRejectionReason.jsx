import React from 'react';
import { getRejectionReasonText } from '../../../constants/englishTestRejectionReasons';

function ReasonList({ reasons }) {
  if (Array.isArray(reasons)) {
    return reasons.map((reason, index) => {
      const reasonText = getRejectionReasonText(reason);
      return (
        <li key={index}>
          {reasonText}
          {reason !== '其他' && reasonText === reason && (
            <span className="text-muted ms-2">({reason})</span>
          )}
        </li>
      );
    });
  }

  return (
    <li>
      {getRejectionReasonText(reasons)}
      {reasons !== '其他' && getRejectionReasonText(reasons) === reasons && (
        <span className="text-muted ms-2">({reasons})</span>
      )}
    </li>
  );
}

export default function DetailModalRejectionReason({ registration, variant = 'alert' }) {
  if (registration.status !== 'revision' && registration.status !== 'failed') {
    return null;
  }

  const alertClass = registration.status === 'revision' ? 'alert-warning' : 'alert-danger';
  const title = registration.status === 'revision' ? '請修正原因' : '報名失敗原因';
  const icon = registration.status === 'revision' ? 'exclamation-triangle' : 'times-circle';

  const body = (
    <>
      <h6 className="mb-2">
        <i className={`fas fa-${icon} me-2`}></i>
        {title}
      </h6>
      {registration.rejectionReasons && (
        <div className="mb-2">
          <strong>原因：</strong>
          <ul className="mb-0 mt-2">
            <ReasonList reasons={registration.rejectionReasons} />
          </ul>
        </div>
      )}
      {registration.rejectionOther && (
        <div className="mb-0">
          <strong>其他說明：</strong> {registration.rejectionOther}
        </div>
      )}
      {!registration.rejectionReasons && !registration.rejectionOther && (
        <div className="text-muted">無詳細說明</div>
      )}
    </>
  );

  if (variant === 'block') {
    return (
      <div className="mt-3 pt-3 border-top">
        <div className={`alert ${alertClass} mb-0`}>{body}</div>
      </div>
    );
  }

  return (
    <div className="row mt-3">
      <div className="col-12">
        <div className={`alert ${alertClass}`}>{body}</div>
      </div>
    </div>
  );
}
