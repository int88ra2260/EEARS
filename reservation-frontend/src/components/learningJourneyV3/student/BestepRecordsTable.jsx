import React from 'react';
import { getEmptyReasonText } from './emptyStateUtils';

const EMPTY = '—';
const SKILLS = [
  ['listening', '聽力'],
  ['reading', '閱讀'],
  ['speaking', '口說'],
  ['writing', '寫作']
];

function scoreCell(row, skill) {
  const value = row.skills?.[skill] || row.score?.[skill];
  if (value && typeof value === 'object') {
    const parts = [];
    if (value.score != null) parts.push(value.score);
    if (value.cefr) parts.push(value.cefr);
    return parts.length ? parts.join(' / ') : EMPTY;
  }
  return value ?? EMPTY;
}

export default function BestepRecordsTable({ bestepRecords, emptyReason }) {
  const rows = Array.isArray(bestepRecords) ? bestepRecords : [];
  if (rows.length === 0) return <div className="alert alert-secondary mb-0">{getEmptyReasonText(emptyReason, '尚無培力英檢紀錄。')}</div>;

  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>考試日期</th>
            <th>考試類型</th>
            <th>狀態</th>
            {SKILLS.map(([, label]) => <th key={label}>{label}</th>)}
            <th>匯入來源</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.id || row.semesterId || row.examDate || 'exam'}-${idx}`}>
              <td>{row.examDate || row.semesterId || EMPTY}</td>
              <td>{row.examType || row.examScope || row.sourceType || EMPTY}</td>
              <td>{row.status || row.registrationStatus || row.attendanceStatus || EMPTY}</td>
              {SKILLS.map(([skill]) => <td key={skill}>{scoreCell(row, skill)}</td>)}
              <td>{row.sourceBatchId || row.sourceType || EMPTY}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
