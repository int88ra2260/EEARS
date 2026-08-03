import React, { useEffect, useMemo, useState } from 'react';

import { labelForContentKey } from '../../utils/siteContentCatalog';
import { groupTextItems } from '../../utils/siteContentGroups';

function StatusBadge({ isActive }) {
  return (
    <span className={`scm-badge ${isActive ? 'scm-badge--active' : 'scm-badge--inactive'}`}>
      {isActive ? '啟用' : '停用'}
    </span>
  );
}

function TextItemCard({ row, saving, onEdit, onDelete }) {
  return (
    <article className="scm-item-card">
      <div className="scm-item-card__main">
        <div className="scm-item-card__head">
          <h3 className="scm-item-card__title">{row.displayLabel}</h3>
          <StatusBadge isActive={row.isActive !== false} />
        </div>
        <code className="scm-code scm-item-card__key">{row.contentKey}</code>
        <p className="scm-item-card__preview" title={row.valueZh || row.valueEn || ''}>
          {row.valueZh || row.valueEn || '（尚無內容）'}
        </p>
      </div>
      <div className="scm-item-card__actions">
        <button
          type="button"
          className="scm-btn-ghost"
          disabled={saving}
          onClick={() => onEdit(row)}
        >
          編輯
        </button>
        <button
          type="button"
          className="scm-btn-danger-ghost"
          disabled={saving || !row.id}
          onClick={() => onDelete(row.id, row.displayLabel)}
        >
          刪除
        </button>
      </div>
    </article>
  );
}

function GroupSection({
  group,
  expanded,
  onToggle,
  saving,
  onEdit,
  onDelete,
}) {
  return (
    <section className={`scm-group${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="scm-group__header"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="scm-group__toggle" aria-hidden="true">{expanded ? '−' : '+'}</span>
        <span className="scm-group__text">
          <span className="scm-group__title">{group.label}</span>
          {group.description ? (
            <span className="scm-group__desc">{group.description}</span>
          ) : null}
        </span>
        <span className="scm-group__count">{group.items.length} 筆</span>
      </button>
      {expanded ? (
        <div className="scm-group__body">
          {group.items.map((row) => (
            <TextItemCard
              key={row.id || row.contentKey}
              row={row}
              saving={saving}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function SiteContentTextPanel({
  section,
  items,
  loading,
  saving,
  onCreate,
  onEdit,
  onDelete,
  onSwitchToVisual,
}) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const enriched = useMemo(
    () => (items || []).map((item) => ({
      ...item,
      displayLabel: item.label || labelForContentKey(item.contentKey),
    })),
    [items]
  );

  const stats = useMemo(() => ({
    total: enriched.length,
    active: enriched.filter((row) => row.isActive !== false).length,
    inactive: enriched.filter((row) => row.isActive === false).length,
  }), [enriched]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((row) => {
      if (filter === 'active' && row.isActive === false) return false;
      if (filter === 'inactive' && row.isActive !== false) return false;
      if (!q) return true;
      return (
        row.displayLabel.toLowerCase().includes(q)
        || row.contentKey.toLowerCase().includes(q)
        || (row.valueZh || '').toLowerCase().includes(q)
        || (row.valueEn || '').toLowerCase().includes(q)
      );
    });
  }, [enriched, filter, query]);

  const groups = useMemo(
    () => groupTextItems(section, filteredRows),
    [section, filteredRows]
  );

  const isSearching = query.trim().length > 0;

  useEffect(() => {
    if (groups.length === 0) {
      setExpandedGroups(new Set());
      return;
    }
    if (isSearching) {
      setExpandedGroups(new Set(groups.map((g) => g.id)));
      return;
    }
    setExpandedGroups((prev) => {
      if (prev.size > 0) {
        const next = new Set([...prev].filter((id) => groups.some((g) => g.id === id)));
        if (next.size > 0) return next;
      }
      return new Set([groups[0].id]);
    });
  }, [section, isSearching, groups]);

  const toggleGroup = (id) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedGroups(new Set(groups.map((g) => g.id)));
  const collapseAll = () => setExpandedGroups(new Set());

  return (
    <div className="scm-panel">
      <div className="scm-toolbar">
        <p className="scm-toolbar__meta mb-0">
          共 {stats.total} 筆 · {groups.length} 個小區塊
          {stats.inactive > 0 ? ` · ${stats.inactive} 筆停用` : ''}
        </p>
        <div className="scm-toolbar__search">
          <input
            type="search"
            className="form-control"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋欄位名稱、翻譯鍵或內容"
            aria-label="搜尋文案"
          />
        </div>
        <button type="button" className="scm-btn-ghost" disabled={loading || groups.length === 0} onClick={expandAll}>
          全部展開
        </button>
        <button type="button" className="scm-btn-ghost" disabled={loading || groups.length === 0} onClick={collapseAll}>
          全部收合
        </button>
        {onSwitchToVisual ? (
          <button type="button" className="scm-btn-ghost" disabled={loading} onClick={onSwitchToVisual}>
            返回視覺編輯
          </button>
        ) : null}
        <button type="button" className="scm-btn-primary" disabled={saving} onClick={onCreate}>
          新增文案
        </button>
      </div>

      <div className="scm-filters" role="group" aria-label="狀態篩選">
        {[
          { id: 'all', label: `全部 ${stats.total}` },
          { id: 'active', label: `啟用 ${stats.active}` },
          { id: 'inactive', label: `停用 ${stats.inactive}` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`scm-filter-chip${filter === item.id ? ' is-active' : ''}`}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="scm-loading">載入中…</div>
      ) : filteredRows.length === 0 ? (
        <div className="scm-empty">
          <p className="scm-empty__title">
            {enriched.length === 0 ? '尚無文案' : '沒有符合條件的文案'}
          </p>
          <p className="scm-empty__text">
            {enriched.length === 0
              ? '點選「新增文案」建立第一筆內容。'
              : '調整搜尋或篩選條件後再試。'}
          </p>
          {enriched.length === 0 ? (
            <button type="button" className="scm-btn-primary" disabled={saving} onClick={onCreate}>
              新增文案
            </button>
          ) : null}
        </div>
      ) : (
        <div className="scm-groups">
          {groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              expanded={expandedGroups.has(group.id)}
              onToggle={() => toggleGroup(group.id)}
              saving={saving}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { StatusBadge };
