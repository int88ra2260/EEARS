import React from 'react';
import { Link } from 'react-router-dom';

/**
 * 麵包屑導覽
 * @param {Array<{ label: string, path?: string }>} items - 最後一項為當前頁（可不給 path）
 */
export default function Breadcrumbs({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumb mb-0">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="breadcrumb-item">
              {isLast || !item.path ? (
                <span aria-current="page">{item.label}</span>
              ) : (
                <Link to={item.path}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
