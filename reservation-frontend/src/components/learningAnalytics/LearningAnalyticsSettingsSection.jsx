import React, { useState } from 'react';
import Collapse from 'react-bootstrap/Collapse';

/**
 * 模組設定頁可收合區塊（預設收合）
 */
export default function LearningAnalyticsSettingsSection({
  title,
  lead = null,
  badge = null,
  defaultOpen = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="la-panel la-settings-section mb-3">
      <button
        type="button"
        className="la-settings-section__toggle w-100 text-start border-0 bg-transparent p-0"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="d-flex align-items-start gap-2">
          <span className="la-settings-section__chevron" aria-hidden>
            {open ? '▼' : '▶'}
          </span>
          <span className="flex-grow-1">
            <span className="d-flex flex-wrap align-items-center gap-2">
              <span className="la-panel-title mb-0">{title}</span>
              {badge ? <span className="la-tag la-tag-pastel-yellow">{badge}</span> : null}
            </span>
            {lead && !open ? (
              <p className="small text-muted la-panel-lead mb-0 mt-1">{lead}</p>
            ) : null}
          </span>
        </span>
      </button>
      <Collapse in={open}>
        <div className="la-settings-section__body">
          {lead && open ? (
            <p className="small text-muted la-panel-lead mb-3 mt-2">{lead}</p>
          ) : null}
          {children}
        </div>
      </Collapse>
    </section>
  );
}
