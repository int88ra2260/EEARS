import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Collapse from 'react-bootstrap/Collapse';
import { CalendarBlank } from '@phosphor-icons/react/dist/icons/CalendarBlank';
import { CaretRight } from '@phosphor-icons/react/dist/icons/CaretRight';
import { ChalkboardTeacher } from '@phosphor-icons/react/dist/icons/ChalkboardTeacher';
import { ChartBar } from '@phosphor-icons/react/dist/icons/ChartBar';
import { ChartLineUp } from '@phosphor-icons/react/dist/icons/ChartLineUp';
import { ClipboardText } from '@phosphor-icons/react/dist/icons/ClipboardText';
import { Exam } from '@phosphor-icons/react/dist/icons/Exam';
import { GearSix } from '@phosphor-icons/react/dist/icons/GearSix';
import { Key } from '@phosphor-icons/react/dist/icons/Key';
import { Megaphone } from '@phosphor-icons/react/dist/icons/Megaphone';
import { Path } from '@phosphor-icons/react/dist/icons/Path';
import { ShieldCheck } from '@phosphor-icons/react/dist/icons/ShieldCheck';
import { SlidersHorizontal } from '@phosphor-icons/react/dist/icons/SlidersHorizontal';
import { UploadSimple } from '@phosphor-icons/react/dist/icons/UploadSimple';
import { UsersThree } from '@phosphor-icons/react/dist/icons/UsersThree';
import { Wrench } from '@phosphor-icons/react/dist/icons/Wrench';
import {
  ADMIN_NAV_SECTIONS,
  filterAdminNavByQuery,
  filterVisibleNav,
  getDefaultExpandedSectionIds,
  getSidebarActiveState,
  isSidebarChildActive,
  isSidebarSingleSectionActive,
} from '../../constants/adminNavigation';
import useLearningPartnerOpsAttention from '../../hooks/useLearningPartnerOpsAttention';
import useLeaderMarkingAttention from '../../hooks/useLeaderMarkingAttention';
import { LP_OPS_ATTENTION_PATH } from '../../utils/learningPartnerOpsAttention';
import UnreadAttentionDot from '../learning-partner/UnreadAttentionDot';

const NAV_ICONS = {
  events: CalendarBlank,
  classes: ChalkboardTeacher,
  english: Exam,
  'learning-outcomes': Path,
  surveys: ClipboardText,
  'import-center': UploadSimple,
  analytics: ChartBar,
  content: Megaphone,
  accounts: Key,
  system: GearSix,
  'et-grouping': UsersThree,
  'learning-analytics': ChartLineUp,
  'survey-ops': Wrench,
  'system-config': SlidersHorizontal,
  'system-audit': ShieldCheck,
};

function isNavGroup(node) {
  return Array.isArray(node?.children) && node.children.length > 0 && !node.path;
}

function collectExpandableIds(nodes, out = []) {
  for (const node of nodes || []) {
    if (!isNavGroup(node)) continue;
    out.push(node.id);
    collectExpandableIds(node.children, out);
  }
  return out;
}

function NavGlyph({ id, size = 16 }) {
  const Icon = NAV_ICONS[id];
  if (!Icon) return null;
  return <Icon size={size} weight="regular" aria-hidden className="admin-sidebar__glyph" />;
}

export default function AdminSidebar({ pathname, navContext, token, mobileOpen, onNavigate }) {
  const visible = useMemo(() => filterVisibleNav(ADMIN_NAV_SECTIONS, navContext), [navContext]);
  const active = useMemo(() => getSidebarActiveState(pathname, navContext), [pathname, navContext]);
  const [navQuery, setNavQuery] = useState('');
  const { showAttention: showLpOpsAttention } = useLearningPartnerOpsAttention(
    navContext?.accessProfile
  );
  const { count: leaderMarkingCount } = useLeaderMarkingAttention(token, navContext?.accessProfile);
  const showLeaderMarking = leaderMarkingCount > 0;

  const filteredVisible = useMemo(
    () => filterAdminNavByQuery(visible, navQuery),
    [visible, navQuery]
  );

  const defaultExpandedIds = useMemo(
    () => getDefaultExpandedSectionIds(navContext, visible),
    [navContext, visible]
  );

  /** true = 展開；依角色預設展開常用區段，並自動展開目前路由所屬區段與子群組 */
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
    if (!active.sectionId && !active.groupId) return;
    setExpandedSections((prev) => {
      const next = { ...prev };
      let changed = false;
      if (active.sectionId && !next[active.sectionId]) {
        next[active.sectionId] = true;
        changed = true;
      }
      if (active.groupId && !next[active.groupId]) {
        next[active.groupId] = true;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [active.sectionId, active.groupId]);

  useEffect(() => {
    if (!showLpOpsAttention) return;
    setExpandedSections((prev) => {
      if (prev.english) return prev;
      return { ...prev, english: true };
    });
  }, [showLpOpsAttention]);

  useEffect(() => {
    if (!showLeaderMarking) return;
    setExpandedSections((prev) => {
      if (prev.events && prev['et-grouping']) return prev;
      return { ...prev, events: true, 'et-grouping': true };
    });
  }, [showLeaderMarking]);

  useEffect(() => {
    const q = navQuery.trim();
    if (!q) return;
    setExpandedSections((prev) => {
      const next = { ...prev };
      collectExpandableIds(filteredVisible).forEach((id) => {
        next[id] = true;
      });
      return next;
    });
  }, [navQuery, filteredVisible]);

  const toggleSection = (id) => {
    setExpandedSections((p) => ({ ...p, [id]: !p[id] }));
  };

  const expandableIds = useMemo(() => collectExpandableIds(visible), [visible]);

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

  const resolveLeafPath = (leaf) => {
    if (leaf.id === 'english-registration' && showLpOpsAttention) {
      return LP_OPS_ATTENTION_PATH;
    }
    return leaf.path;
  };

  const renderLeafLink = (section, leaf) => {
    const childActive = isSidebarChildActive(active, section.id, leaf.id);
    const showDot = leaf.id === 'english-registration' && showLpOpsAttention;
    const showMarkingDot = leaf.id === 'et-leader-sessions' && showLeaderMarking;
    return (
      <li key={leaf.id}>
        <Link
          to={resolveLeafPath(leaf)}
          className={`admin-sidebar__link${childActive ? ' admin-sidebar__link--active' : ''}`}
          onClick={handleLinkClick}
        >
          <span>{leaf.label}</span>
          {showDot ? <UnreadAttentionDot label="請查看學習有伴營運成效" /> : null}
          {showMarkingDot ? (
            <UnreadAttentionDot label={`還有 ${leaderMarkingCount} 場任務沒在當下勾完`} />
          ) : null}
        </Link>
      </li>
    );
  };

  const renderGroup = (node, section, depth) => {
    const expanded = isExpanded(node.id);
    const isActive = depth === 0 ? active.sectionId === node.id : active.groupId === node.id;
    const sectionShowDot = depth === 0 && (
      (node.id === 'english' && showLpOpsAttention)
      || (node.id === 'events' && showLeaderMarking)
    );
    const sectionDotLabel = node.id === 'events'
      ? `還有 ${leaderMarkingCount} 場任務沒在當下勾完`
      : '請查看學習有伴營運成效';
    const labelClass = depth === 0
      ? 'admin-sidebar__section-label'
      : 'admin-sidebar__subgroup-label';
    return (
      <li key={node.id} className={depth === 0 ? 'mb-1' : 'admin-sidebar__subgroup'}>
        <button
          type="button"
          className={`${labelClass}${isActive ? ` ${labelClass}--active` : ''}`}
          onClick={() => toggleSection(node.id)}
          aria-expanded={expanded}
          aria-controls={`admin-nav-${node.id}`}
        >
          <span className={depth === 0 ? 'admin-sidebar__section-label-row' : 'admin-sidebar__subgroup-label-row'}>
            <NavGlyph id={node.id} size={depth === 0 ? 16 : 14} />
            <span>{node.label}</span>
            {sectionShowDot ? <UnreadAttentionDot label={sectionDotLabel} /> : null}
          </span>
          <CaretRight
            size={12}
            weight="bold"
            className={`admin-sidebar__chevron${expanded ? ' admin-sidebar__chevron--open' : ''}`}
            aria-hidden
          />
        </button>
        <Collapse in={expanded}>
          <ul
            id={`admin-nav-${node.id}`}
            className={depth === 0 ? 'admin-sidebar__sub' : 'admin-sidebar__sub admin-sidebar__sub--nested'}
          >
            {depth === 0 && node.hint ? (
              <li className="admin-sidebar__hint">{node.hint}</li>
            ) : null}
            {node.children.map((child) => (
              isNavGroup(child) ? renderGroup(child, section, depth + 1) : renderLeafLink(section, child)
            ))}
          </ul>
        </Collapse>
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
          if (isNavGroup(section)) {
            return renderGroup(section, section, 0);
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
                <span className="admin-sidebar__section-label-row">
                  <NavGlyph id={section.id} />
                  <span>{section.label}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
