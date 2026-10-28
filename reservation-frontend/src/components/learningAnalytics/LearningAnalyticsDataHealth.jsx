import React from 'react';
import Alert from 'react-bootstrap/Alert';
import { Link } from 'react-router-dom';

function resolveSnapshotLabel(meta, snapshotVersion) {
  const version = String(snapshotVersion || '').trim();
  if (!version) return null;
  const fromList = (meta?.snapshots || []).find(
    (s) => String(s.snapshotVersion || s.version || '') === version
  );
  if (fromList?.label) return fromList.label;
  if (meta?.recommendedSnapshot?.version === version && meta.recommendedSnapshot.label) {
    return meta.recommendedSnapshot.label;
  }
  return version;
}

/**
 * @param {{ meta?: object, error?: string, snapshotVersion?: string|null }} props
 *   snapshotVersion：目前已套用的資料版本（建議傳 appliedFilters.snapshot_version）
 */
export default function LearningAnalyticsDataHealth({ meta, error, snapshotVersion = null }) {
  if (error) {
    return <Alert variant="danger" className="mb-3">{error}</Alert>;
  }
  if (!meta) return null;

  const counts = meta.tableCounts || {};
  const warnings = (meta.warnings || []).filter((line) => line !== meta.examSnapshotStaleMessage);
  const recommended = meta.recommendedSnapshot || {};
  const recommendedStudents = recommended.studentCount;
  const recommendedExams = recommended.examCount;
  const activeVersion = String(snapshotVersion || recommended.version || meta.recommendedSnapshotVersion || '').trim();
  const activeLabel = resolveSnapshotLabel(meta, activeVersion);
  const usingRecommended = !activeVersion
    || activeVersion === String(recommended.version || meta.recommendedSnapshotVersion || '');

  const staleAlert = meta.examSnapshotStaleMessage ? (
    <Alert variant="warning" className="py-2 mb-2">
      {meta.examSnapshotStaleMessage}
      {' '}
      <Link to="/admin/learning-journey/operations">查看重建進度</Link>
    </Alert>
  ) : null;

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

  const urgentWarnings = warnings.filter((line) => !/^偵測到 |^資料庫共有 |^系統已改為/.test(line));
  const versionNotes = warnings.filter((line) => /^偵測到 |^資料庫共有 |^系統已改為/.test(line));

  return (
    <>
      {staleAlert}
      <div className="la-data-ready">
        <div>
          最新資料 {recommendedStudents ?? '—'} 人、英檢 {recommendedExams ?? '—'} 筆
          {counts.lj_student_events != null ? `、學習事件 ${counts.lj_student_events} 筆` : ''}
          {activeVersion ? (
            <>
              {' · '}
              <code className="small">{activeLabel || activeVersion}</code>
            </>
          ) : null}
          {!usingRecommended && recommended.version ? (
            <span className="text-warning ms-2">
              與建議版本不同：{recommended.label || recommended.version}
            </span>
          ) : null}
        </div>
        {urgentWarnings.length ? (
          <ul className="small mb-0 mt-1 ps-3">
            {urgentWarnings.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {versionNotes.length ? (
          <details className="la-data-more">
            <summary>資料版本說明</summary>
            <ul className="mb-0 ps-3">
              {versionNotes.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </>
  );
}
