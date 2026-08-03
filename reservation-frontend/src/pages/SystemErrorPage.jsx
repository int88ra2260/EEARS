import React from 'react';
import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

export default function SystemErrorPage({ requestId = null }) {
  const rid = requestId ? String(requestId) : null;

  return (
    <div className="container py-5">
      <div className="alert alert-danger" role="alert">
        <h4 className="alert-heading">系統暫時發生錯誤</h4>
        <p className="mb-0">請稍後再試，或透過下方方式聯絡我們。</p>
      </div>

      {rid ? (
        <div className="alert alert-warning">
          <div className="fw-semibold">錯誤識別碼：{rid}</div>
          <div className="small text-muted mt-1">你可以提供此識別碼給系統管理員以便追查。</div>
        </div>
      ) : (
        <div className="text-muted small mb-3">若你需要協助，請告知發生時間與操作內容。</div>
      )}

      <div className="d-flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            window.location.href = '/';
          }}
        >
          返回首頁
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            window.location.reload();
          }}
        >
          重新整理
        </Button>
        <Link to="/about#contact" className="btn btn-outline-primary">
          聯絡我們
        </Link>
        <Link
          to={rid ? `/admin/logs?requestId=${encodeURIComponent(rid)}` : '/admin/logs'}
          className="btn btn-outline-secondary"
        >
          查看操作紀錄{rid ? '（帶 requestId）' : ''}
        </Link>
      </div>
    </div>
  );
}

