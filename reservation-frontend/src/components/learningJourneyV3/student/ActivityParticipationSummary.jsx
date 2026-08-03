import React from 'react';
import { getEmptyReasonText } from './emptyStateUtils';

export default function ActivityParticipationSummary({ activitySummary, activityStats, emptyReason }) {
  const rows = Array.isArray(activitySummary?.byType) ? activitySummary.byType : [];
  const stats = activityStats || {};
  const hasStats = Number(stats.totalRecords ?? stats.reservedCount ?? stats.checkedInCount ?? 0) > 0;
  if (rows.length === 0 && !hasStats) {
    return <div className="alert alert-secondary mb-0">{getEmptyReasonText(emptyReason, '尚無活動參與紀錄。')}</div>;
  }

  return (
    <>
      <div className="row g-2 mb-3">
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">已簽到</div>
            <div className="h5 mb-0">{Number(stats.checkedInCount ?? stats.signedIn ?? 0)}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">缺席</div>
            <div className="h5 mb-0">{Number(stats.absentCount ?? stats.absent ?? 0)}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">取消</div>
            <div className="h5 mb-0">{Number(stats.cancelledCount ?? stats.cancelled ?? 0)}</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="border rounded p-2">
            <div className="text-muted small">總預約</div>
            <div className="h5 mb-0">{Number(stats.totalRecords ?? stats.reservedCount ?? 0)}</div>
          </div>
        </div>
      </div>
      {rows.length > 0 ? <div className="table-responsive">
        <table className="table table-sm table-bordered align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>活動類別</th>
              <th>已簽到</th>
              <th>缺席</th>
              <th>取消</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.activityType}>
                <td>{row.activityTypeLabel || row.activityType}</td>
                <td>{Number(row.checkedInCount ?? row.signedIn ?? 0)}</td>
                <td>{Number(row.absentCount ?? row.absent ?? 0)}</td>
                <td>{Number(row.cancelledCount ?? row.cancelled ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div> : null}
    </>
  );
}
