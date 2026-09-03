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
  const warnings = meta.warnings || [];
  const recommended = meta.recommendedSnapshot || {};
  const recommendedStudents = recommended.studentCount;
  const recommendedExams = recommended.examCount;
  const activeVersion = String(snapshotVersion || recommended.version || meta.recommendedSnapshotVersion || '').trim();
  const activeLabel = resolveSnapshotLabel(meta, activeVersion);
  const usingRecommended = !activeVersion
    || activeVersion === String(recommended.version || meta.recommendedSnapshotVersion || '');

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
      <div>
        最新資料 {recommendedStudents ?? '—'} 人、英檢 {recommendedExams ?? '—'} 筆
        {counts.lj_student_events != null ? `、學習事件 ${counts.lj_student_events} 筆` : ''}
      </div>
      {activeVersion ? (
        <div className="small mt-1">
          <span className="text-muted">目前資料版本：</span>
          <code className="small">{activeLabel || activeVersion}</code>
          {!usingRecommended && recommended.version ? (
            <span className="text-warning ms-2">
              （與建議版本不同：{recommended.label || recommended.version}）
            </span>
          ) : null}
          {(meta.snapshotVersionCount || 0) > 1 ? (
            <span className="text-muted ms-2">共 {meta.snapshotVersionCount} 個版本，可於篩選區切換</span>
          ) : null}
        </div>
      ) : null}
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
