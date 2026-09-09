import React from 'react';
import AppIcon from './AppIcon';

/**
 * 統一的 Empty State（低干擾、可加動作）
 * icon 可傳語意名（info/warning/calendar…）或相容舊 emoji 字元
 */
export default function EmptyState({
  icon = 'info',
  title,
  description,
  actions,
}) {
  return (
    <div
      className="text-center py-4"
      role="status"
      aria-live="polite"
    >
      {icon ? (
        <div className="text-primary d-inline-flex" aria-hidden>
          <AppIcon name={icon} size="lg" />
        </div>
      ) : null}
      {title && <div className="fw-bold mt-2">{title}</div>}
      {description && <div className="text-muted mt-2">{description}</div>}
      {actions && <div className="mt-3 d-flex flex-wrap justify-content-center gap-2">{actions}</div>}
    </div>
  );
}
