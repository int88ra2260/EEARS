import React from 'react';
import Breadcrumbs from './Breadcrumbs';
import './PageHeader.css';

/**
 * 統一頁面標題區：麵包屑 + 標題 + 選填說明
 * @param {Array<{ label: string, path?: string }>} breadcrumbs
 * @param {React.ReactNode} title
 * @param {React.ReactNode} [lead] - 副標／說明
 * @param {React.ReactNode} [eyebrow]
 * @param {React.ReactNode} [actions]
 * @param {string} [variant]
 * @param {string} [className]
 */
export default function PageHeader({
  breadcrumbs,
  title,
  lead,
  eyebrow,
  actions,
  variant = 'default',
  className = '',
}) {
  const headerClassName = `page-header page-header--${variant}${className ? ` ${className}` : ''}`;
  return (
    <header className={headerClassName}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}
      {eyebrow ? <p className="page-header-eyebrow">{eyebrow}</p> : null}
      <h1 className="page-header-title">{title}</h1>
      {lead && <p className="page-header-lead">{lead}</p>}
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
