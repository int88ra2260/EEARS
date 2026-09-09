import React, { memo, useCallback } from 'react';
import QuickActionButtons from './QuickActionButtons';
import { getStatusBadge, highlightText } from './englishTestTableHelpers';

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
                  cursor: 'pointer',
                  border: '1px solid #ddd',
                }}
                onClick={() => window.open(`/uploads/${row.idPhoto}`, '_blank')}
                title="點擊放大"
              />
            ) : (
              <span className="text-muted">無</span>
            )
          ) : col.key === 'createdAt' ? (
            new Date(row[col.key]).toLocaleString('zh-TW')
          ) : col.key === 'id' ? (
            hasSearch
              ? highlightText(
                row.semesterSequence || (row.status === 'success' && row.successSequence) || row.id,
                searchTerm
              )
              : (row.semesterSequence || (row.status === 'success' && row.successSequence) || row.id)
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
