import React from 'react';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

export default function MetricCard({ label, value, hint, tooltip, onClick, disabled = false }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`la-metric-card h-100${onClick ? ' la-metric-button' : ''}`}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
    >
      <div className="la-metric-label">
        {label}
        {tooltip ? (
          <OverlayTrigger placement="top" overlay={<Tooltip>{tooltip}</Tooltip>}>
            <span className="la-info-icon ms-1" aria-label="說明">ⓘ</span>
          </OverlayTrigger>
        ) : null}
      </div>
      <div className="la-metric-value">{value}</div>
      {hint ? <div className="la-metric-hint">{hint}</div> : null}
    </Tag>
  );
}
