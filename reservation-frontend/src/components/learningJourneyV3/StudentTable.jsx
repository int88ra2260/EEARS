import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const EMPTY = '—';

function renderSkill(bestSkills, key) {
  return bestSkills?.[key]?.cefr || EMPTY;
}

export default function StudentTable({
  loading,
  error,
  students,
  semesterId,
  pagination,
  onPageChange
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [jumpPage, setJumpPage] = useState('');
  const [jumpError, setJumpError] = useState('');
  const limit = Number(pagination?.limit || 20);
  const offset = Number(pagination?.offset || 0);
  const total = Number(pagination?.total || 0);
  const currentPage = Math.floor(offset / Math.max(limit, 1)) + 1;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(limit, 1)));
  const detailSearch = new URLSearchParams(location.search);
  if (semesterId) detailSearch.set('semesterId', semesterId);
  const detailQuery = detailSearch.toString() ? `?${detailSearch.toString()}` : '';
  const studentDetailUrl = (studentId) =>
    `/admin/learning-journey/students/${encodeURIComponent(studentId)}${detailQuery}`;
  const hasRows = Array.isArray(students) && students.length > 0;

  const submitJump = () => {
    const raw = String(jumpPage || '').trim();
    const n = Number(raw);
    if (!raw || !Number.isFinite(n) || !Number.isInteger(n)) {
      setJumpError('請輸入有效頁碼');
      return;
    }
    if (n < 1 || n > totalPages) {
      setJumpError(`頁碼需介於 1 到 ${totalPages}`);
      return;
    }
    setJumpError('');
    onPageChange((n - 1) * limit);
  };

  if (loading && !hasRows) {
    return (
      <div className="alert alert-light d-flex align-items-center gap-2 mb-0">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>正在載入學生清單...</span>
      </div>
    );
  }

  if (error && !hasRows) {
    return <div className="alert alert-danger mb-0">學生清單載入失敗：{error}</div>;
  }

  if (!hasRows) {
    return (
      <div>
        <div className="small text-muted mb-2">總筆數：{total}</div>
        <div className="alert alert-secondary mb-0">此條件下尚無學生資料。</div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
        <div className="small text-muted">總筆數：{total}</div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          {loading ? (
            <span className="small text-muted d-inline-flex align-items-center gap-1">
              <span className="spinner-border spinner-border-sm" aria-hidden="true" />
              更新中
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={loading || offset <= 0}
          >
            上一頁
          </button>
          <span className="small text-muted">第 {currentPage} / {totalPages} 頁</span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => onPageChange(offset + limit)}
            disabled={loading || offset + students.length >= total}
          >
            下一頁
          </button>
          <div className="d-flex align-items-center gap-1">
            <label className="small text-muted mb-0" htmlFor="lj-student-page-jump">跳至</label>
            <input
              id="lj-student-page-jump"
              type="number"
              min="1"
              max={totalPages}
              className="form-control form-control-sm"
              style={{ width: 80 }}
              value={jumpPage}
              placeholder="頁碼"
              onChange={(e) => {
                setJumpPage(e.target.value);
                if (jumpError) setJumpError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitJump();
              }}
              disabled={loading}
            />
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={submitJump} disabled={loading}>
              前往
            </button>
          </div>
        </div>
      </div>
      {jumpError ? <div className="text-danger small mb-2 text-end">{jumpError}</div> : null}
      {error ? <div className="alert alert-danger py-2 mb-2">學生清單載入失敗：{error}</div> : null}
      <div className="table-responsive">
      <table className="table table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>學號</th>
            <th>姓名</th>
            <th>年級</th>
            <th>系所</th>
            <th>聽力</th>
            <th>閱讀</th>
            <th>口說</th>
            <th>寫作</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {students.map((row) => (
            <tr
              key={row.studentId}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(studentDetailUrl(row.studentId))}
            >
              <td className="font-monospace">{row.studentId}</td>
              <td>{row.studentName || EMPTY}</td>
              <td>{row.grade || EMPTY}</td>
              <td>{row.department || EMPTY}</td>
              <td>{renderSkill(row.bestSkills, 'listening')}</td>
              <td>{renderSkill(row.bestSkills, 'reading')}</td>
              <td>{renderSkill(row.bestSkills, 'speaking')}</td>
              <td>{renderSkill(row.bestSkills, 'writing')}</td>
              <td>
                <Link
                  className="btn btn-outline-primary btn-sm"
                  to={studentDetailUrl(row.studentId)}
                  onClick={(e) => e.stopPropagation()}
                >
                  查看
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
