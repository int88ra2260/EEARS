import React, { useCallback, useEffect, useState } from 'react';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import {
  getLearningJourneyOperationRuns,
  postLearningJourneyV3EwlSync,
} from '../../services/learningJourneyV3Api';

function formatTs(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('zh-TW', { hour12: false });
}

function statusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return <Badge bg="success">成功</Badge>;
  if (s === 'partial') return <Badge bg="warning" text="dark">部分成功</Badge>;
  if (s === 'failed') return <Badge bg="danger">失敗</Badge>;
  if (s === 'running') return <Badge bg="primary">執行中</Badge>;
  return <Badge bg="secondary">{status || '—'}</Badge>;
}

/**
 * EWL ReservationInfo → activity_participations 同步面板
 */
export default function EwlSyncPanel({ token, onSyncSuccess }) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState('');

  const loadRecentRuns = useCallback(async () => {
    if (!token) return;
    setRunsLoading(true);
    setRunsError('');
    try {
      const data = await getLearningJourneyOperationRuns(token, {
        operationType: 'SYNC_EWL',
        limit: 10,
        offset: 0,
      });
      setRuns(Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []));
    } catch (err) {
      setRunsError(err.message || '無法載入同步紀錄');
      setRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadRecentRuns();
  }, [loadRecentRuns]);

  const runSync = async ({ dryRun }) => {
    const start = String(startDate || '').trim();
    const end = String(endDate || '').trim();
    if ((start && !end) || (!start && end)) {
      setError('開始與結束日期需同時填寫（或皆留空使用預設區間）');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await postLearningJourneyV3EwlSync(token, {
        startDate: start || undefined,
        endDate: end || undefined,
        studentId: String(studentId || '').trim() || undefined,
        dryRun,
        confirm: !dryRun,
      });
      setResult(data);
      if (!dryRun) {
        onSyncSuccess?.(data);
        loadRecentRuns();
      }
    } catch (err) {
      setError(err.message || 'EWL 同步失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ewl-sync-panel">
      <section className="lj-import-block lj-import-block--ewl mb-4" aria-labelledby="ewl-sync-form-title">
        <div className="lj-import-block__head">
          <div className="lj-import-block__title-group">
            <span className="lj-import-block__kind">EWL</span>
            <h2 id="ewl-sync-form-title" className="lj-import-block__title">同步條件</h2>
            <p className="lj-import-block__desc">
              從英文寫作工坊 ReservationInfo／AttendanceInfo 拉取預約與簽到，寫入學習歷程活動參與（類型 EWL）。
              活動日一律取 <strong>EventDate</strong>（活動舉辦日），報名日 ReservationDate 另存、不當作活動日。
              寫入後會自動背景重建受影響學生的時間軸。日期留空則僅同步「過去 14 天～未來 60 天」；歷史資料請明確填日期區間（例如 2024-01-01～今天）。建議先預覽再寫入。
            </p>
          </div>
        </div>

        <div className="row g-3 align-items-end mb-3">
          <div className="col-sm-6 col-md-3">
            <Form.Group className="mb-0" controlId="ewl-page-start-date">
              <Form.Label className="small mb-1">開始日期</Form.Label>
              <Form.Control
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={loading}
              />
            </Form.Group>
          </div>
          <div className="col-sm-6 col-md-3">
            <Form.Group className="mb-0" controlId="ewl-page-end-date">
              <Form.Label className="small mb-1">結束日期</Form.Label>
              <Form.Control
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={loading}
              />
            </Form.Group>
          </div>
          <div className="col-sm-6 col-md-3">
            <Form.Group className="mb-0" controlId="ewl-page-student-id">
              <Form.Label className="small mb-1">學號（選填）</Form.Label>
              <Form.Control
                type="text"
                placeholder="空白＝全部學生"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={loading}
                autoComplete="off"
              />
            </Form.Group>
          </div>
          <div className="col-sm-6 col-md-3 d-flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline-secondary"
              disabled={loading}
              onClick={() => runSync({ dryRun: true })}
            >
              {loading ? '處理中…' : '預覽同步'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={loading}
              onClick={() => runSync({ dryRun: false })}
            >
              確認寫入
            </Button>
          </div>
        </div>

        {error ? (
          <Alert variant="danger" className="py-2 mb-3" role="alert">{error}</Alert>
        ) : null}

        {result ? (
          <Alert variant={result.dryRun ? 'info' : 'success'} className="py-2 mb-0">
            <div className="fw-semibold mb-1">
              {result.dryRun ? '預覽結果（尚未寫入資料庫）' : '同步完成'}
            </div>
            <div className="small">
              區間 {result.startDate}～{result.endDate}
              {result.studentId ? `；學號 ${result.studentId}` : '；全部學生'}
            </div>
            <ul className="small mb-0 mt-2 ps-3">
              <li>API 拉取：{result.fetched ?? 0} 筆（回報總數 {result.reportedTotalCount ?? '—'}）</li>
              <li>新增：{result.inserted ?? 0}</li>
              <li>更新：{result.updated ?? 0}</li>
              <li>略過：{result.skipped ?? 0}</li>
              <li>錯誤：{result.errorCount ?? 0}</li>
              <li>分頁次數：{result.pagesFetched ?? '—'}</li>
            </ul>
            {Array.isArray(result.errors) && result.errors.length > 0 ? (
              <details className="small mt-2">
                <summary>錯誤明細（前 {Math.min(result.errors.length, 20)} 筆）</summary>
                <ul className="mb-0 ps-3">
                  {result.errors.slice(0, 20).map((err, idx) => (
                    <li key={`${err.code || 'err'}-${idx}`}>
                      [{err.code || 'ERROR'}] {err.message}
                      {err.studentId ? `（${err.studentId}）` : ''}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Alert>
        ) : null}
      </section>

      <section aria-labelledby="ewl-sync-runs-title">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <h2 id="ewl-sync-runs-title" className="h5 mb-0">最近 EWL 同步紀錄</h2>
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            disabled={runsLoading}
            onClick={loadRecentRuns}
          >
            {runsLoading ? (
              <>
                <Spinner animation="border" size="sm" className="me-1" />
                重新整理
              </>
            ) : '重新整理'}
          </Button>
        </div>
        {runsError ? (
          <Alert variant="warning" className="py-2">{runsError}</Alert>
        ) : null}
        <div className="table-responsive">
          <Table hover size="sm" className="mb-0 align-middle">
            <thead>
              <tr>
                <th scope="col">時間</th>
                <th scope="col">狀態</th>
                <th scope="col">摘要</th>
                <th scope="col">執行者</th>
              </tr>
            </thead>
            <tbody>
              {runsLoading && runs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted">載入中…</td>
                </tr>
              ) : null}
              {!runsLoading && runs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted">尚無 SYNC_EWL 紀錄</td>
                </tr>
              ) : null}
              {runs.map((row) => {
                const summary = row.resultSummary || row.summaryJson || {};
                return (
                  <tr key={row.id}>
                    <td className="text-nowrap">{formatTs(row.startedAt || row.createdAt)}</td>
                    <td>{statusBadge(row.status)}</td>
                    <td className="small">
                      {summary.startDate && summary.endDate
                        ? `${summary.startDate}～${summary.endDate}`
                        : '—'}
                      {summary.fetched != null ? ` · 拉取 ${summary.fetched}` : ''}
                      {summary.inserted != null ? ` · 新增 ${summary.inserted}` : ''}
                      {summary.updated != null ? ` · 更新 ${summary.updated}` : ''}
                      {summary.dryRun === true ? ' · dry-run' : ''}
                    </td>
                    <td className="small text-nowrap">
                      {row.executedByUsername || row.executedByUserId || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </section>
    </div>
  );
}
