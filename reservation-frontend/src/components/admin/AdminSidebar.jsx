import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Collapse from 'react-bootstrap/Collapse';
import {
  ADMIN_NAV_SECTIONS,
  filterVisibleNav,
  getSidebarActiveState,
  isSidebarChildActive,
  isSidebarSingleSectionActive,
} from '../../constants/adminNavigation';

export default function AdminSidebar({ pathname, navContext, mobileOpen, onNavigate }) {
  const visible = useMemo(() => filterVisibleNav(ADMIN_NAV_SECTIONS, navContext), [navContext]);
  const active = useMemo(() => getSidebarActiveState(pathname, navContext), [pathname, navContext]);

  /** true = 展開；預設全部收合，僅自動展開目前路由所屬區段 */
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (!active.sectionId) return;
    setExpandedSections((prev) => {
      if (prev[active.sectionId]) return prev;
      return { ...prev, [active.sectionId]: true };
    });
  }, [active.sectionId]);

  const toggleSection = (id) => {
    setExpandedSections((p) => ({ ...p, [id]: !p[id] }));
  };

  const isExpanded = (id) => expandedSections[id] === true;

  const handleLinkClick = () => {
    onNavigate?.();
  };

  const renderLeafLink = (section, leaf) => {
    const childActive = isSidebarChildActive(active, section.id, leaf.id);
    return (
      <li key={leaf.id}>
        <Link
          to={leaf.path}
          className={`admin-sidebar__link${childActive ? ' admin-sidebar__link--active' : ''}`}
          onClick={handleLinkClick}
        >
          {leaf.label}
        </Link>
      </li>
    );
  };

  return (
    <aside
      id="admin-sidebar-nav"
      className={`admin-sidebar${mobileOpen ? ' admin-sidebar--open' : ''}`}
      aria-label="後台主導覽"
    >
      <div className="admin-sidebar__brand">EEARS 後台</div>
      <ul className="admin-sidebar__nav">
        {visible.map((section) => {
          if (section.children?.length) {
            const expanded = isExpanded(section.id);
            const sectionHasActive = active.sectionId === section.id;
            return (
              <li key={section.id} className="mb-1">
                <button
                  type="button"
                  className={`admin-sidebar__section-label${
                    sectionHasActive ? ' admin-sidebar__section-label--active' : ''
                  }`}
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={expanded}
                >
                  <span>{section.label}</span>
                  <span className="admin-sidebar__chevron" aria-hidden>
                    {expanded ? '▼' : '▶'}
                  </span>
                </button>
                <Collapse in={expanded}>
                  <ul className="admin-sidebar__sub">
                    {section.children.map((leaf) => renderLeafLink(section, leaf))}
                  </ul>
                </Collapse>
              </li>
            );
          }

          if (!section.path) return null;

          const flatActive = isSidebarSingleSectionActive(active, section.id);
          return (
            <li key={section.id} className="mb-1">
              <Link
                to={section.path}
                className={`admin-sidebar__group-link${flatActive ? ' admin-sidebar__group-link--active' : ''}`}
                onClick={handleLinkClick}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
