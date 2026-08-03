import React from 'react';
import Alert from 'react-bootstrap/Alert';
import { Link } from 'react-router-dom';

export default function LearningAnalyticsDataHealth({ meta, error, userFriendly = false }) {
  if (error) {
    return <Alert variant="danger" className="mb-3">{error}</Alert>;
  }
  if (!meta) return null;

  const counts = meta.tableCounts || {};
  const warnings = meta.warnings || [];
  const recommended = meta.recommendedSnapshot || {};
  const snapshotCount = meta.snapshotVersionCount || (meta.snapshots || []).length;
  const rawStudentRows = counts.lj_analytic_students;
  const recommendedStudents = recommended.studentCount;
  const recommendedExams = recommended.examCount;
  const eventCount = counts.lj_student_events;

  return (
    <Alert variant={meta.hasAnalyticData ? 'light' : 'warning'} className="mb-3 border">
      <div className="fw-semibold mb-1">
        {meta.hasAnalyticData ? '分析資料已就緒' : '尚無可顯示的分析資料'}
      </div>
      {userFriendly ? (
        <div className="small text-muted">
          {meta.hasAnalyticData ? (
            <>
              建議使用的<strong>最新全域分析</strong>
              共
              {' '}
              <strong>{recommendedStudents ?? '—'}</strong>
              {' '}
              位學生摘要，含
              {' '}
              <strong>{recommendedExams ?? '—'}</strong>
              {' '}
              筆英檢成績。
              {recommended.label ? (
                <span className="d-block mt-1">版本：{recommended.label}</span>
              ) : null}
              {snapshotCount > 1 && rawStudentRows != null && recommendedStudents != null && rawStudentRows > recommendedStudents ? (
                <span className="d-block mt-1">
                  資料庫另有
                  {' '}
                  {snapshotCount}
                  {' '}
                  個資料版本、合計
                  {' '}
                  {rawStudentRows}
                  {' '}
                  筆摘要列（含舊版重複）。
                  系統已自動採用最新全域分析；舊版可至
                  {' '}
                  <Link to="/admin/learning-journey/operations">學習歷程維運</Link>
                  {' '}
                  清理。
                </span>
              ) : null}
              <span className="d-block mt-1">
                原始學習事件
                {' '}
                <strong>{eventCount ?? '—'}</strong>
                {' '}
                筆（重建來源，不受資料版本清理影響）。
              </span>
            </>
          ) : (
            <>
              系統尚未建立成效分析用的摘要資料。請至「英語學習歷程 → 學習歷程維運」執行「背景重建（全部）」後再回來查看。
            </>
          )}
        </div>
      ) : (
        <div className="small text-muted">
          建議版本學生 {recommendedStudents ?? '—'} 筆 ·
          建議版本英檢 {recommendedExams ?? '—'} 筆 ·
          摘要列總計 {rawStudentRows ?? '—'}（{snapshotCount} 版本）·
          事件流 {eventCount ?? '—'} 筆
          {meta.recommendedSnapshotVersion ? (
            <>
              {' '}· 建議版本：
              <code className="ms-1">{meta.recommendedSnapshotVersion.split('|')[0]}</code>
            </>
          ) : null}
        </div>
      )}
      {warnings.length ? (
        <ul className="small mb-0 mt-2 ps-3">
          {warnings.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {!meta.hasAnalyticData ? (
        <div className="small mt-2">
          {userFriendly ? (
            <Link to="/admin/learning-journey/operations">前往學習歷程維運 →</Link>
          ) : (
            <>
              請執行後端指令：
              <code className="ms-1">{meta.rebuildHint}</code>
            </>
          )}
        </div>
      ) : null}
    </Alert>
  );
}
