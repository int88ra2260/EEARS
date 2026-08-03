import React from 'react';
import { EMPTY } from '../../../utils/learningJourneyHubFormatters';

export function ErrorState({ message, requestId }) {
  return (
    <div className="alert alert-danger mb-0">
      <div className="fw-semibold mb-1">資料取得失敗</div>
      <div>{message || '系統暫時無法取得資料，請稍後再試或聯絡管理員。'}</div>
      {requestId ? <div className="small mt-1">錯誤識別碼：{requestId}</div> : null}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <div className="card border-0 bg-light">
      <div className="card-body text-muted">{children}</div>
    </div>
  );
}

export function LoadingState({ children = '正在載入學習歷程資料...' }) {
  return (
    <div className="card border-0 bg-light">
      <div className="card-body d-flex align-items-center gap-2 text-muted">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>{children}</span>
      </div>
    </div>
  );
}

export function KpiCard({ label, value, hint }) {
  return (
    <div className="col-md-3 col-sm-6">
      <div className="card h-100">
        <div className="card-body">
          <div className="text-muted small">{label}</div>
          <div className="h4 mb-0">{value ?? EMPTY}</div>
          {hint ? <div className="small text-muted mt-1">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
}
