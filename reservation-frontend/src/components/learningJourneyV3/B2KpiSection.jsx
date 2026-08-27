import React from 'react';

const SKILLS = [
  { key: 'listening', label: '聽力' },
  { key: 'reading', label: '閱讀' },
  { key: 'speaking', label: '口說' },
  { key: 'writing', label: '寫作' },
];

function formatRate(rate) {
  const n = Number(rate);
  if (!Number.isFinite(n)) return '0.0%';
  return `${(n * 100).toFixed(1)}%`;
}

export default function B2KpiSection({ loading, report, error }) {
  if (loading) {
    return (
      <div className="alert alert-light d-flex align-items-center gap-2 mb-0">
        <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        <span>正在載入 B2 程度統計…</span>
      </div>
    );
  }

  if (error) {
    return <div className="alert alert-danger mb-0">B2 程度統計載入失敗：{error}</div>;
  }

  if (!report || !report.skills) {
    return <div className="alert alert-secondary mb-0">尚無 B2 程度統計資料。</div>;
  }

  return (
    <div className="row g-3">
      {SKILLS.map(({ key, label }) => {
        const item = report.skills?.[key] || {};
        return (
          <div className="col-lg-3 col-md-6" key={key}>
            <div className="card h-100">
              <div className="card-body">
                <div className="text-muted small">{label} B2+</div>
                <div className="h4 mb-1">{Number(item.count || 0)} 人</div>
                <div className="small text-muted">{formatRate(item.rate)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
