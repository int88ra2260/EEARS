import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import {
  getLearningAnalyticsMeta,
  postPruneAnalyticsSnapshots,
} from '../../../services/learningAnalyticsService';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-TW', { hour12: false });
}

export default function AnalyticsSnapshotGovernanceCard({ token, canManage }) {
  const [loading, setLoading] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState(null);
  const [pruneResult, setPruneResult] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await getLearningAnalyticsMeta(token);
      setMeta(data || null);
    } catch (err) {
      setMeta(null);
      setError(err.message || '讀取成效分析資料版本失敗');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrune = async (dryRun) => {
    if (!token || !canManage) return;
    if (!dryRun) {
      const ok = window.confirm(
        '將刪除除「最新全域分析」以外的舊資料版本（含課程匯入、學期重建版）。\n'
        + '刪除後無法復原，請確認已完成全域重建且數字正確。\n\n確定要清理嗎？'
      );
      if (!ok) return;
    }
    setPruning(true);
    setError('');
    setPruneResult(null);
    try {
      const data = await postPruneAnalyticsSnapshots(token, { dryRun, keepGlobalCount: 1 });
      setPruneResult(data);
      if (!dryRun) await load();
    } catch (err) {
      setError(err.message || '清理失敗');
    } finally {
      setPruning(false);
    }
  };

  const recommended = meta?.recommendedSnapshot;
  const snapshots = meta?.snapshots || [];
  const snapshotCount = meta?.snapshotVersionCount || snapshots.length;
  const rawRows = meta?.tableCounts?.lj_analytic_students;

  return (
    <div className="card mb-3">
      <div className="card-header fw-semibold d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span>成效分析資料版本</span>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading || pruning}>
          重新整理
        </button>
      </div>
      <div className="card-body">
        <div className="alert alert-secondary small mb-3">
          <div className="fw-semibold mb-1">什麼是「資料版本」？</div>
          <ul className="mb-0 ps-3">
            <li>每次執行「背景重建」會產生一版分析摘要（學生／英檢彙總），版本字串含 <code>global-</code>、<code>course-import-</code>、學期代碼等。</li>
            <li>日常查圖表請只用<strong>最新全域分析</strong>；課程匯入或學期重建產生的過渡版本可清理。</li>
            <li>清理只刪 <code>lj_analytic_students</code>／<code>lj_analytic_exams</code> 的舊版列，不會刪原始學習事件（<code>lj_student_events</code>）。</li>
            <li>CLI：<code>npm run lj:prune-analytics-snapshots:dry</code>（預覽）／<code>npm run lj:prune-analytics-snapshots:apply</code>（實際刪除）。</li>
          </ul>
        </div>

        {loading ? <div className="text-muted small">載入中…</div> : null}
        {error ? <Alert variant="danger" className="py-2 small">{error}</Alert> : null}

        {!loading && meta ? (
          <>
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <div className="border rounded p-2 h-100 bg-light">
                  <div className="small text-muted">建議使用（最新全域分析）</div>
                  <div className="fs-5 fw-semibold">{recommended?.studentCount ?? '—'} 位學生</div>
                  <div className="small text-muted">
                    {recommended?.examCount ?? '—'} 筆英檢摘要
                    {recommended?.label ? ` · ${recommended.label}` : ''}
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">資料庫摘要列總數</div>
                  <div className="fs-5 fw-semibold">{rawRows ?? '—'}</div>
                  <div className="small text-muted">
                    {snapshotCount > 1
                      ? `含 ${snapshotCount} 個版本重複累加，勿與上方學生數直接比較`
                      : '目前僅一個資料版本'}
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="border rounded p-2 h-100">
                  <div className="small text-muted">原始學習事件</div>
                  <div className="fs-5 fw-semibold">{meta.tableCounts?.lj_student_events ?? '—'}</div>
                  <div className="small text-muted">重建來源，清理快照不會刪除</div>
                </div>
              </div>
            </div>

            {snapshots.length ? (
              <div className="table-responsive mb-3">
                <table className="table table-sm align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>資料版本</th>
                      <th className="text-end">學生摘要列</th>
                      <th>重建時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((row) => (
                      <tr
                        key={row.snapshotVersion}
                        className={row.snapshotVersion === recommended?.version ? 'table-primary' : undefined}
                      >
                        <td className="small">{row.label || row.snapshotVersion}</td>
                        <td className="text-end">{row.studentCount}</td>
                        <td className="small text-muted">{formatDate(row.derivedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {canManage ? (
              <div className="d-flex flex-wrap gap-2">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={pruning || snapshotCount <= 1}
                  onClick={() => handlePrune(true)}
                >
                  {pruning ? '處理中…' : '預覽清理（dry-run）'}
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  disabled={pruning || snapshotCount <= 1}
                  onClick={() => handlePrune(false)}
                >
                  清理舊版本（保留最新全域分析）
                </Button>
              </div>
            ) : (
              <div className="small text-muted">清理舊版本需「管理英語學習歷程」權限。</div>
            )}

            {pruneResult ? (
              <Alert variant={pruneResult.result?.dryRun ? 'info' : 'success'} className="small mt-3 mb-0">
                <div>{pruneResult.result?.message}</div>
                {pruneResult.deleteVersions?.length ? (
                  <div className="mt-1">
                    將刪除版本：
                    {' '}
                    {pruneResult.deleteVersions.map((v) => v.split('|')[0]).join('、')}
                    {' '}
                    （學生列 {pruneResult.deleteCounts?.students ?? 0}、英檢列 {pruneResult.deleteCounts?.exams ?? 0}）
                  </div>
                ) : null}
                {pruneResult.keepVersions?.length ? (
                  <div className="mt-1 text-muted">
                    保留：
                    {pruneResult.keepVersions.map((v) => v.split('|')[0]).join('、')}
                  </div>
                ) : null}
              </Alert>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
