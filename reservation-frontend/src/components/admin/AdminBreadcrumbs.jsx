import React from 'react';
import { Link } from 'react-router-dom';
import { getAdminBreadcrumbs } from '../../constants/adminNavigation';

export default function AdminBreadcrumbs({ pathname, navContext, leafOverride }) {
  const items = getAdminBreadcrumbs(pathname, navContext, { leafOverride });
  const last = items.length - 1;

  return (
    <nav aria-label="breadcrumb">
      <ol className="breadcrumb mb-0 small">
        {items.map((item, i) => (
          <li
            key={`${item.label}-${i}`}
            className={`breadcrumb-item${i === last ? ' active' : ''}`}
            aria-current={i === last ? 'page' : undefined}
          >
            {item.to && i < last ? (
              <Link to={item.to} className="text-decoration-none">
                {item.label}
              </Link>
            ) : (
              item.label
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
