import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getLearningJourneyHealth,
  getLearningJourneyOperationRuns,
  rebuildLearningJourneySemester,
} from '../../services/learningJourneyV3Api';

function formatDateZhTw(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).replace(',', '');
}

function healthStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ok') return '正常';
  if (s === 'warning') return '注意';
  if (s === 'critical') return '嚴重';
  return '未知';
}

function healthStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ok') return 'text-bg-success';
  if (s === 'warning') return 'text-bg-warning';
  if (s === 'critical') return 'text-bg-danger';
  return 'text-bg-secondary';
}

function MetricTile({ label, value }) {
  return (
    <div className="col-md-3 col-sm-6">
      <div className="border rounded p-2 h-100">
        <div className="text-muted small">{label}</div>
        <div className="h5 mb-0">{Number(value || 0)}</div>
      </div>
    </div>
  );
}

function RebuildResultSummary({ result }) {
  if (!result) return null;
  const before = result.before?.summary || {};
  const after = result.after?.summary || {};
  const diff = result.diff || {};
  return (
    <div className="alert alert-success py-2">
      <div className="fw-semibold mb-1">重建完成</div>
      <div className="small">
        狀態：{healthStatusLabel(before.status)} → {healthStatusLabel(after.status)}
      </div>
      <div className="small">
        projection 人數：{Number(before.studentsWithBestSkillProjection || 0)} → {Number(after.studentsWithBestSkillProjection || 0)}
        （{Number(diff.studentsWithBestSkillProjectionDelta || 0) >= 0 ? '+' : ''}{Number(diff.studentsWithBestSkillProjectionDelta || 0)}）
      </div>
      <div className="small">requestId: {result.requestId || '—'}</div>
      <div className="small">duration: {Number(result.durationMs || 0)} ms</div>
    </div>
  );
}

/**
 * 學期資料健康檢查與 projection 重建（供資料維運／匯入中心導向頁使用）。
 */
export default function LearningJourneyDataHealthPanel({ token, semesterId, canManage }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [operationRuns, setOperationRuns] = useState([]);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildError, setRebuildError] = useState('');
  const [rebuildResult, setRebuildResult] = useState(null);
  const [latestRebuildAt, setLatestRebuildAt] = useState('');

  const latestOperationRunAt = useCallback((operationType) => {
    const row = operationRuns.find((run) => run.operationType === operationType && run.status === 'success' && run.finishedAt);
    return row?.finishedAt || '';
  }, [operationRuns]);

  const latestEnrollmentImportAt = latestOperationRunAt('IMPORT_ENROLLMENT');
  const latestEnrollmentImportSource = latestEnrollmentImportAt ? 'Operation Runs' : '';
  const latestExamImportAt = latestOperationRunAt('IMPORT_EXAM');
  const latestExamImportSource = latestExamImportAt ? 'Operation Runs' : '';
  const latestSuccessfulRebuildAt = useMemo(() => {
    const row = operationRuns.find((run) =>
      run.operationType === 'REBUILD_BEST_SKILL_PROJECTION' && run.status === 'success' && run.finishedAt
    );
    return row?.finishedAt || latestRebuildAt || '';
  }, [operationRuns, latestRebuildAt]);

  const loadHealth = useCallback(async () => {
    const sem = String(semesterId || '').trim();
    if (!sem || !token) return;
    setLoading(true);
    setError('');
    try {
      const [healthData, runsData] = await Promise.all([
        getLearningJourneyHealth(token, sem),
        getLearningJourneyOperationRuns(token, { semesterId: sem, limit: 20, offset: 0 }),
      ]);
      setHealth(healthData || null);
      setOperationRuns(Array.isArray(runsData?.items) ? runsData.items : []);
    } catch (err) {
      setHealth(null);
      setOperationRuns([]);
      const requestIdPart = err.requestId ? `（requestId: ${err.requestId}）` : '';
      setError(`${err.message || '讀取資料健康檢查失敗'}${requestIdPart}`);
    } finally {
      setLoading(false);
    }
  }, [token, semesterId]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleRebuildProjection = async () => {
    const sem = String(semesterId || '').trim();
    if (!sem || !canManage) return;
    const yes = window.confirm(
      `即將重建 ${sem} 的 Learning Journey V3 projection。\n\n` +
      '這會根據既有英檢成績重新計算四技能最佳成績 projection。\n' +
      '不會刪除原始英檢紀錄。\n' +
      '不會修改 CEFR mapping。\n' +
      '不會修改活動統計。\n' +
      '可能需要一點時間。\n\n' +
      '是否繼續？'
    );
    if (!yes) return;
    setRebuildLoading(true);
    setRebuildError('');
    setRebuildResult(null);
    try {
      const data = await rebuildLearningJourneySemester(token, sem, {
        dryRun: false,
        confirm: true,
        reason: 'MANUAL_REBUILD_FROM_OPERATIONS_HEALTH',
      });
      setRebuildResult(data || null);
      setLatestRebuildAt(data?.finishedAt || new Date().toISOString());
      await loadHealth();
    } catch (err) {
      const requestIdPart = err.requestId ? `（requestId: ${err.requestId}）` : '';
      setRebuildError(`${err.message || '重建 projection 失敗'}${requestIdPart}`);
    } finally {
      setRebuildLoading(false);
    }
  };

  const summary = health?.summary || {};
  const checks = Array.isArray(health?.checks) ? health.checks : [];
  const warnings = Array.isArray(health?.warnings) ? health.warnings : [];
  const actions = canManage && Array.isArray(health?.actions) ? health.actions : [];
  const hasRecommendedRebuild = actions.some((action) => action.key === 'REBUILD_PROJECTION' && action.recommended);

  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold d-flex justify-content-between align-items-center gap-2">
        <span>資料健康檢查</span>
        <div className="d-flex align-items-center gap-2">
          {health ? <span className={`badge ${healthStatusClass(summary.status)}`}>{healthStatusLabel(summary.status)}</span> : null}
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={loadHealth} disabled={loading}>
            重新整理
          </button>
        </div>
      </div>
      <div className="card-body">
        {loading ? <div className="text-muted">資料健康檢查載入中...</div> : null}
        {error ? <div className="alert alert-danger mb-0">{error}</div> : null}
        {!loading && !error && !health ? (
          <div className="alert alert-secondary mb-0">無法載入健康檢查資料。</div>
        ) : null}
        {!loading && !error && health ? (
          <>
            <div className="border rounded p-2 mb-3 small">
              <div className="fw-semibold mb-1">資料狀態更新時間</div>
              <div>健康檢查：{formatDateZhTw(health.generatedAt)}</div>
              <div>最近重建：{latestSuccessfulRebuildAt ? formatDateZhTw(latestSuccessfulRebuildAt) : '尚無紀錄'}</div>
              <div>最近名冊匯入：{latestEnrollmentImportAt ? `${formatDateZhTw(latestEnrollmentImportAt)}（${latestEnrollmentImportSource}）` : '尚無紀錄'}</div>
              <div>最近英檢匯入：{latestExamImportAt ? `${formatDateZhTw(latestExamImportAt)}（${latestExamImportSource}）` : '尚無紀錄'}</div>
            </div>

            <div className="row g-2 mb-3">
              <MetricTile label="名冊快照人數" value={summary.activeRosterCount} />
              <MetricTile label="最佳成績 projection 人數" value={summary.studentsWithBestSkillProjection} />
              <MetricTile label="有英檢紀錄人數" value={summary.studentsWithExamAttempts} />
              <MetricTile label="活動 canonical 人數" value={summary.studentsWithActivityParticipations} />
              <MetricTile label="fallback reservations 人數" value={summary.studentsWithReservationFallbackOnly} />
              <MetricTile label="有修課紀錄人數" value={summary.studentsWithCourseRecords} />
              <MetricTile label="有培力英檢紀錄人數" value={summary.studentsWithBestepRecords} />
            </div>

            {actions.some((action) => action.recommended) ? (
              <div className="alert alert-warning py-2">
                {actions.filter((action) => action.recommended).map((action) => (
                  <div key={action.key}>
                    <strong>{action.label}</strong>：{action.reason}
                  </div>
                ))}
              </div>
            ) : null}

            {canManage ? (
              <div className="border rounded p-3 mb-3">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <div className="fw-semibold">
                      重建學期統計
                      {hasRecommendedRebuild ? <span className="badge text-bg-warning ms-2">建議執行</span> : null}
                    </div>
                    <div className="small text-muted">
                      根據既有英檢成績重新計算四技能最佳成績 projection；不刪除原始英檢紀錄，也不修改 CEFR mapping。
                    </div>
                  </div>
                  <button
                    type="button"
                    className={hasRecommendedRebuild ? 'btn btn-warning' : 'btn btn-outline-secondary'}
                    disabled={rebuildLoading}
                    onClick={handleRebuildProjection}
                  >
                    {rebuildLoading ? '重建中...' : '重建 projection'}
                  </button>
                </div>
                {rebuildError ? <div className="alert alert-danger mt-3 mb-0">{rebuildError}</div> : null}
                <div className="mt-3">
                  <RebuildResultSummary result={rebuildResult} />
                </div>
              </div>
            ) : null}

            {warnings.length > 0 ? (
              <div className="alert alert-warning py-2">
                {warnings.map((warning, idx) => (
                  <div key={`${warning.code || 'warning'}-${idx}`}>{warning.message || warning.code}</div>
                ))}
                <Link
                  className="btn btn-sm btn-outline-warning mt-2"
                  to={`/admin/learning-journey/operations?${new URLSearchParams({
                    semesterId: semesterId || '',
                    warningsOnly: 'true',
                  }).toString()}`}
                >
                  查看 warning 操作紀錄
                </Link>
              </div>
            ) : null}

            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>檢查項目</th>
                    <th>狀態</th>
                    <th>count</th>
                    <th>fallback</th>
                    <th>說明</th>
                  </tr>
                </thead>
                <tbody>
                  {checks.map((check) => (
                    <tr key={check.key}>
                      <td>{check.label || check.key}</td>
                      <td><span className={`badge ${healthStatusClass(check.status)}`}>{healthStatusLabel(check.status)}</span></td>
                      <td>{Number(check.count || 0)}</td>
                      <td>{check.fallbackCount == null ? '—' : Number(check.fallbackCount || 0)}</td>
                      <td className="small text-muted">{check.message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
