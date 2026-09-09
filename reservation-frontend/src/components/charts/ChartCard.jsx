import React from 'react';
import './chartKit.css';

/**
 * Shared chart card shell: loading skeleton, empty state, title/actions.
 */
export default function ChartCard({
  title,
  description,
  loading = false,
  empty = false,
  emptyHint = '尚無統計資料',
  emptyIcon = 'fa-chart-line',
  actions = null,
  children,
  className = '',
  bodyClassName = '',
  plotHeight,
}) {
  if (loading) {
    return (
      <div className={`card eears-chart-card mb-0 ${className}`.trim()}>
        <div className="card-body text-center py-5">
          <div className="eears-chart-skeleton mx-auto mb-3" aria-hidden />
          <p className="mt-2 text-muted small mb-0">載入統計資料中...</p>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={`card eears-chart-card mb-0 ${className}`.trim()}>
        {title ? (
          <div className="card-header eears-chart-card__header">
            <h5 className="eears-chart-card__title mb-0">{title}</h5>
          </div>
        ) : null}
        <div className="card-body text-center py-5">
          <i className={`fas ${emptyIcon} fa-3x text-muted mb-3`} aria-hidden />
          <p className="text-muted mb-0">尚無統計資料</p>
          {emptyHint ? <p className="small text-muted mb-0">{emptyHint}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`card eears-chart-card mb-0 h-100 ${className}`.trim()}>
      {(title || description || actions) ? (
        <div className="card-header eears-chart-card__header d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            {title ? <h5 className="eears-chart-card__title">{title}</h5> : null}
            {description ? <p className="eears-chart-card__desc">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={`card-body pt-2 ${bodyClassName}`.trim()}>
        {plotHeight ? (
          <div className="eears-chart-plot" style={{ height: plotHeight }}>
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
