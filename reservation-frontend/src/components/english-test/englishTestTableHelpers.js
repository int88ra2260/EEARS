import React from 'react';

export const STATUS_STYLES = {
  pending: { bg: '#ffc107', color: '#856404', icon: 'clock' },
  approved: { bg: '#0dcaf0', color: '#087990', icon: 'check-circle' },
  revision: { bg: '#6f42c1', color: '#fff', icon: 'times-circle' },
  success: { bg: '#198754', color: '#fff', icon: 'check-circle' },
  failed: { bg: '#dc3545', color: '#fff', icon: 'ban' },
};

export function highlightText(text, keyword) {
  if (!keyword || !text) return text;
  const regex = new RegExp(`(${keyword})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} style={{ backgroundColor: '#ffeb3b', padding: '0' }}>
        {part}
      </mark>
    ) : part
  );
}

export function getStatusBadge(status) {
  const statusMap = {
    pending: { label: '審核中', ...STATUS_STYLES.pending },
    approved: { label: '已通過', ...STATUS_STYLES.approved },
    revision: { label: '請修正', ...STATUS_STYLES.revision },
    success: { label: '報名成功', ...STATUS_STYLES.success },
    failed: { label: '報名失敗', ...STATUS_STYLES.failed },
  };
  const info = statusMap[status] || { label: status, bg: '#6c757d', color: '#fff', icon: 'question' };
  return (
    <span
      className="badge d-flex align-items-center"
      style={{ gap: '0.25rem', backgroundColor: info.bg, color: info.color }}
    >
      <i className={`fas fa-${info.icon}`} /> {info.label}
    </span>
  );
}
