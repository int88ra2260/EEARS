import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import {
  deleteLearningJourneyV3ImportHistory,
  getLearningJourneyV3ImportHistories,
} from '../../services/learningJourneyV3Api';
import { SEMESTER_OPTIONS } from '../../utils/semesterUtils';

const DETAIL_PREVIEW_LIMIT = 20;

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

function importStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return '成功';
  if (s === 'failed') return '失敗';
  if (s === 'partial') return '部分成功';
  if (s === 'rolled_back') return '已回滾';
  if (s === 'processing') return '處理中';
  return status || '—';
}

function importStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return 'lj-import-history-status--success';
  if (s === 'failed') return 'lj-import-history-status--failed';
  if (s === 'partial') return 'lj-import-history-status--partial';
  if (s === 'rolled_back' || s === 'processing') return 'lj-import-history-status--rolled_back';
  return 'lj-import-history-status--processing';
}

function rollbackConfirmMessage(row) {
  const type = row.type || (row.importType === 'external_exam' ? 'exam' : row.importType === 'baseline_gsat' ? 'baseline' : 'roster');
  if (type === 'exam') {
    return '此操作會軟排除此批考試匯入資料（標記 excluded），並重新計算該學期學生最佳成績。是否繼續？';
  }
  if (type === 'baseline') {
    return '此操作會軟排除此批學測 baseline 事件，並重建相關 analytic。是否繼續？';
  }
  return '此操作會停用此批名冊匯入快照（isActive=false），並重建相關 analytic。是否繼續？';
}

function rowTypeLabel(row) {
  return row.typeLabel
    || (row.importType === 'enrollment' ? '名冊匯入' : row.importType === 'baseline_gsat' ? '學測 baseline' : '考試匯入');
}

function DetailList({ items }) {
  const rows = Array.isArray(items) ? items : [];
  const [expanded, setExpanded] = useState(false);
  if (!rows.length) return <div className="text-muted small">無</div>;
  const visibleRows = expanded ? rows : rows.slice(0, DETAIL_PREVIEW_LIMIT);
  return (
    <div className="small">
      {rows.length > DETAIL_PREVIEW_LIMIT ? (
        <div className="text-muted mb-1">共 {rows.length} 筆，目前顯示前 {DETAIL_PREVIEW_LIMIT} 筆</div>
      ) : null}
      <ul className="mb-1 ps-3">
        {visibleRows.map((x, i) => (
          <li key={`${i}-${typeof x === 'string' ? x : JSON.stringify(x)}`}>
            {typeof x === 'string' ? x : JSON.stringify(x)}
          </li>
        ))}
      </ul>
      {rows.length > DETAIL_PREVIEW_LIMIT ? (
        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setExpanded((v) => !v)}>
          {expanded ? '收合' : '展開全部'}
        </button>
      ) : null}
    </div>
  );
}

/**
 * 學習歷程 V3 匯入批次紀錄（含刪除），供匯入頁維運使用。
 * @param {{ token: string, semesterId: string, onSemesterChange?: (sem: string) => void, canManage: boolean }} props
 */
export default function LearningJourneyImportHistoryPanel({
  token,
  semesterId,
  onSemesterChange,
  canManage,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [deletingHistoryId, setDeletingHistoryId] = useState(null);

  const loadHistories = useCallback(async () => {
    const sem = String(semesterId || '').trim();
    if (!sem || !token) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getLearningJourneyV3ImportHistories(token, sem, 20);
      setRows(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setRows([]);
      setError(err.message || '讀取匯入紀錄失敗');
    } finally {
      setLoading(false);
    }
  }, [token, semesterId]);

  useEffect(() => {
    loadHistories();
  }, [loadHistories]);

  const handleRollbackImportHistory = async (row) => {
    if (!row?.id || !canManage) return;
    if (String(row.status || '').toLowerCase() === 'rolled_back') return;
    const type = row.type || (row.importType === 'external_exam' ? 'exam' : row.importType === 'baseline_gsat' ? 'baseline' : 'roster');
    const typeLabel = rowTypeLabel(row);
    const yes = window.confirm(
      `${rollbackConfirmMessage(row)}\n類型：${typeLabel}\n檔名：${row.sourceFile || row.fileName || row.id}`,
    );
    if (!yes) return;
    setDeletingHistoryId(row.id);
    setError('');
    try {
      await deleteLearningJourneyV3ImportHistory(token, row.id, { type });
      await loadHistories();
    } catch (err) {
      const requestIdPart = err.requestId ? `（requestId: ${err.requestId}）` : '';
      setError(`${err.message || '回滾匯入紀錄失敗'}${requestIdPart}`);
    } finally {
      setDeletingHistoryId(null);
    }
  };

  return (
    <section
      className="lj-import-history lj-import-reveal"
      style={{ '--reveal-delay': '200ms' }}
      aria-labelledby="lj-import-history-title"
    >
      <div className="lj-import-history__header">
        <h2 id="lj-import-history-title" className="lj-import-history__title">匯入批次紀錄</h2>
        <div className="lj-import-history__controls">
          <Form.Group className="lj-import-history__semester mb-0">
            <Form.Label htmlFor="lj-history-semester">學期</Form.Label>
            <Form.Select
              id="lj-history-semester"
              size="sm"
              value={semesterId}
              onChange={(e) => onSemesterChange?.(e.target.value)}
            >
              {SEMESTER_OPTIONS.filter((o) => o.value).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Form.Select>
          </Form.Group>
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={loadHistories}
            disabled={loading}
          >
            重新整理
          </Button>
        </div>
      </div>

      <div className="lj-import-history__body">
        <p className="lj-import-history__hint">
          跨模組只讀查詢請至{' '}
          <Link to="/admin/import-center/runs">匯入紀錄中心</Link>
          ；此處可回滾本學期名冊／考試匯入批次（軟排除，不物理刪除）。學測 baseline 為全校範圍，亦會顯示於此。
        </p>

        {loading ? <div className="lj-import-history__loading">載入中…</div> : null}
        {error ? <div className="lj-import-error-inline" role="alert">{error}</div> : null}

        {!loading && !error && rows.length === 0 ? (
          <div className="lj-import-history__empty">此學期尚無匯入紀錄。</div>
        ) : null}

        {!loading && rows.length > 0 ? (
          <>
            <div className="lj-import-history-table-wrap table-responsive">
              <table className="table table-sm align-middle lj-import-history-table mb-0">
                <thead>
                  <tr>
                    <th>匯入時間</th>
                    <th>類型</th>
                    <th>檔名</th>
                    <th>狀態</th>
                    <th>寫入</th>
                    <th>略過</th>
                    {canManage ? <th>操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateZhTw(row.importedAt)}</td>
                      <td>{rowTypeLabel(row)}</td>
                      <td style={{ maxWidth: '14rem', wordBreak: 'break-word' }}>
                        {row.sourceFile || row.fileName || '—'}
                      </td>
                      <td>
                        <span className={`lj-import-history-status ${importStatusClass(row.status)}`}>
                          {importStatusLabel(row.status)}
                        </span>
                      </td>
                      <td>{row.inserted ?? '—'}</td>
                      <td>{row.skipped ?? '—'}</td>
                      {canManage ? (
                        <td>
                          <Button
                            type="button"
                            variant="outline-secondary"
                            size="sm"
                            disabled={
                              deletingHistoryId === row.id
                              || String(row.status || '').toLowerCase() === 'rolled_back'
                            }
                            onClick={() => handleRollbackImportHistory(row)}
                          >
                            {String(row.status || '').toLowerCase() === 'rolled_back'
                              ? '已回滾'
                              : (deletingHistoryId === row.id ? '回滾中…' : '回滾')}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lj-import-history-cards">
              {rows.map((row) => (
                <article key={`card-${row.id}`} className="lj-import-history-card">
                  <div className="lj-import-history-card__header">
                    <span className="lj-import-history-card__type">{rowTypeLabel(row)}</span>
                    <span className={`lj-import-history-status ${importStatusClass(row.status)}`}>
                      {importStatusLabel(row.status)}
                    </span>
                  </div>
                  <div className="lj-import-history-card__time">{formatDateZhTw(row.importedAt)}</div>
                  <dl className="lj-import-history-card__grid">
                    <dt>檔名</dt>
                    <dd>{row.sourceFile || row.fileName || '—'}</dd>
                    <dt>寫入</dt>
                    <dd>{row.inserted ?? '—'}</dd>
                    <dt>略過</dt>
                    <dd>{row.skipped ?? '—'}</dd>
                  </dl>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="outline-secondary"
                      size="sm"
                      className="w-100"
                      disabled={
                        deletingHistoryId === row.id
                        || String(row.status || '').toLowerCase() === 'rolled_back'
                      }
                      onClick={() => handleRollbackImportHistory(row)}
                    >
                      {String(row.status || '').toLowerCase() === 'rolled_back'
                        ? '已回滾'
                        : (deletingHistoryId === row.id ? '回滾中…' : '回滾')}
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="lj-import-history-details">
              {rows.map((row) => (
                <details key={`detail-${row.id}`} className="lj-import-history-details__item">
                  <summary>明細：{row.sourceFile || row.id}</summary>
                  <div className="lj-import-history-details__body">
                    <div className="lj-import-history-details__section">
                      <strong>warnings</strong>
                      <DetailList items={row.details?.warnings} />
                    </div>
                    <div className="lj-import-history-details__section">
                      <strong>conflicts</strong>
                      <DetailList items={(row.details?.conflicts || []).concat(row.details?.quarantine || [])} />
                    </div>
                    <div className="lj-import-history-details__section mb-0">
                      <strong>skipped</strong>
                      <DetailList items={row.details?.skipped} />
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
