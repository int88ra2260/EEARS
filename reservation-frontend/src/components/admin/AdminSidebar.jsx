import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Collapse from 'react-bootstrap/Collapse';
import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavByQuery,
  filterVisibleNav,
  getDefaultExpandedSectionIds,
  getSidebarActiveState,
  isSidebarChildActive,
  isSidebarSingleSectionActive,
} from '../../constants/adminNavigation';

export default function AdminSidebar({ pathname, navContext, mobileOpen, onNavigate }) {
  const visible = useMemo(() => filterVisibleNav(ADMIN_NAV_SECTIONS, navContext), [navContext]);
  const active = useMemo(() => getSidebarActiveState(pathname, navContext), [pathname, navContext]);
  const [navQuery, setNavQuery] = useState('');

  const filteredVisible = useMemo(
    () => filterAdminNavByQuery(visible, navQuery),
    [visible, navQuery]
  );

  const defaultExpandedIds = useMemo(
    () => getDefaultExpandedSectionIds(navContext, visible),
    [navContext, visible]
  );

  /** true = 展開；依角色預設展開常用區段，並自動展開目前路由所屬區段 */
  const [expandedSections, setExpandedSections] = useState({});
  const defaultsAppliedRef = useRef(false);

  useEffect(() => {
    if (defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    setExpandedSections((prev) => {
      const next = { ...prev };
      defaultExpandedIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  }, [defaultExpandedIds]);

  useEffect(() => {
    if (!active.sectionId) return;
    setExpandedSections((prev) => {
      if (prev[active.sectionId]) return prev;
      return { ...prev, [active.sectionId]: true };
    });
  }, [active.sectionId]);

  useEffect(() => {
    const q = navQuery.trim();
    if (!q) return;
    setExpandedSections((prev) => {
      const next = { ...prev };
      filteredVisible.forEach((section) => {
        if (section.children?.length) next[section.id] = true;
      });
      return next;
    });
  }, [navQuery, filteredVisible]);

  const toggleSection = (id) => {
    setExpandedSections((p) => ({ ...p, [id]: !p[id] }));
  };

  const expandableIds = visible.filter((section) => section.children?.length).map((section) => section.id);

  const expandAll = () => {
    setExpandedSections((prev) => {
      const next = { ...prev };
      expandableIds.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  };

  const collapseAll = () => {
    setExpandedSections({});
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
      <div className="admin-sidebar__tools">
        <label className="visually-hidden" htmlFor="admin-sidebar-search">搜尋功能</label>
        <input
          id="admin-sidebar-search"
          type="search"
          className="form-control form-control-sm admin-sidebar__search"
          placeholder="搜尋功能…"
          value={navQuery}
          onChange={(e) => setNavQuery(e.target.value)}
        />
        {expandableIds.length > 1 ? (
          <div className="admin-sidebar__expand-actions">
            <button type="button" className="btn btn-link btn-sm p-0" onClick={expandAll}>
              全部展開
            </button>
            <span className="text-muted">·</span>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={collapseAll}>
              全部收合
            </button>
          </div>
        ) : null}
      </div>
      <ul className="admin-sidebar__nav">
        {filteredVisible.length === 0 ? (
          <li className="px-2 py-2 small text-muted">找不到符合「{navQuery.trim()}」的功能</li>
        ) : null}
        {filteredVisible.map((section) => {
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
                    {section.hint ? (
                      <li className="admin-sidebar__hint">{section.hint}</li>
                    ) : null}
                    {section.children.flatMap((leaf) => {
                      const items = [];
                      if (leaf.groupLabel) {
                        items.push(
                          <li key={`grp-${leaf.id}`} className="admin-sidebar__group-divider">
                            {leaf.groupLabel}
                          </li>
                        );
                      }
                      items.push(renderLeafLink(section, leaf));
                      return items;
                    })}
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
