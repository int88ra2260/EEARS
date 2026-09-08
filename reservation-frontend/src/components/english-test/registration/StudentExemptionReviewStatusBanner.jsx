/**
 * 學生「檢視與修正」：有上傳 B2 成績時顯示抵免審核狀態（唯讀）
 */
import React from 'react';
import {
  getExemptionReviewBadgeVariant,
  hasB2ScoresFilled,
  mapExemptionReviewStatusToLabel,
  mapExemptionVerifiedTypeToZh,
} from '../../../utils/englishTestExemptionDisplay';

export default function StudentExemptionReviewStatusBanner({ registration }) {
  if (!hasB2ScoresFilled(registration)) return null;

  const status = registration.exemption_review_status || null;
  const label = mapExemptionReviewStatusToLabel(status);
  const variant = getExemptionReviewBadgeVariant(status);
  const note = registration.exemption_review_note
    ? String(registration.exemption_review_note).trim()
    : '';
  const verifiedZh = status === 'approved'
    ? mapExemptionVerifiedTypeToZh(registration.exemption_verified_type)
    : null;

  const alertClass =
    status === 'approved' ? 'alert-success'
      : status === 'rejected' ? 'alert-danger'
        : status === 'revision' ? 'alert-warning'
          : status === 'pending' ? 'alert-info'
            : 'alert-secondary';

  return (
    <div className={`alert ${alertClass} mb-4`} role="status" data-testid="student-exemption-review-status">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <strong>英檢成績／抵免審核</strong>
        <span className={`badge bg-${variant}`}>{label}</span>
      </div>
      <p className="mb-1 small">
        此狀態為中心對您上傳之 CEFR B2 成績證明的審核結果（與報名審核狀態不同）。
      </p>
      {verifiedZh != null ? (
        <p className="mb-1 small">
          <strong>核定抵免項目：</strong>
          {verifiedZh}
        </p>
      ) : null}
      {note ? (
        <p className="mb-0 small">
          <strong>審核說明：</strong>
          {note}
        </p>
      ) : null}
      {status === 'revision' ? (
        <p className="mb-0 mt-2 small fw-bold">
          請依審核說明修正成績或證明後再送出更新。
        </p>
      ) : null}
      {!status || status === '' ? (
        <p className="mb-0 small text-muted">
          成績已收到，待中心審核。審核完成後可於此查看結果。
        </p>
      ) : null}
    </div>
  );
}
