import React from 'react';
import { getEmptyReasonText } from './emptyStateUtils';

const EMPTY = '—';

export default function CourseRecordsTable({ courseRecords, emptyReason }) {
  const rows = Array.isArray(courseRecords) ? courseRecords : [];
  if (rows.length === 0) return <div className="alert alert-secondary mb-0">{getEmptyReasonText(emptyReason, '尚無修課紀錄。')}</div>;
  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>學期</th>
            <th>課程代碼</th>
            <th>課程名稱</th>
            <th>修課狀態</th>
            <th>成績</th>
            <th>通過狀態</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row.semesterId}-${row.courseCode}-${idx}`}>
              <td>{row.semesterId || EMPTY}</td>
              <td>{row.courseCode || EMPTY}</td>
              <td>{row.courseName || EMPTY}</td>
              <td>{row.enrollmentStatus || EMPTY}</td>
              <td>{row.finalScore || EMPTY}</td>
              <td>{row.passStatus || EMPTY}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
