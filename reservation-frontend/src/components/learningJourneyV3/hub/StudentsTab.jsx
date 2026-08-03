import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  EMPTY,
  SKILL_KEYS,
  SKILL_LABELS,
} from '../../../utils/learningJourneyHubFormatters';
import { EmptyState, ErrorState, LoadingState } from './HubUi';

export default function StudentsTab({ state, filters, onFilterChange, onQuery, onPage }) {
  const navigate = useNavigate();
  const { loading, error, requestId, rows, pagination, semesterId, dataSource } = state;
  const pageSize = Number(pagination.limit || filters.limit || 50);
  const pageOffset = Number(pagination.offset || filters.offset || 0);

  return (
    <div>
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <label className="form-label small">關鍵字</label>
              <input className="form-control" value={filters.keyword} onChange={(e) => onFilterChange({ keyword: e.target.value })} placeholder="學號、姓名或系所" />
            </div>
            <div className="col-md-2">
              <label className="form-label small">年級</label>
              <input className="form-control" value={filters.grade} onChange={(e) => onFilterChange({ grade: e.target.value })} />
            </div>
            <div className="col-md-3">
              <label className="form-label small">系所</label>
              <input className="form-control" value={filters.department} onChange={(e) => onFilterChange({ department: e.target.value })} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">技能</label>
              <select className="form-select" value={filters.skill} onChange={(e) => onFilterChange({ skill: e.target.value })}>
                <option value="">全部</option>
                {SKILL_KEYS.map((skill) => <option key={skill} value={skill}>{SKILL_LABELS[skill]}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small">B2+</label>
              <select className="form-select" value={filters.b2Plus} onChange={(e) => onFilterChange({ b2Plus: e.target.value })}>
                <option value="">全部</option>
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            </div>
            <div className="col-md-2">
              <button type="button" className="btn btn-primary w-100" disabled={loading || !semesterId} onClick={() => onQuery({ offset: 0 })}>
                查詢學生名單
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? <LoadingState>正在載入學生名單...</LoadingState> : null}
      {error ? <ErrorState message={error} requestId={requestId} /> : null}
      {!loading && !error && rows.length === 0 ? <EmptyState>此區塊尚未串接完整資料，請先使用學生查詢或學期總覽。</EmptyState> : null}

      {!loading && rows.length > 0 ? (
        <>
          {dataSource ? (
            <div className="mb-2">
              <span className="badge bg-info text-dark">
                資料來源狀態：{String(dataSource).includes('learning_journey') ? '學習歷程資料' : '英檢資料'}
              </span>
            </div>
          ) : null}
          <div className="table-responsive">
            <table className="table table-striped table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>學號</th><th>姓名</th><th>年級</th><th>系所</th>
                  <th>聽力</th><th>閱讀</th><th>口說</th><th>寫作</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.studentId}
                    onClick={() => navigate(`/admin/learning-journey/students/${encodeURIComponent(row.studentId)}?semesterId=${encodeURIComponent(semesterId || '')}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="font-monospace">{row.studentId}</td>
                    <td>{row.studentName || EMPTY}</td>
                    <td>{row.grade || EMPTY}</td>
                    <td>{row.department || EMPTY}</td>
                    <td>{row.bestListeningCefr || EMPTY}</td>
                    <td>{row.bestReadingCefr || EMPTY}</td>
                    <td>{row.bestSpeakingCefr || EMPTY}</td>
                    <td>{row.bestWritingCefr || EMPTY}</td>
                    <td>
                      <Link
                        className="btn btn-sm btn-outline-primary"
                        to={`/admin/learning-journey/students/${encodeURIComponent(row.studentId)}?semesterId=${encodeURIComponent(semesterId || '')}`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
            <div className="small text-muted">
              每頁 {pageSize} 筆；目前回傳 {pagination.returned || rows.length} 筆
            </div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={loading || pageOffset <= 0} onClick={() => onPage(Math.max(0, pageOffset - pageSize))}>
                上一頁
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={loading || Number(pagination.returned || 0) < pageSize} onClick={() => onPage(pageOffset + pageSize)}>
                下一頁
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
