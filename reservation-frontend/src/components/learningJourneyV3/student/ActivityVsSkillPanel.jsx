import React from 'react';
import { getEmptyReasonText } from './emptyStateUtils';

const STATUS_LABELS = {
  attended: '已簽到',
  absent: '缺席',
  cancelled: '取消',
  registered: '已預約'
};

const ABILITY_LABELS = {
  listening: '聽力',
  reading: '閱讀',
  speaking: '口說',
  writing: '寫作',
  communication: '溝通',
  career_communication: '職涯溝通'
};

export default function ActivityVsSkillPanel({ activityAbilityMapping, emptyReason }) {
  const rows = Array.isArray(activityAbilityMapping) ? activityAbilityMapping : [];
  if (rows.length === 0) {
    return <div className="alert alert-secondary mb-0">{getEmptyReasonText(emptyReason, '尚無活動與能力對照資料。')}</div>;
  }

  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>活動日期</th>
            <th>活動名稱</th>
            <th>活動類型</th>
            <th>參與狀態</th>
            <th>簽到時間</th>
            <th>能力</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.eventId || row.eventName || 'activity'}-${idx}`}>
              <td>{row.eventDate || '—'}</td>
              <td>{row.eventName || '—'}</td>
              <td>{row.activityType || row.activityTypeCode || '—'}</td>
              <td>{STATUS_LABELS[row.attendanceStatus || row.status] || row.attendanceStatus || row.status || '—'}</td>
              <td>{row.checkInTime || '—'}</td>
              <td>
                {Array.isArray(row.abilities) && row.abilities.length > 0 ? (
                  <div className="d-flex flex-wrap gap-1">
                    {row.abilities.map((ability) => (
                      <span className="badge text-bg-light border" key={ability}>
                        {ABILITY_LABELS[ability] || ability}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
