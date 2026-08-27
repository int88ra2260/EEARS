import React from 'react';
import Alert from 'react-bootstrap/Alert';
import { Link } from 'react-router-dom';

export default function LearningAnalyticsDataHealth({ meta, error }) {
  if (error) {
    return <Alert variant="danger" className="mb-3">{error}</Alert>;
  }
  if (!meta) return null;

  const counts = meta.tableCounts || {};
  const warnings = meta.warnings || [];
  const recommended = meta.recommendedSnapshot || {};
  const recommendedStudents = recommended.studentCount;
  const recommendedExams = recommended.examCount;

  if (!meta.hasAnalyticData) {
    return (
      <Alert variant="warning" className="mb-3">
        <div className="fw-semibold mb-1">尚無分析資料</div>
        <div className="small">
          請至「英語學習歷程 → 學習歷程維運」執行「背景重建（全部）」後再回來查看。
          {' '}
          <Link to="/admin/learning-journey/operations">前往維運</Link>
        </div>
      </Alert>
    );
  }

  return (
    <div className="la-data-ready">
      最新資料 {recommendedStudents ?? '—'} 人、英檢 {recommendedExams ?? '—'} 筆
      {counts.lj_student_events != null ? `、學習事件 ${counts.lj_student_events} 筆` : ''}
      {warnings.length ? (
        <ul className="small mb-0 mt-1 ps-3">
          {warnings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
