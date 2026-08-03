import React from 'react';
import { getEmptyReasonText } from './emptyStateUtils';

const EMPTY = '—';
const SKILLS = ['listening', 'reading', 'speaking', 'writing'];

function cellText(skills, key) {
  const v = skills?.[key];
  if (!v) return EMPTY;
  return `${v.score ?? EMPTY} / ${v.cefr ?? EMPTY}`;
}

export default function ExamTimeline({ examAttempts, emptyReason }) {
  const rows = Array.isArray(examAttempts) ? examAttempts : [];
  if (!rows.length) return <div className="alert alert-secondary mb-0">{getEmptyReasonText(emptyReason, '尚無考試紀錄。')}</div>;
  return (
    <div className="table-responsive">
      <table className="table table-striped align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>日期</th>
            <th>考試類別</th>
            <th>聽力</th>
            <th>閱讀</th>
            <th>口說</th>
            <th>寫作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.examDate || EMPTY}</td>
              <td><span className="badge text-bg-light">{row.examType || EMPTY}</span></td>
              {SKILLS.map((sk) => <td key={sk}>{cellText(row.skills, sk)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
