import React from 'react';
import AppIcon from './AppIcon';
import './EmptyState.css';

const VARIANTS = new Set(['default', 'no-data', 'no-results', 'no-pending', 'no-activity']);

function visibleText(value) {
  if (typeof value === 'string') return value.trim();
  return value;
}

/**
 * 統一的 Empty State（低干擾、可加動作）
 * icon 可傳語意名（info/warning/calendar…）或相容舊 emoji 字元。
 * 傳 null / false 可省略圖示。variant、density 省略時維持既有呈現。
 */
export default function EmptyState({
  icon = 'info',
  title,
  description,
  actions,
  variant = 'default',
  density = 'regular',
}) {
  const safeVariant = VARIANTS.has(variant) ? variant : 'default';
  const isCompact = density === 'compact';
  const titleText = visibleText(title);
  const descriptionText = visibleText(description);
  const showTitle = titleText != null && titleText !== '';
  const showDescription = descriptionText != null && descriptionText !== '';
  const showActions = actions != null && actions !== false && actions !== '';

  return (
    <div
      className={`eears-empty-state eears-empty-state--${safeVariant} eears-empty-state--${isCompact ? 'compact' : 'regular'} text-center`}
      role="status"
    >
      {icon ? (
        <div className="eears-empty-state__icon d-inline-flex" aria-hidden="true">
          <AppIcon name={icon} size={isCompact ? 'sm' : 'lg'} />
        </div>
      ) : null}
      {showTitle ? <div className="eears-empty-state__title">{titleText}</div> : null}
      {showDescription ? <div className="eears-empty-state__description">{descriptionText}</div> : null}
      {showActions ? (
        <div className="eears-empty-state__actions d-flex flex-wrap justify-content-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
