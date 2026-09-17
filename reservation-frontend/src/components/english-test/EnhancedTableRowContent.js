import React, { memo, useCallback, useEffect, useState } from 'react';
import QuickActionButtons from './QuickActionButtons';
import { getStatusBadge, highlightText } from './englishTestTableHelpers';

function ArrangePositionControls({
  arrangeIndex,
  arrangeTotal,
  rowId,
  onArrangeMove,
}) {
  const oneBased = arrangeIndex + 1;
  const [draft, setDraft] = useState(String(oneBased));
  const isFirst = arrangeIndex <= 0;
  const isLast = arrangeIndex >= arrangeTotal - 1;

  useEffect(() => {
    setDraft(String(oneBased));
  }, [oneBased]);

  const commitJump = useCallback(() => {
    const n = parseInt(String(draft).trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > arrangeTotal) {
      setDraft(String(oneBased));
      return;
    }
    if (n === oneBased) return;
    onArrangeMove?.(rowId, 'to', n);
  }, [draft, arrangeTotal, oneBased, onArrangeMove, rowId]);

  return (
    <td
      style={{
        minWidth: '148px',
        textAlign: 'left',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
      }}
    >
      <div className="d-inline-flex align-items-center gap-1">
        <span className="badge text-bg-primary" title="匯出序號（Excel／證件照）">
          {oneBased}
        </span>
        <div className="btn-group btn-group-sm" role="group" aria-label="調整匯出順序">
            <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={isFirst}
            title="上移一位"
            aria-label="上移一位"
            onClick={() => onArrangeMove?.(rowId, 'up')}
          >
            ↑
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={isLast}
            title="下移一位"
            aria-label="下移一位"
            onClick={() => onArrangeMove?.(rowId, 'down')}
          >
            ↓
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={isFirst}
            title="移到最前"
            aria-label="移到最前"
            onClick={() => onArrangeMove?.(rowId, 'top')}
          >
            頂
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={isLast}
            title="移到最後"
            aria-label="移到最後"
            onClick={() => onArrangeMove?.(rowId, 'bottom')}
          >
            底
          </button>
        </div>
        <input
          type="number"
          className="form-control form-control-sm"
          style={{ width: '4.2rem' }}
          min={1}
          max={arrangeTotal}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitJump}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitJump();
            }
          }}
          onFocus={() => setDraft(String(oneBased))}
          title={`輸入 1～${arrangeTotal} 後按 Enter 移至該位置`}
          aria-label="移至匯出序號"
        />
      </div>
    </td>
  );
}

function EnhancedTableRowContent({
  row,
  visibleColumnDefs,
  isSelected,
  onToggleSelect,
  searchTerm,
  onViewDetail,
  onQuickStatusUpdate,
  onDelete,
  onClassBestep,
  enableDragSort,
  exportArrangeMode = false,
  arrangeIndex = -1,
  arrangeTotal = 0,
  onArrangeMove = null,
  confirm,
}) {
  const handleDelete = useCallback(() => {
    confirm({
      title: '確認刪除報名資料？',
      description: '此操作無法復原。',
      confirmText: '刪除',
      cancelText: '取消',
      variant: 'danger',
    }).then((ok) => {
      if (!ok) return;
      onDelete?.(row.id);
    });
  }, [confirm, onDelete, row.id]);

  const handleView = useCallback(() => {
    onViewDetail?.(row.id);
  }, [onViewDetail, row.id]);

  const handleSelectChange = useCallback((e) => {
    onToggleSelect?.(row.id, e.target.checked);
  }, [onToggleSelect, row.id]);

  const hasSearch = Boolean(searchTerm);

  return (
    <>
      {enableDragSort && (
        <td
          style={{
            width: '30px',
            cursor: 'grab',
            userSelect: 'none',
            textAlign: 'center',
            verticalAlign: 'middle',
            padding: '0.5rem',
          }}
          data-drag-handle="true"
        >
          <i className="fas fa-grip-vertical text-muted" style={{ fontSize: '0.875rem' }} title="拖曳調整順序" />
        </td>
      )}

      {exportArrangeMode && arrangeIndex >= 0 && (
        <ArrangePositionControls
          arrangeIndex={arrangeIndex}
          arrangeTotal={arrangeTotal}
          rowId={row.id}
          onArrangeMove={onArrangeMove}
        />
      )}

      <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleSelectChange}
        />
      </td>

      {visibleColumnDefs.map((col) => (
        <td key={col.key} style={{ textAlign: 'left', verticalAlign: 'middle' }}>
          {col.key === 'status' ? (
            getStatusBadge(row[col.key])
          ) : col.key === 'photo' ? (
            row.idPhoto ? (
              <img
                src={`/uploads/${row.idPhoto}`}
                alt="證件照"
                loading="lazy"
                style={{
                  width: '50px',
                  height: '50px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                }}
              />
            ) : (
              <span className="text-muted">-</span>
            )
          ) : col.key === 'createdAt' || col.key === 'approvedAt' ? (
            row[col.key] ? new Date(row[col.key]).toLocaleString('zh-TW') : '-'
          ) : col.key === 'id' ? (
            hasSearch
              ? highlightText(String(row[col.key] ?? ''), searchTerm)
              : row[col.key]
          ) : (
            hasSearch
              ? highlightText(row[col.key] || '-', searchTerm)
              : (row[col.key] || '-')
          )}
        </td>
      ))}

      <td style={{ textAlign: 'left', verticalAlign: 'middle' }}>
        <QuickActionButtons
          registration={row}
          onView={handleView}
          onQuickStatusUpdate={onQuickStatusUpdate}
          onClassBestep={onClassBestep}
          onDelete={handleDelete}
        />
      </td>
    </>
  );
}

function rowPropsAreEqual(prev, next) {
  return (
    prev.row === next.row
    && prev.isSelected === next.isSelected
    && prev.searchTerm === next.searchTerm
    && prev.enableDragSort === next.enableDragSort
    && prev.exportArrangeMode === next.exportArrangeMode
    && prev.arrangeIndex === next.arrangeIndex
    && prev.arrangeTotal === next.arrangeTotal
    && prev.onArrangeMove === next.onArrangeMove
    && prev.visibleColumnDefs === next.visibleColumnDefs
    && prev.onToggleSelect === next.onToggleSelect
    && prev.onViewDetail === next.onViewDetail
    && prev.onQuickStatusUpdate === next.onQuickStatusUpdate
    && prev.onDelete === next.onDelete
    && prev.onClassBestep === next.onClassBestep
    && prev.confirm === next.confirm
  );
}

export default memo(EnhancedTableRowContent, rowPropsAreEqual);
